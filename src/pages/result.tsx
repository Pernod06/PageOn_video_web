import { Button, MermaidChart, UserMenu } from "@/components";
import { useLocation, Link, useSearchParams } from "react-router";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  getAllCommentCounts,
  fetchSentenceComments,
  postComment,
  SentenceComment,
} from "@/services/commentService";
import { checkUserLiked, toggleVideoLike, getVideoLikeCount } from "@/services/likeService";
import { checkUserFavorited, toggleFavorite } from "@/services/favoriteService";
import { searchYouTubeDataAPI, type YouTubeSearchResult } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";
// lucide-react icons removed - using inline SVGs and emojis for Nextra style

interface ThemeContentItem {
  content: string;
  timestampStart: string;
}

interface Theme {
  id: string;
  title: string;
  description?: string;
  content: ThemeContentItem[];
  color?: string; // 前端自动分配颜色
}

// ============ V2.0 Structured Article Interfaces ============
interface ArticleMeta {
  title: string;
  tags: string[];
  reading_time: string;
  difficulty: string;
  last_updated: string;
}

interface HeaderHook {
  quote: string;
  author?: string;
}

interface SummaryBox {
  key_insight: string;
  bullet_points: string[];
}

interface BackgroundCard {
  type: string; // "Concept" | "Person" | "Tool"
  name: string;
  description: string;
  icon_hint: string;
}

interface VisualBreak {
  type: string; // "Quote" | "Stat"
  content: string;
}

interface MainBodySection {
  section_title: string;
  content_markdown: string;
  timestamp_ref: string;
  visual_break?: VisualBreak;
  thumbnail_url?: string;
}

interface DeepPoint {
  title: string;
  detailed_explanation: string;
  evidence_quote: string;
}

interface DeepAnalysis {
  mermaid_graph: string;
  deep_points: DeepPoint[];
}

interface QAInteraction {
  question: string;
  answer: string;
  type: string; // "Core Concept" | "Counter-Intuitive"
}

interface Resource {
  name: string;
  type: string; // "Book" | "Paper" | "Link" | "Tool"
}

interface ArticleFooter {
  resources: Resource[];
  actionable_next_steps: string[];
}

interface VisualSummaryChart {
  title?: string;
  ascii_art?: string;
}

// Full V2.0 structured article type (exported for external use)
export interface StructuredArticleV2 {
  meta: ArticleMeta;
  header_hook: HeaderHook;
  summary_box: SummaryBox;
  background_cards: BackgroundCard[];
  main_body: MainBodySection[];
  visual_summary_chart?: VisualSummaryChart; // 可选，兼容老版本
  deep_analysis: DeepAnalysis;
  qa_interactions: QAInteraction[];
  footer: ArticleFooter;
}
// ============ End V2.0 Interfaces ============

interface VideoData {
  // V2.0 Structured Article fields (Only V2.0 format supported)
  videoInfo?: {
    videoId: string;
    title: string;
    description?: string;
    thumbnail?: string;
    summary?: string;
  };
  chapters?: Array<{
    timestamp: number;
    title: string;
    thumbnail_url?: string;
  }>;
  themes?: Theme[];
  meta?: ArticleMeta;
  header_hook?: HeaderHook;
  summary_box?: SummaryBox;
  background_cards?: BackgroundCard[];
  main_body?: MainBodySection[];
  visual_summary_chart?: VisualSummaryChart; // 可选，兼容老版本
  deep_analysis?: DeepAnalysis;
  qa_interactions?: QAInteraction[];
  footer?: ArticleFooter;
  key_takeaways_image_url?: string;
}

// Flashcard Component for Q&A (currently unused)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _FlashCard = ({
  question,
  answer,
  type,
}: {
  question: string;
  answer: string;
  type: string;
}) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className="group h-56 cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
      style={{ perspective: "1000px" }}
    >
      <div
        className="relative h-full w-full transition-transform duration-500"
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front - Question (Dark) */}
        <div
          className="absolute inset-0 flex flex-col rounded-2xl bg-slate-900 p-5 text-white shadow-xl"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-block rounded-full bg-white/10 px-2 py-0.5 text-[10px] tracking-wider text-slate-300 uppercase">
              {type}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <p className="text-sm leading-relaxed font-medium">{question}</p>
          </div>
          {/* <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-slate-500">
            <span>Tap to reveal</span>
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div> */}
        </div>

        {/* Back - Answer (Light) */}
        <div
          className="absolute inset-0 flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="mb-2">
            <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium tracking-wider text-emerald-700 uppercase">
              Answer
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <p className="text-sm leading-relaxed text-slate-700">{answer}</p>
          </div>
          {/* <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
            <span>Tap to flip back</span>
            <svg className="h-4 w-4 rotate-180 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div> */}
        </div>
      </div>
    </div>
  );
};

interface YouTubePlayer {
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  destroy?: () => void;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  likeCount?: number;
  publishedAt?: string;
  avatar?: string;
  published_at?: string;
  like_count?: number;
  reply_count?: number;
}

interface Chapter {
  timestamp: number;
  title: string;
  thumbnail_url?: string;
}

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string, config: unknown) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type TabType = "transcript" | "chat" | "notes";

interface Note {
  id: string;
  sectionId: string;
  sentenceIndex: number;
  contentPreview: string;
  noteText: string;
  createdAt: Date;
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
];

// 时间戳转秒数（工具函数，可以放在组件外）
const parseTimestampToSeconds = (timestamp: string): number => {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
};

// 从消息中提取 clips（工具函数）
const extractClipsFromMessage = (content: string) => {
  // 匹配格式：[06:45 - 07:05] 或 [1:30:00 - 1:45:30]
  const timeRangeRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
  const clips: { startTime: number; endTime: number }[] = [];
  let match;
  while ((match = timeRangeRegex.exec(content)) !== null) {
    clips.push({
      startTime: parseTimestampToSeconds(match[1]), // 捕获组1: 开始时间
      endTime: parseTimestampToSeconds(match[2]), // 捕获组2: 结束时间
    });
  }
  console.log("[extractClips] Found clips:", clips.length, clips);
  return clips;
};

// API配置
// 开发环境和生产环境都使用相对路径（通过代理转发到后端）
// 开发环境: Vite 代理 -> localhost:5500
// 生产环境: Nginx 代理 -> backend:5000
const API_BASE_URL = "";

// 流式请求也通过代理，避免 HTTPS/HTTP 混合问题
const STREAM_API_URL = "";

// 检测是否在扩展环境中运行
const isExtension = import.meta.env.VITE_IS_EXTENSION === "true";

