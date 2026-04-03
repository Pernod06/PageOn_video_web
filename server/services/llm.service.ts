/**
 * LLM Service — OpenRouter integration via LangChain.js
 * Migrated from llm_server.py
 */
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import { envString, envFlag } from "../utils/env";
import { extractJson } from "../utils/json-extractor";
import { getSupabaseClient } from "./supabase.service";

import {
  ANALYZE_TRANSCRIPT_SYSTEM,
  ANALYZE_TRANSCRIPT_HUMAN,
} from "../prompts/analyze-transcript";
import { CHAT_SYSTEM } from "../prompts/chat-with-video";
import {
  GENERATE_THEMES_SYSTEM,
  GENERATE_THEMES_HUMAN,
} from "../prompts/generate-themes";
import { TRANSLATE_SYSTEM } from "../prompts/translate";
import { KEY_TAKEAWAYS_IMAGE_SYSTEM } from "../prompts/key-takeaways-image";

import type { ThemeResult, StructuredArticleV2 } from "../schemas/article-v2.schema";

// ─── Config ───────────────────────────────────────────────
const OPENROUTER_BASE_URL = envString("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1");
const MAIN_MODEL = envString("OPENROUTER_MODEL_MAIN", "gemini-3-flash-preview");
const LITE_MODEL = envString("OPENROUTER_MODEL_LITE", "gemini-2.5-flash");
const IMAGE_MODEL = envString("OPENROUTER_MODEL_IMAGE", "gemini-3-pro-image-preview");
const KEY_TAKEAWAYS_IMAGE_ENABLED = envFlag("ENABLE_KEY_TAKEAWAYS_IMAGE", true);

const LANGUAGE_NAMES: Record<string, string> = {
  zh: "Chinese (简体中文)",
  en: "English",
  ja: "Japanese (日本語)",
  ko: "Korean (한국어)",
  es: "Spanish (Español)",
  fr: "French (Français)",
  de: "German (Deutsch)",
};

// ─── Service ──────────────────────────────────────────────

class LLMService {
  private llm: ChatOpenAI;
  private llmLite: ChatOpenAI;
  private chatMemories = new Map<string, BaseMessage[]>();
  private readonly memoryWindowSize = 5;

  constructor() {
    const apiKey = envString("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

    const headers = {
      "HTTP-Referer": "https://your-app.com",
      "X-Title": "YouTube Process API",
    };

    this.llm = new ChatOpenAI({
      apiKey,
      configuration: { baseURL: OPENROUTER_BASE_URL, defaultHeaders: headers },
      modelName: MAIN_MODEL,
      temperature: 0.3,
      streaming: true,
    });

    this.llmLite = new ChatOpenAI({
      apiKey,
      configuration: { baseURL: OPENROUTER_BASE_URL, defaultHeaders: headers },
      modelName: LITE_MODEL,
      temperature: 0.7,
    });
  }

  // ─── Memory helpers ──────────────────────────────────────
  private getMemory(videoId: string, userId = "anonymous"): BaseMessage[] {
    const key = `${userId}:${videoId}`;
    if (!this.chatMemories.has(key)) this.chatMemories.set(key, []);
    return this.chatMemories.get(key)!;
  }

  private addToMemory(videoId: string, userId: string, human: string, ai: string): void {
    const mem = this.getMemory(videoId, userId);
    mem.push(new HumanMessage(human), new AIMessage(ai));
    // keep last N turns
    const maxMsgs = this.memoryWindowSize * 2;
    while (mem.length > maxMsgs) mem.shift();
  }

  clearUserMemory(videoId: string, userId = "anonymous"): void {
    this.chatMemories.delete(`${userId}:${videoId}`);
  }

  // ─── Transcript sampling ─────────────────────────────────
  private sampleTranscript(text: string, maxChars = 20000): string {
    if (text.length <= maxChars) return text;
    const lines = text.trim().split("\n");
    const numSeg = 10;
    const perSeg = Math.floor(lines.length / numSeg);
    const parts: string[] = [];
    for (let i = 0; i < numSeg; i++) {
      const start = i * perSeg;
      parts.push(lines.slice(start, start + perSeg).join("\n"));
    }
    return parts.join("\n\n[...]\n\n");
  }

  // ─── Analyze transcript (stream) ─────────────────────────
  async *analyzeVideoTranscriptStream(
    transcript: Array<{ start: number; text: string }>,
    details: Record<string, unknown>,
    videoId: string,
  ): AsyncGenerator<string> {
    const toTs = (s: number) => {
      const t = Math.floor(s);
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const sec = t % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };

    const transcriptText = transcript.map((i) => `[${toTs(i.start)}] ${i.text}`).join("\n");
    const sampled = this.sampleTranscript(transcriptText);

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", ANALYZE_TRANSCRIPT_SYSTEM],
      ["human", ANALYZE_TRANSCRIPT_HUMAN],
    ]);