export default function Result() {
  const location = useLocation();
  const { user } = useAuth(); // 获取当前登录用户
  const [searchParams] = useSearchParams();

  // 从 url中获取 videoId
  const paramVideoId = searchParams.get("v");

  const {
    videoId: initialVideoId,
    title,
    chapters: initialChapters = [],
    isExample = false,
    language: initialLanguage = "en",
    videoInfo: initialVideoInfo = null,
    main_body: initialMainBody = null,
    cached = false,
    streamingUrl = null, // 流式分析 URL
  } = (location.state as {
    videoId?: string;
    title?: string;
    chapters?: Chapter[];
    isExample?: boolean;
    language?: string;
    videoInfo?: VideoData["videoInfo"];
    main_body?: VideoData["main_body"];
    cached?: boolean;
    streamingUrl?: string | null;
  }) || {};

  // 如果有 streamingUrl，videoId 从流式分析中获取
  const [videoId, setVideoId] = useState<string | undefined>(
    initialVideoId || paramVideoId || undefined,
  );

  // 添加分享状态
  const [isShareCopied, setIsShareCopied] = useState(false);

  // 语言选择状态
  const [language, setLanguage] = useState<string>(initialLanguage);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Key Takeaways 图像生成状态
  const [imageGenStatus, setImageGenStatus] = useState<{
    status: "pending" | "generating" | "completed" | "failed";
    imageUrl?: string;
    errorMessage?: string;
  } | null>(null);

  // Related YouTube Videos 搜索结果
  const [relatedVideos, setRelatedVideos] = useState<Map<string, YouTubeSearchResult>>(new Map());
  const [isSearchingVideos, setIsSearchingVideos] = useState(false);

  // 流式分析状态
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // 流式增量解析/节流相关 refs（避免每个 chunk 都 JSON.parse 全量内容导致 UI 卡顿）
  const fullStreamContentRef = useRef<string>("");
  const streamChunkAccRef = useRef<string>("");
  const streamFlushRafRef = useRef<number | null>(null);
  const streamParseStateRef = useRef<{
    videoInfoDone: boolean;
    videoInfoStart: number;
  }>({
    videoInfoDone: false,
    videoInfoStart: -1,
  });
  const [activeTab, setActiveTab] = useState<TabType>("transcript");
  const [chatMessages, setChatMessages] = useState([
    { type: "bot", content: "Hello! I'm your video assistant. How can I help you?" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatThinking, setIsChatThinking] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [transcriptData, setTranscriptData] = useState<Array<{ timestamp: string; text: string }>>(
    [],
  );
  const [currentTranscriptIndex, setCurrentTranscriptIndex] = useState<number>(-1);
  const [, setComments] = useState<Comment[]>([]);
  const [, setCommentsLoading] = useState(false);
  const [, setCommentsError] = useState<string | null>(null);
  const [, setChapters] = useState<Chapter[]>(initialChapters);

  // Theme 相关状态
  const [themes, setThemes] = useState<Theme[]>([]);
  const [isLoadingThemes, setIsLoadingThemes] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null); // null = 显示主 sections
  const [themesGenerated, setThemesGenerated] = useState(false); // 是否已生成过 themes

  // Clip 播放列表状态
  const [clipPlaylist, setClipPlaylist] = useState<{
    clips: { startTime: number; endTime: number }[];
    currentIndex: number;
    isPlaying: boolean;
  } | null>(null);

  // Sentence comments state
  const [, setSentenceCommentCounts] = useState<Map<string, number>>(new Map());

  // Selected sentence for sidebar comments (Feishu-style)
  const [selectedSentence, setSelectedSentence] = useState<{
    videoId: string;
    sectionId: string;
    sentenceIndex: number;
    content: string;
  } | null>(null);
  const [, setSidebarComments] = useState<SentenceComment[]>([]);
  const [, setSidebarCommentsLoading] = useState(false);
  const [newSidebarComment, setNewSidebarComment] = useState("");
  const [sidebarAuthorName] = useState("");
  const [, setIsSubmittingSidebarComment] = useState(false);

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNote, setEditingNote] = useState<{
    sectionId: string;
    sentenceIndex: number;
    content: string;
  } | null>(null);
  const [noteInputText, setNoteInputText] = useState("");

  // Copy button state
  const [isCopied, setIsCopied] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);

  // 保存完整的 transcript 文本内容
  const transcriptContent = useRef<string>("");

  const transcriptRefs = useRef<(HTMLDivElement | null)[]>([]);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [youtubeStartTime, setYoutubeStartTime] = useState(0);

  // 增量解析：从 SSE 累积文本中尽量提取已"闭合"的 videoInfo / section 对象
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const flushStreamingUpdates = useCallback(() => {
    streamFlushRafRef.current = null;
    if (!streamChunkAccRef.current) return;

    fullStreamContentRef.current += streamChunkAccRef.current;
    streamChunkAccRef.current = "";

    // 清理 markdown 代码块标记（LLM 可能输出 ```json ... ```）
    let content = fullStreamContentRef.current;
    // 移除开头的 ```json 或 ```
    content = content.replace(/^```json?\s*\n?/, "");
    // 移除结尾的 ```（如果已经完整）
    content = content.replace(/\n?```\s*$/, "");

    // 调试：打印内容前100字符，看看是否正确
    if (content.length < 200) {
      console.log("[Stream] content preview:", content.slice(0, 200));
    }
    const state = streamParseStateRef.current;
    const patch: Partial<VideoData> = {};

    // 1) videoInfo：只要拿到完整的 { ... } 就 parse 一次
    if (!state.videoInfoDone) {
      if (state.videoInfoStart === -1) {
        const idx = content.indexOf('"videoInfo"');
        if (idx !== -1) state.videoInfoStart = idx;
      }
      if (state.videoInfoStart !== -1) {
        const braceStart = content.indexOf("{", state.videoInfoStart);
        if (braceStart !== -1) {
          let depth = 0;
          let inString = false;
          let escape = false;
          for (let i = braceStart; i < content.length; i++) {
            const ch = content[i];
            if (escape) {
              escape = false;
              continue;
            }
            if (ch === "\\\\") {
              if (inString) escape = true;
              continue;
            }
            if (ch === '"') {
              inString = !inString;
              continue;
            }
            if (inString) continue;
            if (ch === "{") depth++;
            if (ch === "}") {
              depth--;
              if (depth === 0) {
                const objStr = content.slice(braceStart, i + 1);
                try {
                  patch.videoInfo = JSON.parse(objStr);
                  state.videoInfoDone = true;
                } catch {
                  // ignore
                }
                break;
              }
            }
          }
        }
      }
    }

    // V2.0: 只解析 videoInfo，完整的 V2.0 JSON 由后端一次性发送
    if (Object.keys(patch).length > 0) {
      console.log("[Stream] 解析到数据:", {
        hasVideoInfo: !!patch.videoInfo,
      });
      setVideoData((prev) => {
        const base: VideoData = prev || {};
        const merged: VideoData = { ...base, ...patch };
        console.log("[Stream] 更新 videoData");
        return merged;
      });
    } else {
      // 调试：看看为什么没有解析到数据
      console.log("[Stream] flush 但无数据:", {
        contentLen: content.length,
        videoInfoDone: state.videoInfoDone,
      });
    }
  }, []);

  // 流式分析视频
  const startStreamingAnalysis = useCallback(
    async (url: string) => {
      console.log("[Result] Starting streaming analysis for:", url);
      setIsStreaming(true);
      setLoading(true);
      setVideoData(null);
      fullStreamContentRef.current = "";
      streamChunkAccRef.current = "";
      streamParseStateRef.current = {
        videoInfoDone: false,
        videoInfoStart: -1,
      };

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(`${STREAM_API_URL}/api/process-video/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
          },
          cache: "no-store",
          body: JSON.stringify({
            url,
            language,
            user_id: user?.id || null, // 传递用户ID用于记录使用次数
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Failed to read response stream");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const payload = line.slice(6);
              if (!payload) continue;

              // 处理特殊标签：[DONE] [CACHED] [ERROR]
              if (payload.startsWith("[DONE]") || payload.startsWith("[CACHED]")) {
                const jsonText = payload.replace(/^\[(DONE|CACHED)\]\s*/, "");
                try {
                  const finalData = JSON.parse(jsonText) as VideoData;
                  console.log("[Result] Streaming complete:", finalData);
                  // 保留可能已经接收到的 key_takeaways_image_url
                  const imageUrl = finalData.key_takeaways_image_url;

                  setVideoData((prev) => ({
                    ...finalData,
                    key_takeaways_image_url: prev?.key_takeaways_image_url || imageUrl,
                  }));

                  // 设置图像生成状态（图像生成现在是阻塞的，URL 会直接包含在 [DONE] 中）
                  if (imageUrl) {
                    setImageGenStatus({
                      status: "completed",
                      imageUrl: imageUrl,
                    });
                  } else {
                    // 如果没有图像 URL，可能是生成失败
                    setImageGenStatus({
                      status: "failed",
                      errorMessage: "图像生成失败或未生成",
                    });
                  }

                  // 更新 videoId（如果还没有设置的话，或者从流式分析中获取到了更准确的信息）
                  if (finalData.videoInfo?.videoId) {
                    setVideoId((prev) => prev || finalData.videoInfo?.videoId);
                  }
                  if (finalData.chapters) {
                    setChapters(finalData.chapters as Chapter[]);
                  }
                  setIsStreaming(false);
                  setLoading(false);
                  // 使用次数已在后端记录
                } catch (e) {
                  console.error("[Result] Failed to parse DONE/CACHED JSON:", e);
                  setIsStreaming(false);
                  setLoading(false);
                  setError("解析最终结果失败");
                }
                continue;
              }

              // 注意：图像 URL 现在直接包含在 [DONE] 消息中，不再需要单独处理 [KEY_TAKEAWAYS_IMAGE] 标签

              if (payload.startsWith("[ERROR]")) {
                const errorMsg = payload.replace(/^\[ERROR\]\s*/, "");
                console.error("[Result] Streaming error:", errorMsg);
                setIsStreaming(false);
                setLoading(false);
                setError(errorMsg || "分析失败");
                continue;
              }

              // 处理结构化事件流 {"type": "video_info" | "delta", ...}
              try {
                const event = JSON.parse(payload);

                if (event.type === "video_info" && event.data) {
                  console.log("[Stream] 收到 video_info 事件:", event.data.title);
                  setVideoData((prev) => ({
                    ...(prev ?? {}),
                    videoInfo: event.data,
                  }));
                  // 更新 videoId（如果还没有设置的话）
                  setVideoId((prev) => prev || event.data.videoId);
                  continue;
                }

                // 处理 delta 事件：累积内容并尝试增量解析
                if (event.type === "delta" && event.content) {
                  fullStreamContentRef.current += event.content;

                  // 尝试增量解析 V2.0 结构
                  const content = fullStreamContentRef.current;

                  // 清理可能的 markdown 代码块
                  const cleanContent = content
                    .replace(/^```json?\s*\n?/, "")
                    .replace(/\n?```\s*$/, "");

                  // 辅助函数：提取完整的 JSON 对象
                  const extractJsonObject = (str: string, key: string): unknown | null => {
                    const keyMatch = str.match(new RegExp(`"${key}"\\s*:\\s*\\{`));
                    if (!keyMatch) return null;

                    const startIdx = keyMatch.index! + keyMatch[0].length - 1;
                    let depth = 0;
                    let inString = false;
                    let escape = false;

                    for (let i = startIdx; i < str.length; i++) {
                      const ch = str[i];
                      if (escape) {
                        escape = false;
                        continue;
                      }
                      if (ch === "\\") {
                        if (inString) escape = true;
                        continue;
                      }
                      if (ch === '"') {
                        inString = !inString;
                        continue;
                      }
                      if (inString) continue;
                      if (ch === "{") depth++;
                      if (ch === "}") {
                        depth--;
                        if (depth === 0) {
                          try {
                            return JSON.parse(str.slice(startIdx, i + 1));
                          } catch {
                            return null;
                          }
                        }
                      }
                    }
                    return null;
                  };

                  // 增量更新各字段
                  setVideoData((prev) => {
                    const updates: Partial<VideoData> = {};
                    let hasUpdates = false;

                    // 解析 meta
                    if (!prev?.meta) {
                      const meta = extractJsonObject(cleanContent, "meta") as ArticleMeta | null;
                      if (meta) {
                        updates.meta = meta;
                        hasUpdates = true;
                        console.log("[Stream] 📝 解析到 meta:", meta.title);
                      }
                    }

                    // 解析 header_hook
                    if (!prev?.header_hook) {
                      const headerHook = extractJsonObject(
                        cleanContent,
                        "header_hook",
                      ) as HeaderHook | null;
                      if (headerHook) {
                        updates.header_hook = headerHook;
                        hasUpdates = true;
                        console.log("[Stream] 📝 解析到 header_hook");
                      }
                    }

                    // 解析 summary_box
                    if (!prev?.summary_box) {
                      const summaryBox = extractJsonObject(
                        cleanContent,
                        "summary_box",
                      ) as SummaryBox | null;
                      if (summaryBox) {
                        updates.summary_box = summaryBox;
                        hasUpdates = true;
                        console.log("[Stream] 📝 解析到 summary_box");
                      }
                    }

                    // 解析 main_body sections
                    const mainBodyMatch = cleanContent.match(/"main_body"\s*:\s*\[/);
                    if (mainBodyMatch) {
                      const startIdx = mainBodyMatch.index! + mainBodyMatch[0].length - 1;
                      let depth = 0;
                      let inString = false;
                      let escape = false;
                      let sectionStart = -1;
                      const sections: MainBodySection[] = [];

                      for (let i = startIdx; i < cleanContent.length; i++) {
                        const ch = cleanContent[i];
                        if (escape) {
                          escape = false;
                          continue;
                        }
                        if (ch === "\\") {
                          if (inString) escape = true;
                          continue;
                        }
                        if (ch === '"') {
                          inString = !inString;
                          continue;
                        }
                        if (inString) continue;

                        if (ch === "{") {
                          if (depth === 1 && sectionStart === -1) sectionStart = i;
                          depth++;
                        }
                        if (ch === "}") {
                          depth--;
                          if (depth === 1 && sectionStart !== -1) {
                            try {
                              const section = JSON.parse(
                                cleanContent.slice(sectionStart, i + 1),
                              ) as MainBodySection;
                              sections.push(section);
                            } catch {
                              /* section 不完整 */
                            }
                            sectionStart = -1;
                          }
                        }
                        if (ch === "[") depth++;
                        if (ch === "]") {
                          depth--;
                          if (depth === 0) break;
                        }
                      }

                      const currentSections = prev?.main_body?.length || 0;
                      if (sections.length > currentSections) {
                        updates.main_body = sections;
                        hasUpdates = true;
                        console.log(
                          `[Stream] 📝 解析到 ${sections.length} 个 sections (新增 ${sections.length - currentSections})`,
                        );
                      }
                    }

                    if (hasUpdates) {
                      return { ...(prev ?? {}), ...updates };
                    }
                    return prev;
                  });

                  continue;
                }
              } catch {
                // 不是结构化事件，忽略
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          console.log("[Result] Streaming aborted");
          return;
        }
        console.error("[Result] Streaming error:", err);
        setIsStreaming(false);
        setLoading(false);
        setError(err instanceof Error ? err.message : "分析失败");
      }
    },
    [language, user?.id],
  );

  // 记录是否已经完成流式分析后的初始化
  const playerInitializedRef = useRef(false);
  // 存储从 streamingUrl 提取的 videoId，用于立即初始化播放器
  const extractedVideoIdRef = useRef<string | null>(null);

  // 从 URL 中提取 videoId 的工具函数
  const extractVideoIdFromUrl = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes("youtube.com") || urlObj.hostname.includes("youtu.be")) {
        // 处理 youtube.com/watch?v=xxx 格式
        if (urlObj.pathname === "/watch") {
          return urlObj.searchParams.get("v");
        }
        // 处理 youtu.be/xxx 格式
        if (urlObj.hostname.includes("youtu.be")) {
          return urlObj.pathname.slice(1);
        }
        // 处理 youtube.com/shorts/xxx 格式
        if (urlObj.pathname.startsWith("/shorts/")) {
          return urlObj.pathname.replace("/shorts/", "");
        }
      }
      return null;
    } catch {
      // 如果 URL 解析失败，尝试正则表达式
      const match = url.match(/(?:watch\?v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
      return match ? match[1] : null;
    }
  };

  useEffect(() => {
    // 如果有 streamingUrl，先从 URL 中提取 videoId，立即初始化播放器和加载 transcript
    if (streamingUrl) {
      const extractedVideoId = extractVideoIdFromUrl(streamingUrl);

      if (extractedVideoId) {
        console.log("[Result] Extracted videoId from streamingUrl:", extractedVideoId);

        // 存储到 ref 中，以便立即使用
        extractedVideoIdRef.current = extractedVideoId;

        // 立即设置 videoId，以便显示视频窗口
        setVideoId(extractedVideoId);

        // 立即初始化播放器和加载 transcript（只执行一次）
        if (!playerInitializedRef.current) {
          playerInitializedRef.current = true;
          console.log("[Result] 🎬 Initializing player and loading transcript immediately");
          setPlayerReady(false);

          // 使用提取的 videoId 直接初始化，不依赖 state
          // 先加载 transcript
          loadTranscript(extractedVideoId, false).catch((err) => {
            console.error("[Result] Failed to load transcript:", err);
          });

          if (isExample) {
            loadChapters(extractedVideoId);
          }

          // 初始化播放器
          // 对于扩展模式，iframe 会自动加载，不需要延迟
          // 对于 web 模式，需要等待 videoId state 更新
          if (isExtension) {
            initializeYouTubePlayer();
          } else {
            setTimeout(() => {
              initializeYouTubePlayer();
            }, 100);
          }
        }
      } else {
        console.warn("[Result] Could not extract videoId from streamingUrl:", streamingUrl);
      }

      // 同时启动流式分析（不阻塞视频和 transcript 的显示）
      if (!abortControllerRef.current) {
        console.log("[Result] 📊 Starting streaming analysis in background for URL:", streamingUrl);
        startStreamingAnalysis(streamingUrl);
      }

      return () => {
        abortControllerRef.current?.abort();
      };
    }

    // 原有逻辑：使用 videoId 加载数据（仅在非流式模式下）
    if (videoId && !streamingUrl) {
      console.log(
        "[Result] Component mounted with videoId:",
        videoId,
        "isExample:",
        isExample,
        "cached:",
        cached,
      );

      // 存储 videoId 到 ref（用于播放器初始化）
      if (!extractedVideoIdRef.current) {
        extractedVideoIdRef.current = videoId;
      }

      setPlayerReady(false); // 重置 player ready 状态

      // 如果有从 index.tsx 传过来的完整数据（翻译后的缓存数据），直接使用
      if (initialMainBody && initialVideoInfo) {
        console.log("[Result] ✅ Using pre-loaded data from navigation state (translated)");
        setVideoData({
          videoInfo: initialVideoInfo,
          main_body: initialMainBody,
        });
        setLoading(false);
      } else {
        // Load all data - 示例视频优先使用本地缓存
        loadVideoData(videoId, isExample, language);
      }

      loadTranscript(videoId, isExample);
      if (isExample) {
        loadChapters(videoId); // 示例视频加载本地 chapters
      }
      // else {
      //   loadComments(videoId, 20); // 非示例视频加载评论 - 已禁用
      // }

      // 初始化播放器（只执行一次）
      if (!playerInitializedRef.current) {
        playerInitializedRef.current = true;
        initializeYouTubePlayer();
      }
    } else if (!streamingUrl && !videoId) {
      console.warn("[Result] No videoId or streamingUrl provided");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExample, streamingUrl]); // 移除 videoId 依赖，避免流式分析完成后重复触发

  // 图像生成状态管理（现在图像生成是阻塞的，URL 会直接包含在 [DONE] 消息中）
  useEffect(() => {
    if (!videoId || !videoData?.summary_box?.bullet_points) return;

    // 如果已经有图像 URL，设置为完成状态
    if (videoData.key_takeaways_image_url) {
      setImageGenStatus({
        status: "completed",
        imageUrl: videoData.key_takeaways_image_url,
      });
    } else {
      // 如果没有图像 URL，可能是生成失败或未生成
      // 如果流式分析已完成，检查是否有图像生成失败的情况
      if (!isStreaming) {
        // 可以可选地查询一次数据库确认状态，但通常不需要
        // 因为图像生成现在是阻塞的，如果没有 URL 就说明生成失败或未生成
        setImageGenStatus({
          status: "failed",
          errorMessage: "图像生成失败或未生成",
        });
      }
    }
  }, [
    videoId,
    videoData?.summary_box?.bullet_points,
    videoData?.key_takeaways_image_url,
    isStreaming,
  ]);

  // 搜索相关 YouTube 视频
  useEffect(() => {
    if (!videoData?.footer?.resources || videoData.footer.resources.length === 0) {
      return;
    }

    const searchRelatedVideos = async () => {
      setIsSearchingVideos(true);
      const newVideos = new Map<string, YouTubeSearchResult>();

      // 为每个 resource 搜索相关视频
      for (const res of videoData.footer?.resources || []) {
        if (!res.name || res.name.trim() === "") continue;

        try {
          console.log(`[Related Videos] Searching for: ${res.name}`);
          const response = await searchYouTubeDataAPI(res.name, {
            limit: 1, // 只取第一个结果
            order: "viewCount",
            duration: "any",
            time_filter: undefined,
          });

          if (response.success && response.results.length > 0) {
            newVideos.set(res.name, response.results[0]);
            console.log(
              `[Related Videos] Found video for "${res.name}":`,
              response.results[0].title,
            );
          } else {
            console.log(`[Related Videos] No results for "${res.name}"`);
          }
        } catch (error) {
          console.error(`[Related Videos] Error searching for "${res.name}":`, error);
        }
      }

      setRelatedVideos(newVideos);
      setIsSearchingVideos(false);
    };

    searchRelatedVideos();
  }, [videoData?.footer?.resources]);

  // 处理语言切换
  const handleLanguageChange = async (newLanguage: string) => {
    if (newLanguage === language || !videoId) {
      setShowLangMenu(false);
      return;
    }

    setIsTranslating(true);
    setShowLangMenu(false);
    setLanguage(newLanguage);

    try {
      // 重新加载视频数据（翻译版本）
      console.log("[Result] 🌐 Language change: loading translated data for:", newLanguage);
      await loadVideoData(videoId, false, newLanguage);
      console.log(
        "[Result] 🌐 Language change: data loaded, current videoData title:",
        videoData?.videoInfo?.title,
      );

      // 翻译现有的 themes（如果有的话）
      if (themes.length > 0) {
        console.log("[Result] Translating themes to:", newLanguage);
        const response = await fetch(`${STREAM_API_URL}/api/translate-themes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            themes: themes.map((t) => ({ ...t, color: undefined })), // 移除 color 避免翻译
            language: newLanguage,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.themes) {
            // 恢复颜色
            const translatedThemes = data.themes.map((t: Theme, index: number) => ({
              ...t,
              color: themes[index]?.color || THEME_COLORS[index % THEME_COLORS.length],
            }));
            setThemes(translatedThemes);
            console.log("[Result] ✅ Translated", translatedThemes.length, "themes");
          }
        }
      }
    } catch (error) {
      console.error("[Result] Failed to translate content:", error);
      setError("翻译失败，请重试");
    } finally {
      setIsTranslating(false);
    }
  };

  // 点击外部关闭语言菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showLangMenu && !target.closest(".language-selector")) {
        setShowLangMenu(false);
      }
    };

    if (showLangMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showLangMenu]);

  // Load comment counts when video data is ready
  useEffect(() => {
    const loadCommentCounts = async () => {
      if (!videoId || !videoData?.main_body) return;

      // Load comment counts for all sentences
      const counts = await getAllCommentCounts(videoId);
      setSentenceCommentCounts(counts);
      console.log("[Result] Loaded comment counts:", counts.size, "sentences with comments");
    };

    loadCommentCounts();
  }, [videoId, videoData?.main_body]);

  // Load like status and count when video is ready
  useEffect(() => {
    const loadLikeStatus = async () => {
      if (!videoId) return;

      // Get like count
      const count = await getVideoLikeCount(videoId);
      setLikeCount(count);

      // Check if user has liked (only if logged in)
      if (user?.id) {
        const liked = await checkUserLiked(videoId, user.id);
        setIsLiked(liked);
      }
    };

    loadLikeStatus();
  }, [videoId, user?.id]);

  // Load favorite status when video is ready
  useEffect(() => {
    const loadFavoriteStatus = async () => {
      if (!videoId || !user?.id) {
        setIsFavorited(false);
        return;
      }

      const favorited = await checkUserFavorited(videoId, user.id);
      setIsFavorited(favorited);
    };

    loadFavoriteStatus();
  }, [videoId, user?.id]);

  // Handle like button click
  const handleLikeClick = async () => {
    if (!videoId) return;

    if (!user) {
      // User not logged in, show a message or prompt login
      alert("Please sign in to like videos");
      return;
    }

    setIsLikeLoading(true);
    try {
      const result = await toggleVideoLike(videoId, user.id);
      setIsLiked(result.liked);
      setLikeCount(result.likeCount);
    } catch (err) {
      console.error("[Result] Error toggling like:", err);
    } finally {
      setIsLikeLoading(false);
    }
  };

  // Handle favorite button click
  const handleFavoriteClick = async () => {
    if (!videoId) return;

    if (!user) {
      // User not logged in, show a message or prompt login
      alert("Please sign in to save videos");
      return;
    }

    setIsFavoriteLoading(true);
    try {
      const success = await toggleFavorite(videoId, user.id);
      if (success) {
        // Toggle the local state
        setIsFavorited((prev) => !prev);
      } else {
        console.error("[Result] Failed to toggle favorite");
      }
    } catch (err) {
      console.error("[Result] Error toggling favorite:", err);
    } finally {
      setIsFavoriteLoading(false);
    }
  };

  // Clip 播放列表监听器：自动切换到下一个 clip
  useEffect(() => {
    if (!clipPlaylist || !clipPlaylist.isPlaying || !player || !playerReady) return;

    const checkProgress = setInterval(() => {
      try {
        const currentTime = player.getCurrentTime();
        const currentClip = clipPlaylist.clips[clipPlaylist.currentIndex];

        // 如果当前时间超过了当前 clip 的结束时间
        if (currentTime >= currentClip.endTime - 0.5) {
          const nextIndex = clipPlaylist.currentIndex + 1;

          if (nextIndex < clipPlaylist.clips.length) {
            // 跳转到下一个 clip
            console.log("[Clips] Playing clip", nextIndex + 1, "/", clipPlaylist.clips.length);

            const nextClip = clipPlaylist.clips[nextIndex];
            // 先跳转视频，再更新状态
            if (player.seekTo) {
              player.seekTo(nextClip.startTime, true);
              player.playVideo();
            }

            // 使用 setTimeout 延迟状态更新，避免 React 渲染冲突
            setTimeout(() => {
              setClipPlaylist((prev) => (prev ? { ...prev, currentIndex: nextIndex } : null));
            }, 50);
          } else {
            // 所有 clips 播放完毕
            console.log("[Clips] Playback complete");
            setClipPlaylist((prev) => (prev ? { ...prev, isPlaying: false } : null));
          }
        }
      } catch {
        // player 可能还没准备好
      }
    }, 500);

    return () => clearInterval(checkProgress);
  }, [clipPlaylist, player, playerReady]);

  // Load sidebar comments when selected sentence changes
  useEffect(() => {
    const loadSidebarComments = async () => {
      if (!selectedSentence) {
        setSidebarComments([]);
        return;
      }

      setSidebarCommentsLoading(true);
      try {
        const comments = await fetchSentenceComments(
          selectedSentence.videoId,
          selectedSentence.sectionId,
          selectedSentence.sentenceIndex,
        );
        setSidebarComments(comments);
      } catch (err) {
        console.error("[Result] Failed to load sidebar comments:", err);
        setSidebarComments([]);
      } finally {
        setSidebarCommentsLoading(false);
      }
    };

    loadSidebarComments();
  }, [selectedSentence]);

  // Handle sentence selection for sidebar comments (currently unused)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleSentenceSelect = useCallback(
    (
      info: {
        videoId: string;
        sectionId: string;
        sentenceIndex: number;
        content: string;
      } | null,
    ) => {
      setSelectedSentence(info);
      setNewSidebarComment("");
    },
    [],
  );

  // Handle submitting a new comment from sidebar (currently unused)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleSubmitSidebarComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSidebarComment.trim() || !selectedSentence) return;

    setIsSubmittingSidebarComment(true);
    try {
      const posted = await postComment(
        selectedSentence.videoId,
        selectedSentence.sectionId,
        selectedSentence.sentenceIndex,
        selectedSentence.content,
        sidebarAuthorName || "Anonymous",
        newSidebarComment.trim(),
      );

      if (posted) {
        setSidebarComments((prev) => [...prev, posted]);
        setNewSidebarComment("");
        // Update the comment count
        const commentKey = `${selectedSentence.sectionId}-${selectedSentence.sentenceIndex}`;
        setSentenceCommentCounts((prev) => {
          const newMap = new Map(prev);
          newMap.set(commentKey, (prev.get(commentKey) || 0) + 1);
          return newMap;
        });
      }
    } catch (err) {
      console.error("[Result] Failed to post sidebar comment:", err);
    } finally {
      setIsSubmittingSidebarComment(false);
    }
  };

  // Handle double-click on sentence to create/edit note (currently unused)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleSentenceDoubleClick = useCallback(
    (info: { sectionId: string; sentenceIndex: number; content: string }) => {
      // Check if there's already a note for this sentence
      const existingNote = notes.find(
        (n) => n.sectionId === info.sectionId && n.sentenceIndex === info.sentenceIndex,
      );

      setEditingNote(info);
      setNoteInputText(existingNote?.noteText || "");
      setActiveTab("notes");
    },
    [notes],
  );

  // Save note
  const handleSaveNote = useCallback(() => {
    if (!editingNote || !noteInputText.trim()) return;

    const existingNoteIndex = notes.findIndex(
      (n) => n.sectionId === editingNote.sectionId && n.sentenceIndex === editingNote.sentenceIndex,
    );

    if (existingNoteIndex >= 0) {
      // Update existing note
      setNotes((prev) =>
        prev.map((n, i) =>
          i === existingNoteIndex ? { ...n, noteText: noteInputText.trim() } : n,
        ),
      );
    } else {
      // Create new note
      const newNote: Note = {
        id: `note-${Date.now()}`,
        sectionId: editingNote.sectionId,
        sentenceIndex: editingNote.sentenceIndex,
        contentPreview: editingNote.content.slice(0, 100),
        noteText: noteInputText.trim(),
        createdAt: new Date(),
      };
      setNotes((prev) => [...prev, newNote]);
    }

    setEditingNote(null);
    setNoteInputText("");
  }, [editingNote, noteInputText, notes]);

  // Delete note
  const handleDeleteNote = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  // Cancel note editing
  const handleCancelNote = useCallback(() => {
    setEditingNote(null);
    setNoteInputText("");
  }, []);

  // 加载本地 chapters 数据（用于示例视频）
  const loadChapters = async (id: string) => {
    try {
      console.log("[Result] 📂 Loading chapters from local cache for:", id);
      const response = await fetch(`/data/chapter/chapters_${id}.json`);

      if (response.ok) {
        const data = await response.json();
        // JSON 结构: { video_id, video_title, chapters: [...] } 或直接是数组
        const chaptersArray = Array.isArray(data) ? data : data.chapters;
        if (chaptersArray && chaptersArray.length > 0) {
          console.log("[Result] ✅ Chapters loaded:", chaptersArray.length, "chapters");
          setChapters(chaptersArray);
        } else {
          console.log("[Result] ⚠️ No chapters in data for:", id);
        }
      } else {
        console.log("[Result] ⚠️ No local chapters found for:", id);
      }
    } catch (error) {
      console.error("[Result] ❌ Failed to load chapters:", error);
    }
  };

  const loadTranscript = async (id: string, useLocalCache: boolean = false) => {
    if (!id) {
      console.warn("[Result] Cannot load transcript: no video ID provided");
      setTranscriptData([]);
      return;
    }

    console.log("[Result] Loading transcript for:", id, "useLocalCache:", useLocalCache);

    // 如果是示例视频，优先使用本地缓存
    if (useLocalCache) {
      try {
        console.log("[Result] 📂 Loading transcript from local cache");
        const localResponse = await fetch(`/data/transcript/transcript_${id}.txt`);

        if (localResponse.ok) {
          const text = await localResponse.text();
          console.log("[Result] ✅ Local transcript loaded, length:", text.length);
          transcriptContent.current = text;
          const parsed = parseTranscript(text);
          setTranscriptData(parsed);
          return;
        }
      } catch (localError) {
        console.error("[Result] ❌ Local cache failed:", localError);
      }
    }

    // Try to load from backend API
    try {
      const url = `${API_BASE_URL}/api/transcript/${id}`;
      console.log("[Result] Attempting API:", url);
      const response = await fetch(url);

      if (response.ok) {
        const text = await response.text();
        console.log("[Result] API response text length:", text.length);
        transcriptContent.current = text;
        const parsed = parseTranscript(text);
        setTranscriptData(parsed);
        console.log("[Result] ✅ Transcript loaded from API, entries:", parsed.length);
        return;
      } else {
        console.warn("[Result] API returned status:", response.status);
        // 如果 API 返回错误，继续尝试 fallback
      }
    } catch (apiError) {
      console.error("[Result] ❌ API failed:", apiError);
      // API 失败，继续尝试 fallback
    }

    // Fallback: load from local file
    try {
      console.log("[Result] Attempting local fallback: /data/transcript/transcript_" + id + ".txt");
      const localResponse = await fetch(`/data/transcript/transcript_${id}.txt`);

      if (localResponse.ok) {
        const text = await localResponse.text();
        transcriptContent.current = text;
        const parsed = parseTranscript(text);
        setTranscriptData(parsed);
        console.log("[Result] ✅ Local transcript loaded, entries:", parsed.length);
      } else {
        console.error("[Result] ❌ Local file not found, status:", localResponse.status);
        // 所有方法都失败，设置空数组避免一直显示 loading
        setTranscriptData([]);
      }
    } catch (localError) {
      console.error("[Result] ❌ Failed to load local transcript:", localError);
      // 所有方法都失败，设置空数组避免一直显示 loading
      setTranscriptData([]);
    }
  };

  // 辅助函数：将时间戳 "MM:SS" 转换为秒数
  const parseTimestamp = (timestamp: string): number => {
    const parts = timestamp.split(":");
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    return minutes * 60 + seconds;
  };

  const parseTranscript = (text: string): Array<{ timestamp: string; text: string }> => {
    const lines = text.split("\n");

    // Step 1: Extract all text with timestamps
    interface TextSegment {
      timestamp: string;
      text: string;
    }
    const segments: TextSegment[] = [];
    let currentTimestamp = "";

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip header lines and empty lines
      if (line.includes("====") || (!line.includes("[") && segments.length === 0) || !trimmedLine) {
        continue;
      }

      // Match lines with timestamps like [00:00] or [00:00] - text
      const timestampMatch = line.match(/\[(\d{2}:\d{2})\]\s*-?\s*(.*)/);

      if (timestampMatch) {
        currentTimestamp = timestampMatch[1];
        const textContent = timestampMatch[2].trim();
        if (textContent) {
          segments.push({ timestamp: currentTimestamp, text: textContent });
        }
      } else if (trimmedLine && currentTimestamp) {
        // Remove leading "|-" or "-"
        const cleanedLine = trimmedLine.replace(/^[-|]\s*/, "");
        if (cleanedLine) {
          segments.push({ timestamp: currentTimestamp, text: cleanedLine });
        }
      }
    }

    // Step 2: Combine segments into complete sentences based on punctuation and time gaps
    const entries: Array<{ timestamp: string; text: string }> = [];
    let sentenceTimestamp = "";
    let sentenceText = "";
    const TIME_GAP_THRESHOLD = 3; // 如果时间间隔超过3秒，强制分割

    console.log("[Result] Starting sentence combination, segments:", segments.length);

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // 检查时间戳间隔 - 如果间隔太大，强制结束当前句子
      if (sentenceText && sentenceTimestamp) {
        const prevTime = parseTimestamp(sentenceTimestamp);
        const currentTime = parseTimestamp(segment.timestamp);
        const timeDiff = currentTime - prevTime;

        // 如果时间间隔超过阈值，强制分割句子
        if (timeDiff > TIME_GAP_THRESHOLD) {
          entries.push({
            timestamp: sentenceTimestamp,
            text: sentenceText.trim(),
          });

          // 重置，准备开始新句子
          sentenceText = "";
          sentenceTimestamp = "";
        }
      }

      // If starting a new sentence, record the timestamp
      if (!sentenceText) {
        sentenceTimestamp = segment.timestamp;
      }

      // Add text to current sentence
      if (sentenceText) {
        sentenceText += " " + segment.text;
      } else {
        sentenceText = segment.text;
      }

      // Check if sentence ends with sentence-ending punctuation
      // Only . ! ? ... 。！？ are sentence endings, NOT comma (,)
      const endsWithPeriod = /[.!?。！？]\s*$/.test(sentenceText);
      const endsWithEllipsis = /\.\.\.\s*$/.test(sentenceText);

      if (endsWithPeriod || endsWithEllipsis) {
        // Complete sentence found
        entries.push({
          timestamp: sentenceTimestamp,
          text: sentenceText.trim(),
        });

        // Reset for next sentence
        sentenceText = "";
        sentenceTimestamp = "";
      }
    }

    // Add any remaining text as the last entry
    if (sentenceText) {
      entries.push({
        timestamp: sentenceTimestamp,
        text: sentenceText.trim(),
      });
    }

    console.log("[Result] Parsed transcript entries:", entries.length);
    console.log("[Result] Sample sentences (first 5):");
    entries.slice(0, 5).forEach((entry, idx) => {
      console.log(`  ${idx + 1}. [${entry.timestamp}] ${entry.text}`);
    });

    // Debug: Find the "power plant" sentence
    const powerPlantEntry = entries.find((e) => e.text.includes("at a power plant"));
    if (powerPlantEntry) {
      console.log("[Result] Power plant sentence:", powerPlantEntry);
    }

    return entries;
  };

  const initializeYouTubePlayer = () => {
    if (isExtension) {
      // 扩展模式：使用沙盒 iframe
      console.log("[Result] Extension mode: using sandboxed player");
      // 沙盒播放器通过 postMessage 通信，在 useEffect 中设置监听
      // 扩展模式下，iframe 会自动加载，所以立即设置为 ready
      setPlayerReady(true);
      return;
    }

    // 普通 web 模式：使用 YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        createPlayer();
      };
    } else {
      createPlayer();
    }
  };

  const createPlayer = () => {
    const YT = window.YT;
    if (YT && YT.Player) {
      // 使用当前的 videoId（优先使用 ref 中的值，因为它是从 streamingUrl 提取的，更可靠）
      const currentVideoId = extractedVideoIdRef.current || videoId || paramVideoId;
      if (!currentVideoId) {
        console.warn("[Result] Cannot create player: no videoId available");
        return;
      }

      // 检查是否已经存在播放器，如果存在先销毁
      if (player && player.destroy) {
        try {
          player.destroy();
        } catch (e) {
          console.warn("[Result] Error destroying existing player:", e);
        }
      }

      const newPlayer = new YT.Player("youtube-player", {
        videoId: currentVideoId,
        playerVars: {
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            console.log("[Result] YouTube player ready");
            setPlayerReady(true);
          },
          onError: (event: { data: number }) => {
            console.error("[Result] YouTube player error:", event.data);
            setError(`播放器错误: ${event.data}`);
          },
        },
      });
      setPlayer(newPlayer);
      console.log("[Result] YouTube player initialized with videoId:", currentVideoId);
    } else {
      console.warn("[Result] YouTube API not available yet");
    }
  };

  const scrollToTranscript = useCallback(
    (index: number) => {
      // Only scroll if Transcript tab is active
      if (activeTab !== "transcript") {
        console.log("[Result] Skip scroll - tab not active");
        return;
      }

      const element = transcriptRefs.current[index];
      const container = transcriptContainerRef.current;

      if (element && container) {
        try {
          // Get element and container positions
          const elementRect = element.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          // Calculate the element's position relative to the container
          const relativeTop = elementRect.top - containerRect.top;

          // Current scroll position
          const currentScroll = container.scrollTop;

          // Calculate new scroll position to center the element
          const containerHeight = container.clientHeight;
          const targetScroll = currentScroll + relativeTop - containerHeight / 2;

          console.log(
            "[Result] Scrolling transcript container to index:",
            index,
            "position:",
            targetScroll,
          );

          // Scroll within the container only (NOT the whole page)
          container.scrollTo({
            top: targetScroll,
            behavior: "smooth",
          });
        } catch (err) {
          console.error("[Result] Scroll error:", err);
        }
      } else {
        console.log("[Result] Skip scroll - element or container not found");
      }
    },
    [activeTab],
  );

  const updateCurrentTranscript = useCallback(
    (currentTimeInSeconds: number) => {
      if (transcriptData.length === 0) return;

      // Convert transcript timestamps to seconds and find the current one
      for (let i = transcriptData.length - 1; i >= 0; i--) {
        const timestamp = transcriptData[i].timestamp;
        const parts = timestamp.split(":").map(Number);
        let transcriptSeconds = 0;

        if (parts.length === 2) {
          transcriptSeconds = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
          transcriptSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }

        // If current time is past this transcript entry, highlight it
        if (currentTimeInSeconds >= transcriptSeconds) {
          setCurrentTranscriptIndex((prev) => {
            if (prev !== i) {
              scrollToTranscript(i);
              return i;
            }
            return prev;
          });
          break;
        }
      }
    },
    [transcriptData, scrollToTranscript],
  );

  // Track video time updates (web mode)
  useEffect(() => {
    if (isExtension) return; // 扩展模式下使用 postMessage
    if (!player || !playerReady || transcriptData.length === 0) return;

    console.log("[Result] Starting time tracking with", transcriptData.length, "entries");

    const interval = setInterval(() => {
      if (player && playerReady && player.getCurrentTime) {
        try {
          const currentTime = player.getCurrentTime();
          updateCurrentTranscript(currentTime);
        } catch (err) {
          console.error("[Result] Error getting current time:", err);
        }
      }
    }, 500);

    return () => {
      clearInterval(interval);
      console.log("[Result] Stopped time tracking");
    };
  }, [player, playerReady, transcriptData, updateCurrentTranscript]);

  // 扩展模式：直接使用 YouTube iframe embed，无需沙盒
  // 时间跳转通过更新 youtubeStartTime state 实现

  const parseMessageWithTimestamp = (content: string) => {
    // 匹配多种时间戳格式:
    // 1. 📎 [06:45 - 07:05] 时间范围格式
    // 2. [MM:SS] 或 [HH:MM:SS] 单个时间戳格式
    const timeRangeRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
    const singleTimestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;

    const parts: Array<{
      type: "text" | "timestamp" | "timeRange";
      content: string;
      startTime?: string;
      endTime?: string;
      fullMatch?: string;
    }> = [];

    // 先处理时间范围格式
    const rangeMatches: Array<{
      index: number;
      length: number;
      startTime: string;
      endTime: string;
      fullMatch: string;
    }> = [];
    let rangeMatch;

    while ((rangeMatch = timeRangeRegex.exec(content)) !== null) {
      rangeMatches.push({
        index: rangeMatch.index,
        length: rangeMatch[0].length,
        startTime: rangeMatch[1],
        endTime: rangeMatch[2],
        fullMatch: rangeMatch[0],
      });
    }

    // 处理单个时间戳（排除已经在时间范围中的）
    const singleMatches: Array<{ index: number; length: number; time: string; fullMatch: string }> =
      [];
    let singleMatch;

    while ((singleMatch = singleTimestampRegex.exec(content)) !== null) {
      // 检查是否在时间范围内
      const isInRange = rangeMatches.some(
        (r) => singleMatch!.index >= r.index && singleMatch!.index < r.index + r.length,
      );
      if (!isInRange) {
        singleMatches.push({
          index: singleMatch.index,
          length: singleMatch[0].length,
          time: singleMatch[1],
          fullMatch: singleMatch[0],
        });
      }
    }

    // 合并并排序所有匹配
    const allMatches = [
      ...rangeMatches.map((m) => ({ ...m, type: "timeRange" as const })),
      ...singleMatches.map((m) => ({ ...m, type: "timestamp" as const })),
    ].sort((a, b) => a.index - b.index);

    console.log(
      "[Parse] Found",
      rangeMatches.length,
      "time ranges,",
      singleMatches.length,
      "single timestamps",
    );

    let lastIndex = 0;

    for (const match of allMatches) {
      // 添加匹配之前的文本
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: content.substring(lastIndex, match.index),
        });
      }

      if (match.type === "timeRange") {
        parts.push({
          type: "timeRange",
          content: `${match.startTime} - ${match.endTime}`,
          startTime: match.startTime,
          endTime: match.endTime,
          fullMatch: match.fullMatch,
        });
      } else {
        parts.push({
          type: "timestamp",
          content: match.time,
          fullMatch: match.fullMatch,
        });
      }

      lastIndex = match.index + match.length;
    }

    // 添加剩余文本
    if (lastIndex < content.length) {
      parts.push({
        type: "text",
        content: content.substring(lastIndex),
      });
    }

    return parts;
  };

  const jumpToTimestamp = (timestamp: string) => {
    // Convert timestamp (MM:SS or HH:MM:SS) to seconds
    const parts = timestamp.split(":").map(Number);
    let seconds = 0;

    if (parts.length === 2) {
      // MM:SS format
      seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // HH:MM:SS format
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    console.log("[Result] Jumping to timestamp:", timestamp, "=", seconds, "seconds");

    if (isExtension) {
      // 扩展模式：通过更新 iframe src 来跳转时间
      console.log("[Result] Extension mode: seeking to", seconds, "seconds");
      setYoutubeStartTime(seconds);
    } else {
      // Web 模式：直接调用 player API
      if (player && playerReady && player.seekTo) {
        player.seekTo(seconds, true);
        player.playVideo();
      } else {
        console.warn("[Result] Player not ready, cannot seek. Ready:", playerReady);
      }
    }
  };

  // Helper: Render text with clickable sentences (timestamps hidden)
  // Text before [MM:SS] becomes clickable, timestamp is hidden
  // 处理富文本节点，将整个句子高亮，并正确处理标点符号位置
  const processClickableChildren = (children: React.ReactNode, jumpFn: (ts: string) => void) => {
    // 1. 合并文本节点 (防止 React 将文本切碎导致正则失效)
    const rawNodes = React.Children.toArray(children);
    const mergedNodes: React.ReactNode[] = [];
    rawNodes.forEach((node) => {
      const lastNode = mergedNodes[mergedNodes.length - 1];
      if (typeof node === "string" && typeof lastNode === "string") {
        mergedNodes[mergedNodes.length - 1] = lastNode + node;
      } else {
        mergedNodes.push(node);
      }
    });

    const result: React.ReactNode[] = [];
    let buffer: React.ReactNode[] = [];
    let keyIdx = 0;
    let isFirstTextNode = true; // 标记是否是第一个文本节点

    mergedNodes.forEach((node, nodeIdx) => {
      if (typeof node === "string") {
        // 移除文本开头的冒号（markdown 列表项格式问题）
        let processedText = node;
        if (isFirstTextNode && processedText.trimStart().startsWith(":")) {
          // 如果是第一个文本节点且以冒号开头，移除开头的冒号和可能的空格
          processedText = processedText.replace(/^\s*:\s*/, "");
          isFirstTextNode = false; // 标记已处理过第一个文本节点
        } else if (isFirstTextNode) {
          isFirstTextNode = false;
        }

        // === 正则表达式详解 ===
        // Group 1 (\s*): 捕获时间戳前面的空格（为了隐藏它）
        // Group 2 (\[...\]): 捕获时间戳
        // \s*: 忽略时间戳和标点之间的空格
        // Group 3 ([...]*): 捕获紧跟在后面的标点
        const tsPattern = /(\s*)\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([.,;!?。，！？]*)/g;

        let match;
        let lastIndex = 0;

        while ((match = tsPattern.exec(processedText)) !== null) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const leadingSpace = match[1]; // " " (时间戳前的空格) - 保留用于未来使用
          const timestamp = match[2]; // "01:30"
          const punct = match[3]; // "." (标点)
          const fullMatchLength = match[0].length;

          // 1. 获取时间戳前的纯文本 (不包含那个被捕获的空格)
          const textSegment = processedText.slice(lastIndex, match.index);
          if (textSegment) buffer.push(textSegment);

          // 2. 【关键】将标点符号立即放入 buffer (紧贴正文！)
          // 这样 "Hello" + "." 就会变成 "Hello."，中间没有空格
          if (punct) {
            buffer.push(punct);
          }

          // 3. 结算：生成可点击的句子 (包含正文+标点)
          // 此时 buffer 里的内容是 ["Hello", "."]
          if (buffer.length > 0) {
            result.push(
              <span
                key={`s-${keyIdx++}`}
                onClick={(e) => {
                  e.stopPropagation();
                  jumpFn(timestamp);
                }}
                className="group -mx-0.5 inline-block cursor-pointer rounded px-0.5 transition-colors hover:bg-blue-50/50 hover:text-blue-600"
                title={`跳转到 ${timestamp}`}
              >
                {buffer.map((c, i) => (
                  <React.Fragment key={i}>{c}</React.Fragment>
                ))}
              </span>,
            );
          }

          // 4. 处理时间戳显示 (隐藏前导空格)
          // 这里我们渲染一个不占位的空格(如果需要)和时间戳
          // leadingSpace 被我们故意忽略了，或者你可以把它放在 hidden 类里
          // result.push(
          //    <span key={`ts-${keyIdx}`} className="text-gray-300 text-[10px] ml-1 select-none">
          //      {/* 如果你想完全隐藏 " [01:30]"，给这个 span 加 `hidden` 类即可 */}
          //      {/* 或者保留它但非常淡，作为视觉参考 */}
          //      [{timestamp}]
          //    </span>
          // );

          // 清空 buffer，更新指针
          buffer = [];
          lastIndex = match.index + fullMatchLength;
        }

        const remaining = processedText.slice(lastIndex);
        if (remaining) buffer.push(remaining);
      } else {
        // 富文本节点
        if (React.isValidElement(node)) {
          buffer.push(React.cloneElement(node, { key: `node-${nodeIdx}` }));
        } else {
          buffer.push(node);
        }
      }
    });

    if (buffer.length > 0) {
      result.push(
        <span key="rest">
          {buffer.map((c, i) => (
            <React.Fragment key={i}>{c}</React.Fragment>
          ))}
        </span>,
      );
    }

    return result;
  };

  // Custom ReactMarkdown components for clickable timestamps (富文本支持，整个句子高亮)
  const markdownComponents = {
    // Override paragraph to parse timestamps - use span for inline display (no line breaks between sentences)
    p: ({ children }: React.HTMLAttributes<HTMLParagraphElement>) => (
      <>{processClickableChildren(children, jumpToTimestamp)} </>
    ),
    // Override list items to parse timestamps
    li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
      <li {...props}>{processClickableChildren(children, jumpToTimestamp)}</li>
    ),
    // Override strong to preserve and parse timestamps
    strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <strong {...props}>{processClickableChildren(children, jumpToTimestamp)}</strong>
    ),
    // Override em (italic) to preserve and parse timestamps
    em: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <em {...props}>{processClickableChildren(children, jumpToTimestamp)}</em>
    ),
  };

  // 开始播放 clips 列表
  const startClipPlayback = (clips: { startTime: number; endTime: number }[]) => {
    if (clips.length === 0) return;

    console.log("[Clips] Starting playback with", clips.length, "clips");
    setClipPlaylist({ clips, currentIndex: 0, isPlaying: true });

    // 跳转到第一个 clip - 直接使用 player API 避免状态更新冲突
    const startTime = clips[0].startTime;
    if (player && playerReady && player.seekTo) {
      console.log("[Clips] Seeking to", startTime, "seconds");
      player.seekTo(startTime, true);
      player.playVideo();
    }
  };

  const loadVideoData = async (
    id: string,
    useLocalCache: boolean = false,
    targetLanguage?: string,
  ) => {
    try {
      const langToUse = targetLanguage || language;
      console.log(
        "[Result] Loading video data for:",
        id,
        "useLocalCache:",
        useLocalCache,
        "language:",
        langToUse,
      );
      setError(null);

      // 如果是示例视频，优先使用本地缓存（但翻译时强制从 API 加载）
      if (useLocalCache && (!targetLanguage || targetLanguage === "en")) {
        console.log("[Result] 📂 Loading from local cache for example video");
        try {
          const localResponse = await fetch(`/data/json/video-data-${id}.json`);
          if (localResponse.ok) {
            const localData = await localResponse.json();
            console.log("[Result] ✅ Local cache loaded successfully");
            console.log("[Result] Main body sections count:", localData.main_body?.length || 0);
            setVideoData(localData);
            setLoading(false);
            return;
          }
        } catch (localError) {
          console.error("[Result] ❌ Local cache failed:", localError);
        }
      }

      // Try to load from backend API
      const timeoutId = setTimeout(() => {
        console.log("[Result] ⏱️ Request taking longer than 60s");
      }, 60000);

      try {
        // 构建 URL，如果有非英文语言则添加 language 参数
        let url = `${API_BASE_URL}/api/videos/${id}`;
        if (langToUse && langToUse !== "en") {
          url += `?language=${langToUse}`;
        }
        console.log("[Result] 🔍 Fetching from:", url, "language:", langToUse);
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
          },
        });
        console.log("[Result] 📥 Response received:", response.status, response.ok);

        clearTimeout(timeoutId);

        if (!response.ok) {
          // 如果是 404，说明视频数据不存在，自动触发分析
          if (response.status === 404) {
            console.log("[Result] 📹 Video data not found (404), starting automatic analysis...");
            const videoUrl = `https://www.youtube.com/watch?v=${id}`;
            await startStreamingAnalysis(videoUrl);
            return;
          }
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        console.log("[Result] ✅ Video data loaded successfully");
        console.log("[Result] 📝 Video title:", data?.videoInfo?.title);
        console.log("[Result] 📝 First section title:", data?.main_body?.[0]?.section_title);
        setVideoData(data);
        return;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.error("[Result] ❌ Fetch error:", fetchError);
        throw fetchError;
      }
    } catch (apiError) {
      console.error("[Result] Failed to load from API:", apiError);

      // Fallback: Try to load from local data directory
      try {
        console.log("[Result] Attempting local fallback: /data/json/video-data-" + id + ".json");
        const localResponse = await fetch(`/data/json/video-data-${id}.json`);

        if (localResponse.ok) {
          const localData = await localResponse.json();
          console.log("[Result] Local data loaded successfully");
          setVideoData(localData);
        } else {
          throw new Error("Local data not found");
        }
      } catch (localError) {
        console.error("[Result] Failed to load local data:", localError);
        // 如果本地数据也不存在，自动触发分析
        console.log("[Result] 📹 Local data not found, starting automatic analysis...");
        const videoUrl = `https://www.youtube.com/watch?v=${id}`;
        try {
          await startStreamingAnalysis(videoUrl);
        } catch (analysisError) {
          console.error("[Result] Failed to start analysis:", analysisError);
          setError("Failed to load video data. Starting analysis...");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Theme 颜色配置
  const THEME_COLORS = [
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#f59e0b", // amber
    "#10b981", // emerald
    "#3b82f6", // blue
    "#ef4444", // red
    "#14b8a6", // teal
  ];

  // 获取 themes（根据当前语言生成）
  const loadThemes = async (id: string, targetLanguage?: string) => {
    if (themesGenerated || isLoadingThemes) return;

    const lang = targetLanguage || language;
    console.log("[Result] Loading themes for:", id, "language:", lang);
    setIsLoadingThemes(true);

    try {
      // 传递语言参数给后端
      const response = await fetch(`${STREAM_API_URL}/api/generate-themes/${id}?language=${lang}`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to generate themes: ${response.status}`);
      }

      const data = await response.json();
      console.log("[Result] Themes response:", data);

      if (data.success && data.themes) {
        // 为每个 theme 分配颜色
        const themesWithColors = data.themes.map((theme: Theme, index: number) => ({
          ...theme,
          color: THEME_COLORS[index % THEME_COLORS.length],
        }));
        setThemes(themesWithColors);
        setThemesGenerated(true);
        console.log("[Result] ✅ Loaded", themesWithColors.length, "themes");
      }
    } catch (error) {
      console.error("[Result] ❌ Failed to load themes:", error);
    } finally {
      setIsLoadingThemes(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _loadComments = async (id: string, maxResults: number = 20) => {
    console.log("[Result] Loading comments for:", id);
    setCommentsLoading(true);
    setCommentsError(null);

    try {
      const url = `${API_BASE_URL}/api/videos/${id}/comments?maxResults=${maxResults}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status}`);
      }

      const data = await response.json();
      console.log("[Result] Comments response:", data);

      if (data.success) {
        setComments(data.comments || []);
        console.log("[Result] ✅ Loaded", data.total, "comments");
      } else {
        setCommentsError(data.message || data.error || "Failed to load comments");
        console.warn("[Result] ⚠️ Comments loading unsuccessful:", data.message);
      }
    } catch (error) {
      console.error("[Result] ❌ Failed to load comments:", error);
      setCommentsError(error instanceof Error ? error.message : "Failed to load comments");
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    setChatMessages((prev) => [...prev, { type: "user", content: chatInput }]);
    const userMessage = chatInput;
    setChatInput("");
    setIsChatThinking(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          video_context: {
            videoId,
            title,
            transcript: transcriptContent.current, // 添加完整的 transcript 内容
          },
        }),
      });
      const data = await response.json();
      console.log("[Chat] Response received:", data);

      if (data.success) {
        console.log("[Chat] Adding bot message:", data.response?.substring(0, 100) + "...");
        setChatMessages((prev) => [...prev, { type: "bot", content: data.response }]);

        // 自动播放 clips：提取响应中的时间片段并自动播放
        // 使用 setTimeout 确保 React 渲染完成后再开始播放，避免 DOM 冲突
        const clips = extractClipsFromMessage(data.response);
        if (clips.length > 0) {
          console.log("[Chat] Found", clips.length, "clips, scheduling auto-playback...");
          setTimeout(() => {
            startClipPlayback(clips);
          }, 100);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages((prev) => [
        ...prev,
        {
          type: "bot",
          content: "Sorry, I'm having trouble processing your request. Please try again later.",
        },
      ]);
    }
  };

  // 重新生成 Key Takeaways 图像
  const handleRetryImageGeneration = async () => {
    if (!videoId) return;

    // 设置状态为 generating
    setImageGenStatus({
      status: "generating",
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-key-takeaways-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: videoId,
          force_regenerate: true,
        }),
      });

      const data = await response.json();
      console.log("[ImageGen] Retry response:", data);

      if (data.success && data.image_url) {
        setImageGenStatus({
          status: "completed",
          imageUrl: data.image_url,
        });
      } else {
        setImageGenStatus({
          status: "failed",
          errorMessage: data.error || data.message || "图像生成失败",
        });
      }
    } catch (error) {
      console.error("[ImageGen] Retry error:", error);
      setImageGenStatus({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "网络请求失败",
      });
    } finally {
      setIsChatThinking(false);
    }
  };

  const downloadPDF = async () => {
    try {
      // Prepare notes data for PDF export
      const notesForExport = notes.map((note) => ({
        sectionId: note.sectionId,
        sentenceIndex: note.sentenceIndex,
        contentPreview: note.contentPreview,
        noteText: note.noteText,
        createdAt: note.createdAt.toISOString(),
      }));

      const response = await fetch(`${API_BASE_URL}/api/generate-pdf/${videoId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes: notesForExport,
          videoTitle: videoData?.videoInfo?.title || title || "Video Analysis",
        }),
      });

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${title || "video"}.pdf`;
      a.click();
    } catch (error) {
      console.error("PDF download failed:", error);
    }
  };

  const handleShare = async () => {
    if (!videoId) return;

    // 构建分享连接
    const shareUrl = `${window.location.origin}/result?v=${videoId}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsShareCopied(true);
      setTimeout(() => setIsShareCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy share link:", error);
    }
  };

  // 如果没有 videoId 且没有 streamingUrl，显示错误页面
  if (!videoId && !streamingUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md space-y-4 rounded-lg border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg
              className="h-8 w-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">No Video Data</h2>
          <p className="text-gray-600">Please analyze a video first</p>
          <Link to="/">
            <Button className="bg-blue-600 text-white hover:bg-blue-700">Return to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f5]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#faf9f5]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="font-medium">Back</span>
          </Link>

          {/* Actions - Collapsible Menu */}
          <div className="flex flex-1 justify-end px-4">
            <div className="group relative">
              <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm14 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              <div className="invisible absolute top-full right-0 z-50 mt-2 w-48 origin-top-right translate-y-2 transform rounded-xl border border-gray-200 bg-white p-1.5 opacity-0 shadow-lg transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <div className="space-y-0.5">
                  <button
                    onClick={handleLikeClick}
                    disabled={isLikeLoading}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-md ${isLiked ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-500"}`}
                    >
                      {isLikeLoading ? (
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-4 w-4"
                          fill={isLiked ? "currentColor" : "none"}
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex flex-col items-start">
                      <span>{isLiked ? "Liked" : "Like"}</span>
                      {likeCount > 0 && (
                        <span className="text-xs text-gray-400">
                          {likeCount} {likeCount === 1 ? "like" : "likes"}
                        </span>
                      )}
                    </div>
                  </button>

                  <button
                    onClick={handleFavoriteClick}
                    disabled={isFavoriteLoading}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-md ${isFavorited ? "bg-yellow-50 text-yellow-500" : "bg-gray-100 text-gray-500"}`}
                    >
                      {isFavoriteLoading ? (
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-4 w-4"
                          fill={isFavorited ? "currentColor" : "none"}
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                          />
                        </svg>
                      )}
                    </div>
                    <span>{isFavorited ? "Saved" : "Add to Space"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <div className="language-selector relative">
              <button
                onClick={() => setShowLangMenu(!showLangMenu)}
                disabled={isTranslating || isStreaming}
                className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 transition-all duration-200 hover:border-blue-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                  />
                </svg>
                <span>{LANGUAGES.find((l) => l.code === language)?.label}</span>
                {isTranslating ? (
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <svg
                    className={`h-3 w-3 transition-transform ${showLangMenu ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                )}
              </button>

              {showLangMenu && (
                <div className="absolute right-0 z-10 mt-2 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      disabled={isTranslating}
                      className={`flex w-full items-center px-4 py-2 text-left text-sm transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 ${
                        language === lang.code
                          ? "bg-blue-50 font-medium text-blue-600"
                          : "text-gray-700"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              onClick={handleShare}
              variant="outline"
              className="flex items-center gap-2"
              disabled={!videoId}
            >
              {isShareCopied ? (
                <>
                  <svg
                    className="h-4 w-4 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-green-600">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                  Share
                </>
              )}
            </Button>
            <Button onClick={downloadPDF} variant="outline" className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export PDF
            </Button>

            {/* User Menu */}
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar - Navigation & Comments */}
          <div className="w-[240px] flex-shrink-0">
            <div className="sticky top-20 space-y-6">
              {/* Table of Contents */}
              <div>
                <div className="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                  On This Page
                </div>
                <nav className="space-y-2">
                  {/* V2.0 Format: Use main_body sections */}
                  {videoData?.main_body?.map((section, index) => (
                    <div
                      key={index}
                      onClick={() => {
                        const el = document.getElementById(`section-${index}`);
                        el?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="group flex cursor-pointer items-start gap-2 rounded p-1 transition-colors hover:bg-gray-50"
                      title={section.section_title}
                    >
                      {/* Thumbnail */}
                      {section.thumbnail_url && (
                        <div className="w-16 flex-shrink-0 overflow-hidden rounded">
                          <img
                            src={section.thumbnail_url}
                            alt={section.section_title}
                            className="h-9 w-16 object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                      )}
                      {/* Title & Timestamp */}
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-xs font-medium text-gray-800 group-hover:text-gray-900">
                          {section.section_title}
                        </div>
                        {section.timestamp_ref && (
                          <div className="mt-0.5 text-[10px] text-blue-500">
                            {section.timestamp_ref}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!videoData?.main_body || videoData.main_body.length === 0) && (
                    <p className="text-xs text-gray-400">loading...</p>
                  )}
                </nav>
              </div>

              {/* Separator */}
              <hr className="border-gray-200" />

              {/* Theme Table */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                    Theme Table
                  </span>
                  {/* 返回主内容按钮 */}
                  {activeThemeId && (
                    <button
                      onClick={() => setActiveThemeId(null)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-blue-600 transition-colors hover:bg-blue-50"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                      Back
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {themes.length > 0 ? (
                    themes.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() =>
                          setActiveThemeId(activeThemeId === theme.id ? null : theme.id)
                        }
                        className={`group flex w-full items-start gap-2 rounded px-2 py-2 text-left transition-all ${
                          activeThemeId === theme.id
                            ? "bg-blue-50 ring-1 ring-blue-200"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: theme.color || "#6366f1" }}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-xs font-medium ${
                              activeThemeId === theme.id ? "text-blue-700" : "text-gray-800"
                            }`}
                            title={theme.title}
                          >
                            {theme.title}
                          </p>
                          {theme.description && (
                            <p className="mt-0.5 line-clamp-2 text-[10px] text-gray-500">
                              {theme.description}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-gray-400">
                            {theme.content?.length || 0} Key Points
                          </p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400">
                        {isStreaming
                          ? "Analyzing..."
                          : isLoadingThemes
                            ? "Generating themes..."
                            : "No themes"}
                      </p>
                      {/* 生成主题按钮 - 支持 V2.0 (main_body) */}
                      {!isStreaming &&
                        !isLoadingThemes &&
                        !themesGenerated &&
                        videoId &&
                        videoData?.main_body &&
                        videoData.main_body.length > 0 && (
                          <button
                            onClick={() => loadThemes(videoId)}
                            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 py-2 text-xs text-gray-500 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                              />
                            </svg>
                            Find Themes
                          </button>
                        )}
                      {isLoadingThemes && (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                          <span className="text-xs text-gray-500">AI Analyzing...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Middle - Main Content */}
          <div className="min-w-0 flex-1 space-y-6">
            {/* V2.0 Structured Article View */}
            {videoData?.main_body ? (
              activeThemeId ? (
                // === Theme View ===
                (() => {
                  const activeTheme = themes.find((t) => t.id === activeThemeId);
                  if (!activeTheme) return null;

                  // 将时间戳替换为播放器按钮
                  const processTimestampButtons = (
                    children: React.ReactNode,
                    jumpFn: (ts: string) => void,
                  ) => {
                    const rawNodes = React.Children.toArray(children);
                    const mergedNodes: React.ReactNode[] = [];
                    rawNodes.forEach((node) => {
                      const lastNode = mergedNodes[mergedNodes.length - 1];
                      if (typeof node === "string" && typeof lastNode === "string") {
                        mergedNodes[mergedNodes.length - 1] = lastNode + node;
                      } else {
                        mergedNodes.push(node);
                      }
                    });

                    const result: React.ReactNode[] = [];
                    let keyIdx = 0;

                    mergedNodes.forEach((node, nodeIdx) => {
                      if (typeof node === "string") {
                        const tsPattern = /\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
                        let match;
                        let lastIndex = 0;

                        while ((match = tsPattern.exec(node)) !== null) {
                          const timestamp = match[1];
                          const textSegment = node.slice(lastIndex, match.index);
                          if (textSegment) {
                            result.push(
                              <React.Fragment key={`t-${keyIdx++}`}>{textSegment}</React.Fragment>,
                            );
                          }
                          result.push(
                            <button
                              key={`btn-${keyIdx++}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                jumpFn(timestamp);
                              }}
                              className="mx-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 align-middle text-blue-600 transition-all duration-200 hover:scale-110 hover:bg-blue-200 hover:text-blue-700"
                              title={`跳转到 ${timestamp}`}
                              type="button"
                            >
                              <svg
                                className="ml-0.5 h-2.5 w-2.5"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </button>,
                          );
                          lastIndex = match.index + match[0].length;
                        }
                        const remaining = node.slice(lastIndex);
                        if (remaining) {
                          result.push(
                            <React.Fragment key={`t-${keyIdx++}`}>{remaining}</React.Fragment>,
                          );
                        }
                      } else {
                        if (React.isValidElement(node)) {
                          result.push(React.cloneElement(node, { key: `node-${nodeIdx}` }));
                        } else {
                          result.push(node);
                        }
                      }
                    });
                    return result.length > 0 ? result : children;
                  };

                  const themeMarkdownComponents = {
                    p: ({ children }: React.HTMLAttributes<HTMLParagraphElement>) => (
                      <p className="mb-4 leading-relaxed text-gray-700">
                        {processTimestampButtons(children, jumpToTimestamp)}
                      </p>
                    ),
                    li: ({ children }: React.LiHTMLAttributes<HTMLLIElement>) => (
                      <li className="mb-2 leading-relaxed text-gray-700">
                        {processTimestampButtons(children, jumpToTimestamp)}
                      </li>
                    ),
                  };

                  return (
                    <div>
                      {/* Back Button */}
                      <button
                        onClick={() => setActiveThemeId(null)}
                        className="mb-6 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 19l-7-7 7-7"
                          />
                        </svg>
                        Back to Main Content
                      </button>

                      {/* Theme Header */}
                      <div
                        className="mb-6 rounded-lg border-l-4 bg-gray-50 p-4"
                        style={{ borderLeftColor: activeTheme.color || "#6366f1" }}
                      >
                        <h2 className="text-lg font-bold text-gray-900">{activeTheme.title}</h2>
                        {activeTheme.description && (
                          <p className="mt-2 text-sm text-gray-600">{activeTheme.description}</p>
                        )}
                        <p className="mt-2 text-xs text-gray-400">
                          {activeTheme.content?.length || 0} Key Points
                        </p>
                      </div>

                      {/* Theme Content - Nextra Steps Style */}
                      <div className="nextra-steps">
                        {activeTheme.content?.map((item, index) => (
                          <div
                            key={index}
                            className={`relative pb-6 pl-10 ${
                              index < (activeTheme.content?.length ?? 0) - 1
                                ? "after:absolute after:top-8 after:left-[13px] after:h-[calc(100%-1.5rem)] after:w-[2px] after:bg-gray-200"
                                : ""
                            }`}
                          >
                            {/* Step Number */}
                            <div
                              className="absolute top-0 left-0 flex h-7 w-7 items-center justify-center rounded-md text-sm font-semibold text-white"
                              style={{ backgroundColor: activeTheme.color || "#6366f1" }}
                            >
                              {index + 1}
                            </div>

                            {/* Content Text */}
                            <div className="prose prose-sm prose-gray prose-p:text-[15px] prose-p:text-gray-700 prose-p:leading-7 prose-p:my-3 prose-headings:font-semibold prose-headings:text-gray-900 prose-headings:mt-4 prose-headings:mb-2 prose-strong:text-gray-900 prose-strong:font-bold prose-ul:my-3 prose-ul:pl-0 prose-ul:list-none prose-ol:my-3 prose-ol:pl-0 prose-li:relative prose-li:pl-5 prose-li:my-2 prose-li:text-[15px] prose-li:leading-7 prose-li:text-gray-700 prose-blockquote:border-l-2 prose-blockquote:border-gray-300 prose-blockquote:bg-[rgb(250,249,245)] prose-blockquote:py-2 prose-blockquote:px-3 prose-blockquote:my-3 prose-blockquote:rounded-r prose-blockquote:text-gray-700 prose-blockquote:text-sm prose-code:rounded prose-code:bg-[rgb(250,249,245)] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs prose-code:font-mono prose-code:text-gray-800 prose-a:text-blue-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline hover:prose-a:text-blue-700 max-w-none [&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:font-bold [&_ul>li]:before:text-gray-400 [&_ul>li]:before:content-['•']">
                              <ReactMarkdown components={themeMarkdownComponents}>
                                {item.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* Nextra-style Documentation */
                <article className="nextra-content">
                  {/* Nextra Header */}
                  <header className="mb-8">
                    {/* Title */}
                    <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                      {videoData?.meta?.title}
                    </h1>

                    {/* Description */}
                    {videoData?.summary_box && (
                      <p className="mt-4 text-lg leading-relaxed text-gray-600">
                        {videoData.summary_box.key_insight}
                      </p>
                    )}
                  </header>

                  {/* Nextra Callout - Key Insight */}
                  {videoData?.header_hook && (
                    <div
                      className="nextra-callout mb-8 flex rounded-lg border border-gray-200 p-4"
                      style={{ backgroundColor: "rgb(250, 249, 245)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed text-gray-700">
                          {videoData.header_hook.quote}
                          {videoData.header_hook.author && (
                            <span className="ml-2 text-gray-600">
                              — {videoData.header_hook.author}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Summary Points - Nextra style list */}
                  {videoData?.summary_box?.bullet_points &&
                    videoData.summary_box.bullet_points.length > 0 && (
                      <div className="mb-8">
                        <h2 className="mb-4 text-2xl font-semibold tracking-tight text-gray-900">
                          Key Takeaways
                        </h2>
                        <ul className="space-y-2">
                          {videoData.summary_box.bullet_points.map((point, i) => (
                            <li key={i} className="flex items-start gap-3 text-gray-600">
                              <span className="mt-1.5 flex h-2 w-2 flex-shrink-0 rounded-full bg-gray-500"></span>
                              <span className="leading-relaxed">{point}</span>
                            </li>
                          ))}
                        </ul>

                        {/* Key Takeaways Image */}
                        {videoData.key_takeaways_image_url ||
                        imageGenStatus?.status === "completed" ? (
                          // 图像生成成功，直接显示
                          <div className="mt-6">
                            <img
                              src={videoData.key_takeaways_image_url || imageGenStatus?.imageUrl}
                              alt="Key Takeaways Visual Summary"
                              className="w-full rounded-lg border border-gray-200 shadow-sm transition-transform hover:scale-[1.01]"
                            />
                            <p className="mt-2 text-center text-xs text-gray-400">
                              Visual summary generated by AI
                            </p>
                          </div>
                        ) : imageGenStatus?.status === "generating" ? (
                          // 图像正在生成中
                          <div
                            className="mt-6 flex flex-col items-center justify-center rounded-lg border border-gray-200 px-6 py-8"
                            style={{ backgroundColor: "rgb(250, 249, 245)" }}
                          >
                            <svg
                              className="mb-3 h-10 w-10 animate-spin text-blue-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            <p className="mb-1 text-sm font-medium text-gray-700">
                              Generating image...
                            </p>
                            <p className="text-xs text-gray-500">This may take a few seconds</p>
                          </div>
                        ) : imageGenStatus?.status === "failed" ? (
                          // 图像生成失败（仅在明确失败时显示）
                          <div
                            className="mt-6 flex flex-col items-center justify-center rounded-lg border border-gray-200 px-6 py-8"
                            style={{ backgroundColor: "rgb(250, 249, 245)" }}
                          >
                            <svg
                              className="mb-3 h-10 w-10 text-gray-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <p className="mb-1 text-sm font-medium text-gray-700">
                              generate image failed
                            </p>
                            <button
                              className="mt-2 rounded-md bg-blue-400 px-2 py-1 text-white hover:bg-blue-600"
                              onClick={handleRetryImageGeneration}
                            >
                              Retry
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}

                  {/* Core Concepts module removed */}

                  {/* Main Content Sections - Nextra Steps Style */}
                  <div className="nextra-steps">
                    {videoData?.main_body?.map((section, idx) => (
                      <section
                        key={idx}
                        id={`section-${idx}`}
                        className="nextra-step relative mb-10 scroll-mt-20 pl-10 before:absolute before:top-0 before:left-0 before:flex before:h-7 before:w-7 before:items-center before:justify-center before:rounded-md before:bg-gray-200 before:text-sm before:font-semibold before:text-gray-600 before:content-[attr(data-step)]"
                        data-step={idx + 1}
                      >
                        {/* Section heading */}
                        <div className="mb-4 flex items-center justify-between">
                          <h2 className="text-xl font-semibold tracking-tight text-gray-900 hover:text-blue-600">
                            <a href={`#section-${idx}`} className="group flex items-center">
                              {section.section_title}
                              <span className="ml-2 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">
                                #
                              </span>
                            </a>
                          </h2>
                          {section.timestamp_ref && (
                            <button
                              onClick={() => jumpToTimestamp(section.timestamp_ref)}
                              className="flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-blue-100 hover:text-blue-700"
                            >
                              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              {section.timestamp_ref}
                            </button>
                          )}
                        </div>

                        {/* Prose content - Rich Markdown rendering */}
                        <div className="prose prose-lg prose-gray prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-gray-900 prose-h1:text-3xl prose-h1:mt-8 prose-h1:mb-4 prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-3 prose-h2:text-2xl prose-h2:mt-7 prose-h2:mb-3 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-gray-800 prose-h4:text-lg prose-h4:mt-5 prose-h4:mb-2 prose-ul:my-4 prose-ol:my-4 prose-li:text-gray-700 prose-li:my-2 prose-li:leading-7 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:bg-[rgb(250,249,245)] prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:my-6 prose-blockquote:rounded-r-lg prose-blockquote:text-gray-700 prose-blockquote:not-italic prose-blockquote:font-normal prose-strong:text-gray-900 prose-strong:font-bold prose-code:rounded-md prose-code:bg-[rgb(250,249,245)] prose-code:px-2 prose-code:py-1 prose-code:text-sm prose-code:font-mono prose-code:text-gray-800 prose-code:before:content-[''] prose-code:after:content-[''] prose-pre:bg-[rgb(250,249,245)] prose-pre:text-gray-800 prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto prose-a:text-blue-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline hover:prose-a:text-blue-700 prose-a:decoration-2 prose-a:underline-offset-2 prose-img:rounded-lg prose-img:shadow-md prose-img:my-6 prose-hr:border-gray-300 prose-hr:my-8 prose-table:border-collapse prose-table:my-6 prose-th:border prose-th:border-gray-300 prose-th:bg-[rgb(250,249,245)] prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-td:border prose-td:border-gray-300 prose-td:px-4 prose-td:py-2 max-w-none leading-8 text-gray-700 [&>span]:inline">
                          <ReactMarkdown components={markdownComponents}>
                            {section.content_markdown}
                          </ReactMarkdown>
                        </div>

                        {/* Visual break - simple text display */}
                        {section.visual_break && (
                          <div className="mt-6">
                            <p className="text-sm leading-relaxed text-gray-700">
                              {section.visual_break.content}
                            </p>
                          </div>
                        )}
                      </section>
                    ))}
                  </div>

                  {/* Visual Summary Chart - ASCII Art */}
                  {videoData?.visual_summary_chart?.ascii_art && (
                    <section className="mb-8">
                      <div className="mb-4 flex items-center justify-between">
                        {videoData.visual_summary_chart.title && (
                          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                            {videoData.visual_summary_chart.title}
                          </h2>
                        )}
                        <button
                          onClick={async () => {
                            if (!videoData?.visual_summary_chart?.ascii_art) return;
                            const text = videoData.visual_summary_chart.ascii_art;
                            try {
                              // 优先使用 Clipboard API
                              if (navigator.clipboard && window.isSecureContext) {
                                await navigator.clipboard.writeText(text);
                              } else {
                                // Fallback: 使用传统方法
                                const textArea = document.createElement("textarea");
                                textArea.value = text;
                                textArea.style.position = "fixed";
                                textArea.style.left = "-9999px";
                                textArea.style.top = "-9999px";
                                document.body.appendChild(textArea);
                                textArea.focus();
                                textArea.select();
                                document.execCommand("copy");
                                document.body.removeChild(textArea);
                              }
                              setIsCopied(true);
                              setTimeout(() => setIsCopied(false), 2000);
                            } catch (err) {
                              console.error("Failed to copy:", err);
                              // 再次尝试 fallback
                              try {
                                const textArea = document.createElement("textarea");
                                textArea.value = text;
                                textArea.style.position = "fixed";
                                textArea.style.left = "-9999px";
                                document.body.appendChild(textArea);
                                textArea.select();
                                document.execCommand("copy");
                                document.body.removeChild(textArea);
                                setIsCopied(true);
                                setTimeout(() => setIsCopied(false), 2000);
                              } catch {
                                alert("复制失败，请手动复制");
                              }
                            }
                          }}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            isCopied
                              ? "border-gray-300 text-gray-700"
                              : "border-gray-300 text-gray-700 hover:opacity-80"
                          }`}
                          style={{ backgroundColor: "rgb(250, 249, 245)" }}
                          title="Copy ASCII art"
                        >
                          {isCopied ? (
                            <>
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div
                        className="rounded-lg border border-gray-200 p-6"
                        style={{ backgroundColor: "rgb(250, 249, 245)" }}
                      >
                        <div className="flex justify-center overflow-x-auto">
                          <pre className="font-mono text-sm leading-relaxed whitespace-pre text-gray-800">
                            {videoData.visual_summary_chart.ascii_art}
                          </pre>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Nextra Separator */}
                  <hr className="my-8 border-gray-200" />

                  {/* Deep Analysis - Nextra Tabs style */}
                  {videoData?.deep_analysis && (
                    <section className="mb-8">
                      <h2 className="mb-4 text-2xl font-semibold tracking-tight text-gray-900">
                        Deep Analysis
                      </h2>

                      {/* Nextra Callout - Info */}
                      <div
                        className="nextra-callout mb-6 flex rounded-lg border border-gray-200 p-4"
                        style={{ backgroundColor: "rgb(250, 249, 245)" }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-700">
                            Expand sections below for detailed explanations and logic diagrams.
                          </p>
                        </div>
                      </div>

                      {/* Diagram toggle */}
                      <details className="group mb-6 overflow-hidden rounded-lg border border-gray-200">
                        <summary
                          className="flex cursor-pointer items-center gap-3 px-4 py-3 font-medium text-gray-900 hover:opacity-80"
                          style={{ backgroundColor: "rgb(250, 249, 245)" }}
                        >
                          <svg
                            className="h-5 w-5 text-gray-500 transition-transform group-open:rotate-90"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                          Logic Flow Diagram
                        </summary>
                        <div
                          className="border-t border-gray-200 p-4"
                          style={{ backgroundColor: "rgb(250, 249, 245)" }}
                        >
                          <MermaidChart
                            chart={videoData.deep_analysis.mermaid_graph}
                            className="min-h-[200px]"
                          />
                        </div>
                      </details>

                      {/* Deep Points - Nextra accordion */}
                      <div className="space-y-3">
                        {videoData.deep_analysis.deep_points.map((point, i) => (
                          <details
                            key={i}
                            className="group overflow-hidden rounded-lg border border-gray-200"
                          >
                            <summary
                              className="flex cursor-pointer items-center gap-3 px-4 py-3 font-medium text-gray-900 hover:opacity-80"
                              style={{ backgroundColor: "rgb(250, 249, 245)" }}
                            >
                              <svg
                                className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-90"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                              {point.title}
                            </summary>
                            <div
                              className="border-t border-gray-200 px-4 py-4"
                              style={{ backgroundColor: "rgb(250, 249, 245)" }}
                            >
                              <p className="mb-3 leading-relaxed text-gray-600">
                                {point.detailed_explanation}
                              </p>
                              <blockquote className="border-l-2 border-gray-300 pl-4 text-sm text-gray-500 italic">
                                "{point.evidence_quote}"
                              </blockquote>
                            </div>
                          </details>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Q&A Section - Nextra FAQ style */}
                  {videoData?.qa_interactions && videoData.qa_interactions.length > 0 && (
                    <section className="mb-8">
                      <h2 className="mb-4 text-2xl font-semibold tracking-tight text-gray-900">
                        Questions and Answers
                      </h2>
                      <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
                        {videoData.qa_interactions.map((qa, i) => (
                          <details key={i} className="group">
                            <summary
                              className="flex cursor-pointer items-center justify-between px-4 py-4 font-medium text-gray-900 hover:opacity-80"
                              style={{ backgroundColor: "rgb(250, 249, 245)" }}
                            >
                              <span className="pr-4">{qa.question}</span>
                              <svg
                                className="h-5 w-5 flex-shrink-0 text-gray-500 transition-transform group-open:rotate-180"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </summary>
                            <div
                              className="border-t border-gray-100 px-4 py-4"
                              style={{ backgroundColor: "rgb(250, 249, 245)" }}
                            >
                              <p className="leading-relaxed text-gray-600">{qa.answer}</p>
                              <span
                                className="mt-3 inline-block rounded-full border border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-600"
                                style={{ backgroundColor: "rgb(250, 249, 245)" }}
                              >
                                {qa.type}
                              </span>
                            </div>
                          </details>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Footer - Nextra style */}
                  {videoData?.footer && (
                    <footer className="mt-12 space-y-8">
                      {/* Related YouTube Videos */}
                      {videoData?.footer?.resources && videoData.footer.resources.length > 0 && (
                        <div>
                          <h3 className="mb-4 text-lg font-semibold text-gray-900">
                            Related Videos
                          </h3>
                          {isSearchingVideos ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="flex items-center gap-2 text-gray-500">
                                <svg
                                  className="h-5 w-5 animate-spin"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  />
                                </svg>
                                <span className="text-sm">Searching related videos...</span>
                              </div>
                            </div>
                          ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {videoData.footer.resources
                                .map((res) => {
                                  const video = relatedVideos.get(res.name);
                                  if (!video) return null;

                                  return (
                                    <a
                                      key={res.name}
                                      href={`/result?v=${video.videoId}`}
                                      className="group block rounded-lg border border-gray-200 p-4 transition-all hover:border-gray-300 hover:bg-gray-50 hover:shadow-md"
                                    >
                                      <div className="flex items-start gap-3">
                                        <div className="min-w-0 flex-1">
                                          <p className="line-clamp-2 font-medium text-gray-900 group-hover:text-blue-600">
                                            {video.title}
                                          </p>
                                          {video.channel && (
                                            <p className="mt-1 text-xs text-gray-500">
                                              {video.channel}
                                            </p>
                                          )}
                                          {video.length && (
                                            <p className="mt-1 text-xs text-gray-400">
                                              {video.length}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </a>
                                  );
                                })
                                .filter(Boolean)}
                            </div>
                          )}
                          {!isSearchingVideos && relatedVideos.size === 0 && (
                            <p className="py-4 text-center text-sm text-gray-500">
                              No related videos found
                            </p>
                          )}
                        </div>
                      )}
                      {/* Next Steps - Nextra Callout */}
                      {/* {videoData.footer.actionable_next_steps && videoData.footer.actionable_next_steps.length > 0 && (
                        <div className="nextra-callout rounded-lg border border-green-200 bg-green-50 p-4">
                          <h3 className="mb-3 flex items-center gap-2 font-semibold text-green-900">
                            <span className="text-xl">✅</span>
                            Next Steps
                          </h3>
                          <ul className="space-y-2">
                            {videoData.footer.actionable_next_steps.map((step, i) => (
                              <li key={i} className="flex items-start gap-3 text-green-800">
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 rounded border-green-400 text-green-600 focus:ring-green-500"
                                />
                                <span className="leading-relaxed">{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )} */}
                    </footer>
                  )}
                </article>
              )
            ) : (
              // Loading / No Content State
              <div className="rounded-lg border p-4 text-center">
                {isStreaming ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    <p className="text-gray-600">AI Analyzing video content...</p>
                  </div>
                ) : error ? (
                  <>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                      <svg
                        className="h-8 w-8 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <p className="mb-4 text-gray-600">{error}</p>
                    <Link to="/">
                      <Button className="bg-blue-600 text-white hover:bg-blue-700">
                        Return to Home
                      </Button>
                    </Link>
                  </>
                ) : (
                  <p className="text-gray-600">No content available</p>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar - Video & Tabs */}
          <div className="w-[420px] flex-shrink-0">
            {/* Video Player */}
            <div className="sticky top-20 overflow-visible">
              <div className="relative aspect-video bg-black">
                {/* Clip 播放进度指示器 - 始终渲染，用 CSS 控制显示以避免 React DOM 冲突 */}
                <div
                  className={`absolute top-2 right-2 z-20 flex items-center gap-2 rounded-lg bg-black/80 px-3 py-1.5 text-xs text-white shadow-lg transition-opacity ${
                    clipPlaylist && clipPlaylist.isPlaying
                      ? "opacity-100"
                      : "pointer-events-none opacity-0"
                  }`}
                >
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-400"></span>
                  <span>
                    Clip {(clipPlaylist?.currentIndex ?? 0) + 1} / {clipPlaylist?.clips.length ?? 0}
                  </span>
                  <button
                    onClick={() => setClipPlaylist(null)}
                    className="ml-1 rounded p-0.5 hover:bg-white/20"
                    title="Stop playback"
                  >
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 6h12v12H6z" />
                    </svg>
                  </button>
                </div>
                {!(extractedVideoIdRef.current || videoId || paramVideoId) ? (
                  // 流式分析中，videoId 尚未获取
                  <div className="flex h-full w-full items-center justify-center bg-gray-900">
                    <div className="text-center">
                      <svg
                        className="mx-auto h-12 w-12 animate-pulse text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="mt-2 text-sm text-gray-500">Loading video...</p>
                    </div>
                  </div>
                ) : isExtension ? (
                  <iframe
                    ref={youtubeIframeRef}
                    key={extractedVideoIdRef.current || videoId || paramVideoId || "no-video"}
                    src={`https://www.youtube.com/embed/${extractedVideoIdRef.current || videoId || paramVideoId || ""}?modestbranding=1&rel=0${youtubeStartTime > 0 ? `&start=${Math.floor(youtubeStartTime)}&autoplay=1` : ""}`}
                    className="h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <div id="youtube-player" className="h-full w-full"></div>
                )}
              </div>

              {/* Chapter/Show Toggle */}
              {/* <div className="flex items-center gap-2 border-b p-3 text-sm">
                <button className="rounded bg-gray-900 px-3 py-1.5 font-medium text-white">
                  Chapter
                </button>
                <button className="rounded px-3 py-1.5 font-medium text-gray-700 transition-colors hover:bg-gray-100">
                  Show
                </button>
              </div> */}

              {/* Tab Headers */}
              <div className="relative z-30 flex items-center border-b">
                <button
                  onClick={() => setActiveTab("transcript")}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === "transcript"
                      ? "border-b-2 border-gray-900 text-gray-900"
                      : "text-gray-600"
                  }`}
                >
                  Transcript
                </button>
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === "chat"
                      ? "border-b-2 border-gray-900 text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab("notes")}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === "notes"
                      ? "border-b-2 border-gray-900 text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Notes{" "}
                  {notes.length > 0 && (
                    <span className="ml-1 rounded-full bg-yellow-400 px-1.5 text-[10px] text-yellow-900">
                      {notes.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Content */}
              <div
                ref={transcriptContainerRef}
                className="h-[400px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-track]:bg-transparent"
              >
                {/* Transcript Tab */}
                {activeTab === "transcript" && (
                  <div className="space-y-3 p-4">
                    {transcriptData.length > 0 ? (
                      transcriptData.map((item, index) => (
                        <div
                          key={index}
                          ref={(el) => {
                            transcriptRefs.current[index] = el;
                          }}
                          className={`rounded-md px-3 py-2 transition-all ${
                            currentTranscriptIndex === index
                              ? "bg-blue-50 font-medium text-gray-900"
                              : "text-gray-600"
                          }`}
                          title={item.timestamp}
                        >
                          <div className="text-xs leading-relaxed text-gray-700">{item.text}</div>
                        </div>
                      ))
                    ) : (
                      <p className="py-8 text-center text-xs text-gray-500">
                        Loading transcript...
                      </p>
                    )}
                  </div>
                )}

                {/* Chat Tab */}
                {activeTab === "chat" && (
                  <div className="flex h-full flex-col">
                    <div className="flex-1 space-y-3 overflow-y-auto p-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-track]:bg-transparent">
                      {chatMessages.map((msg, index) => (
                        <div
                          key={index}
                          className={`flex gap-2 ${msg.type === "user" ? "justify-end" : ""}`}
                        >
                          {msg.type === "bot" && (
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs">
                              🤖
                            </div>
                          )}
                          <div
                            className={`rounded-lg px-3 py-2 text-xs ${
                              msg.type === "bot"
                                ? "flex-1 bg-gray-100"
                                : "max-w-[80%] bg-blue-100 whitespace-pre-wrap text-gray-900"
                            }`}
                          >
                            {msg.type === "bot"
                              ? parseMessageWithTimestamp(msg.content).map((part, idx) => {
                                  if (part.type === "timeRange" && part.startTime) {
                                    // 时间范围格式：📎 [06:45 - 07:05]
                                    return (
                                      <span
                                        key={idx}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          jumpToTimestamp(part.startTime!);
                                        }}
                                        className="inline-flex cursor-pointer items-center gap-1 rounded bg-green-100 px-2 py-0.5 font-mono text-green-700 transition-colors hover:bg-green-200 hover:text-green-800"
                                        title={`Play clip: ${part.startTime} - ${part.endTime}`}
                                      >
                                        <svg
                                          className="h-3.5 w-3.5"
                                          fill="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path d="M8 5v14l11-7z" />
                                        </svg>
                                        {part.startTime} - {part.endTime}
                                      </span>
                                    );
                                  }
                                  if (part.type === "timestamp") {
                                    return (
                                      <span
                                        key={idx}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          jumpToTimestamp(part.content);
                                        }}
                                        className="inline-flex cursor-pointer items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-700 transition-colors hover:bg-blue-200 hover:text-blue-800"
                                        title={`Jump to ${part.content}`}
                                      >
                                        <svg
                                          className="h-3 w-3"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                          />
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                          />
                                        </svg>
                                        {part.content}
                                      </span>
                                    );
                                  }
                                  return <span key={idx}>{part.content}</span>;
                                })
                              : msg.content}
                          </div>
                        </div>
                      ))}

                      {/* 思考中的动画 */}
                      {isChatThinking && (
                        <div className="mt-2 flex gap-2">
                          <div className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-600">Thinking</span>
                              <div className="flex gap-1">
                                <span
                                  className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-400"
                                  style={{ animationDelay: "0ms" }}
                                ></span>
                                <span
                                  className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-400"
                                  style={{ animationDelay: "150ms" }}
                                ></span>
                                <span
                                  className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-400"
                                  style={{ animationDelay: "300ms" }}
                                ></span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="border-t p-4">
                      <div
                        className={`flex gap-2 transition-transform duration-200 ${
                          isDragOver ? "scale-105" : "scale-100"
                        }`}
                        onDragOver={(e) => {
                          // 允许拖拽
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                          setIsDragOver(true);
                        }}
                        onDragLeave={() => {
                          setIsDragOver(false);
                        }}
                        onDrop={(e) => {
                          // 处理拖拽数据
                          e.preventDefault();
                          setIsDragOver(false);

                          const droppedText = e.dataTransfer.getData("text/plain");
                          if (droppedText) {
                            setChatInput((prev) => (prev ? `${prev}${droppedText}` : droppedText));
                          }
                        }}
                      >
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              handleSendMessage();
                            }
                          }}
                          placeholder="Ask about the video..."
                          className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                            isDragOver ? "border-blue-400 bg-blue-50" : ""
                          }`}
                        />
                        <button
                          onClick={handleSendMessage}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-white transition-colors hover:bg-blue-700"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes Tab */}
                {activeTab === "notes" && (
                  <div className="flex h-full flex-col">
                    {/* Note Editor - when editing */}
                    {editingNote && (
                      <div className="border-b border-gray-200 bg-yellow-50 p-4">
                        <div className="mb-2">
                          <p className="mb-1 text-[10px] font-medium text-gray-500 uppercase">
                            Add note to:
                          </p>
                          <p className="line-clamp-2 text-xs text-gray-600 italic">
                            "{editingNote.content}"
                          </p>
                        </div>
                        <textarea
                          value={noteInputText}
                          onChange={(e) => setNoteInputText(e.target.value)}
                          placeholder="写下你的笔记..."
                          className="mb-2 h-24 w-full resize-none rounded-lg border border-yellow-300 bg-white p-3 text-xs focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 focus:outline-none"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={handleCancelNote}
                            className="rounded px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveNote}
                            disabled={!noteInputText.trim()}
                            className="rounded bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-yellow-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                          >
                            Save note
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Notes List */}
                    <div className="flex-1 overflow-y-auto p-4">
                      {notes.length === 0 && !editingNote ? (
                        <div className="py-8 text-center">
                          <svg
                            className="mx-auto mb-3 h-12 w-12 text-gray-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                          <p className="text-sm font-medium text-gray-600">No notes</p>
                          <p className="mt-1 text-xs text-gray-400">
                            Double-click on the left content to add notes
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {notes.map((note) => (
                            <div
                              key={note.id}
                              className="group rounded-lg border border-yellow-200 bg-yellow-50 p-3 transition-colors hover:border-yellow-300"
                            >
                              {/* Content preview */}
                              <p className="mb-2 line-clamp-1 text-[10px] text-gray-500 italic">
                                "{note.contentPreview}..."
                              </p>

                              {/* Note text */}
                              <p className="text-xs leading-relaxed text-gray-800">
                                {note.noteText}
                              </p>

                              {/* Footer */}
                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-[10px] text-gray-400">
                                  {note.createdAt.toLocaleDateString()}
                                </span>
                                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button
                                    onClick={() => {
                                      // Find the original content (V2.0: use main_body)
                                      const sectionIndex = parseInt(
                                        note.sectionId.replace("section-", ""),
                                        10,
                                      );
                                      const section = videoData?.main_body?.[sectionIndex];
                                      const content =
                                        section?.content_markdown || note.contentPreview;
                                      setEditingNote({
                                        sectionId: note.sectionId,
                                        sentenceIndex: note.sentenceIndex,
                                        content,
                                      });
                                      setNoteInputText(note.noteText);
                                    }}
                                    className="rounded p-1 text-gray-400 transition-colors hover:bg-yellow-100 hover:text-yellow-600"
                                    title="编辑"
                                  >
                                    <svg
                                      className="h-3 w-3"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteNote(note.id)}
                                    className="rounded p-1 text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600"
                                    title="删除"
                                  >
                                    <svg
                                      className="h-3 w-3"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Comments Panel - Disabled
              <div className="flex max-h-[400px] flex-col border-t border-gray-200">
                <div className="border-b border-gray-100 px-4 py-3">
                  <button
                    onClick={() => setIsCommentsExpanded(!isCommentsExpanded)}
                    className="-mx-4 -my-3 flex w-full items-center justify-between gap-2 rounded-t-lg px-4 py-3 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                      <span className="text-xs font-medium text-gray-700">Comments</span>
                    </div>
                    <svg
                      className={`h-4 w-4 text-gray-400 transition-transform ${isCommentsExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>

                {isCommentsExpanded && (
                  <div className="flex min-h-0 flex-1 flex-col">
                    {!selectedSentence ? (
                      <div className="px-4 py-8 text-center">
                        <svg
                          className="mx-auto mb-2 h-8 w-8 text-gray-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                          />
                        </svg>
                        <p className="text-xs text-gray-500">悬停在句子上</p>
                        <p className="text-xs text-gray-400">查看或添加评论</p>
                      </div>
                    ) : (
                      <>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                          {sidebarCommentsLoading ? (
                            <div className="flex items-center justify-center py-6">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                            </div>
                          ) : sidebarComments.length === 0 ? (
                            <div className="px-4 py-6 text-center">
                              <p className="text-xs text-gray-500">暂无评论</p>
                              <p className="text-xs text-gray-400">成为第一个评论者！</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-50">
                              {sidebarComments.map((comment) => (
                                <div key={comment.id} className="px-4 py-3">
                                  <div className="flex gap-2">
                                    {comment.avatar && (
                                      <img
                                        src={comment.avatar}
                                        alt={comment.author}
                                        className="h-5 w-5 flex-shrink-0 rounded-full bg-gray-100"
                                      />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="mb-1 flex items-baseline gap-1">
                                        <span className="text-[11px] font-medium text-gray-900">
                                          {comment.author}
                                        </span>
                                        {comment.is_ai_generated && (
                                          <span className="rounded bg-purple-100 px-1 py-0.5 text-[8px] font-medium text-purple-600">
                                            AI
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] leading-relaxed text-gray-700">
                                        {comment.comment_text}
                                      </p>
                                      <span className="text-[9px] text-gray-400">
                                        {new Date(comment.created_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <form
                          onSubmit={handleSubmitSidebarComment}
                          className="border-t border-gray-100 p-3"
                        >
                          <input
                            type="text"
                            placeholder="你的名字（可选）"
                            value={sidebarAuthorName}
                            onChange={(e) => setSidebarAuthorName(e.target.value)}
                            className="mb-2 w-full rounded border border-gray-200 px-2 py-1 text-[11px] focus:border-blue-400 focus:outline-none"
                          />
                          <div className="flex gap-1">
                            <input
                              type="text"
                              placeholder="添加评论..."
                              value={newSidebarComment}
                              onChange={(e) => setNewSidebarComment(e.target.value)}
                              className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-[11px] focus:border-blue-400 focus:outline-none"
                              disabled={isSubmittingSidebarComment}
                            />
                            <button
                              type="submit"
                              disabled={!newSidebarComment.trim() || isSubmittingSidebarComment}
                              className="rounded bg-blue-600 px-2 py-1.5 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                              {isSubmittingSidebarComment ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                              ) : (
                                <svg
                                  className="h-3 w-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                  />
                                </svg>
                              )}
                            </button>
                          </div>
                        </form>
                      </>
                    )}
                  </div>
                )}
              </div>
              */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