    const chain = prompt.pipe(this.llm);

    for await (const chunk of await chain.stream({
      title: String(details.title ?? "Unknown"),
      video_id: videoId,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      transcript: sampled,
    })) {
      const content = typeof chunk.content === "string" ? chunk.content : "";
      if (content) yield content;
    }

    yield "\n[STREAM_END]";
  }

  // ─── Analyze transcript (non-stream) ─────────────────────
  async analyzeVideoTranscript(
    transcript: Array<{ start: number; text: string }>,
    details: Record<string, unknown>,
    videoId: string,
  ): Promise<StructuredArticleV2> {
    let full = "";
    for await (const chunk of this.analyzeVideoTranscriptStream(transcript, details, videoId)) {
      if (chunk !== "\n[STREAM_END]") full += chunk;
    }
    return this.parseAnalysisResult(full);
  }

  parseAnalysisResult(raw: string): StructuredArticleV2 {
    const data = extractJson<Record<string, unknown>>(raw.replace("[STREAM_END]", "").trim());
    if (!data || !Array.isArray(data.main_body)) {
      throw new Error("LLM response is not a valid V2 article: missing main_body");
    }
    return data as unknown as StructuredArticleV2;
  }

  // ─── Chat ────────────────────────────────────────────────
  async chatWithVideo(
    userMessage: string,
    videoContext: Record<string, unknown> | null,
    videoId = "default",
    userId = "anonymous",
  ): Promise<string> {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", CHAT_SYSTEM],
      new MessagesPlaceholder("chat_history"),
      ["human", "Video Context: {video_context}\n\nUser Question: {question}"],
    ]);

    const chain = prompt.pipe(this.llmLite).pipe(new StringOutputParser());

    const result = await chain.invoke({
      video_context: videoContext ? JSON.stringify(videoContext) : "No context",
      question: userMessage,
      chat_history: this.getMemory(videoId, userId),
    });

    this.addToMemory(videoId, userId, userMessage, result);
    return result;
  }

  // ─── Translate ───────────────────────────────────────────
  async translateVideoData(
    cachedData: Record<string, unknown>,
    targetLangCode: string,
  ): Promise<Record<string, unknown>> {
    const targetLang = LANGUAGE_NAMES[targetLangCode] ?? "English";

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", TRANSLATE_SYSTEM],
      ["human", "{json_data}"],
    ]);

    const chain = prompt.pipe(this.llmLite).pipe(new StringOutputParser());

    const result = { ...cachedData };
    const sections = [
      "meta", "header_hook", "summary_box", "main_body",
      "deep_analysis", "qa_interactions", "footer",
    ];

    for (const key of sections) {
      if (!cachedData[key]) continue;
      let sectionToTranslate = cachedData[key];
      let mermaid: string | null = null;

      if (key === "deep_analysis" && typeof sectionToTranslate === "object") {
        const da = sectionToTranslate as Record<string, unknown>;
        mermaid = String(da.mermaid_graph ?? "");
        const { mermaid_graph: _, ...rest } = da;
        sectionToTranslate = rest;
      }

      try {
        const response = await chain.invoke({
          target_language: targetLang,
          json_data: JSON.stringify(sectionToTranslate),
        });
        const translated = extractJson<unknown>(response);
        if (translated) {
          if (mermaid && key === "deep_analysis") {
            (translated as Record<string, unknown>).mermaid_graph = mermaid;
          }
          result[key] = translated;
        }
      } catch (e) {
        console.warn(`[Translate] ${key} failed: ${e}, keeping original`);
      }
    }

    return result;
  }

  // ─── Themes (non-stream) ─────────────────────────────────
  async generateThemes(
    videoData: Record<string, unknown>,
    language = "en",
  ): Promise<ThemeResult> {
    const targetLang = LANGUAGE_NAMES[language] ?? "English";
    const { title, sectionsJson } = this.prepareThemeInput(videoData);

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", GENERATE_THEMES_SYSTEM],
      ["human", GENERATE_THEMES_HUMAN],
    ]);

    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());

    const raw = await chain.invoke({
      title,
      sections_json: sectionsJson,
      target_language: targetLang,
    });

    const data = extractJson<ThemeResult>(raw.replace("[STREAM_END]", "").trim());
    if (!data) throw new Error("Failed to parse themes JSON");
    return data;
  }

  // ─── Themes (stream) ─────────────────────────────────────
  async *generateThemesStream(
    videoData: Record<string, unknown>,
    language = "en",
  ): AsyncGenerator<string> {
    const targetLang = LANGUAGE_NAMES[language] ?? "English";
    const { title, sectionsJson } = this.prepareThemeInput(videoData);

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", GENERATE_THEMES_SYSTEM],
      ["human", GENERATE_THEMES_HUMAN],
    ]);

    const chain = prompt.pipe(this.llm);

    for await (const chunk of await chain.stream({
      title,
      sections_json: sectionsJson,
      target_language: targetLang,
    })) {
      const content = typeof chunk.content === "string" ? chunk.content : "";
      if (content) yield content;
    }
    yield "\n[STREAM_END]";
  }

  private prepareThemeInput(videoData: Record<string, unknown>) {
    const mainBody = videoData.main_body as Array<Record<string, unknown>> | undefined;
    if (mainBody && mainBody.length > 0) {
      const converted = mainBody.map((s, i) => ({
        id: `section${i + 1}`,
        title: s.section_title ?? `Section ${i + 1}`,
        content: [{ content: s.content_markdown ?? "", timestampStart: s.timestamp_ref ?? "00:00" }],
      }));
      return {
        title: String((videoData.meta as Record<string, unknown>)?.title ?? "Unknown"),
        sectionsJson: JSON.stringify(converted, null, 2),
      };
    }
    return { title: "Unknown", sectionsJson: "[]" };
  }

  // ─── Key Takeaways Image ─────────────────────────────────
  async generateKeyTakeawaysImage(
    fullResponse: string,
    videoId?: string,
    saveToDb = true,
  ): Promise<string | null> {
    if (!KEY_TAKEAWAYS_IMAGE_ENABLED) return null;

    try {
      const jsonData = extractJson<Record<string, unknown>>(fullResponse);
      if (!jsonData) return null;

      const bulletPoints = (jsonData.summary_box as Record<string, unknown>)?.bullet_points;
      if (!Array.isArray(bulletPoints) || bulletPoints.length === 0) return null;

      const keyTakeawaysText = bulletPoints.map((p) => `- ${p}`).join("\n");

      // Generate image prompt via LLM
      const promptChain = ChatPromptTemplate.fromMessages([
        ["system", KEY_TAKEAWAYS_IMAGE_SYSTEM],
        ["human", "Key Takeaways:\n{key_takeaways}"],
      ]);
      const chain = promptChain.pipe(this.llmLite).pipe(new StringOutputParser());
      const imagePrompt = await chain.invoke({ key_takeaways: keyTakeawaysText });

      // Generate image via OpenRouter
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({
        baseURL: OPENROUTER_BASE_URL,
        apiKey: envString("OPENROUTER_API_KEY"),
      });

      const response = await client.chat.completions.create({
        model: IMAGE_MODEL,
        messages: [{ role: "user", content: imagePrompt }],
        // @ts-expect-error - OpenRouter-specific field
        modalities: ["image", "text"],
      });

      const content = response.choices?.[0]?.message?.content ?? "";
      const urlMatch = content.match(/(?:!\[.*?\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s)]+)/);
      const imageUrl = urlMatch?.[1] ?? urlMatch?.[2] ?? null;

      if (imageUrl && saveToDb && videoId) {
        try {
          const client = getSupabaseClient(true);
          await client.from("key_takeaways_images").upsert({
            video_id: videoId,
            image_url: imageUrl,
            status: "completed",
            error_message: "",
          });
        } catch (e) {
          console.warn(`[Key Takeaways Image] Failed to save: ${e}`);
        }
      }

      return imageUrl;
    } catch (e) {
      console.error(`[Key Takeaways Image] Error: ${e}`);
      return null;
    }
  }
}

// ─── Singleton ────────────────────────────────────────────
let _instance: LLMService | null = null;

export function getLLMService(): LLMService {
  if (!_instance) _instance = new LLMService();
  return _instance;
}

export { LLMService };
