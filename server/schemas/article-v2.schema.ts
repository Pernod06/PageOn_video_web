/**
 * V2 Article Zod schemas — replaces Pydantic models from llm_server.py
 */
import { z } from "zod";

export const ContentItemSchema = z.object({
  content: z.string().describe("Key point (1-2 sentences)"),
  timestampStart: z.string().describe("Timestamp HH:MM:SS"),
});

export const ThemeSchema = z.object({
  id: z.string().describe("Theme ID, e.g. theme1"),
  title: z.string().describe("Theme title"),
  description: z.string().describe("Theme brief description"),
  content: z.array(ContentItemSchema).describe("Related content from sections"),
});

export const ThemeResultSchema = z.object({
  themes: z.array(ThemeSchema).describe("2-5 themes"),
});

export const ArticleMetaSchema = z.object({
  title: z.string(),
  tags: z.array(z.string()),
  reading_time: z.string(),
  difficulty: z.string(),
  last_updated: z.string(),
});

export const HeaderHookSchema = z.object({
  quote: z.string(),
  author: z.string().default(""),
});

export const SummaryBoxSchema = z.object({
  key_insight: z.string(),
  bullet_points: z.array(z.string()),
});

export const BackgroundCardSchema = z.object({
  type: z.string(),
  name: z.string(),
  description: z.string(),
  icon_hint: z.string(),
});

export const VisualBreakSchema = z.object({
  type: z.string(),
  content: z.string(),
});

export const MainBodySectionSchema = z.object({
  section_title: z.string(),
  content_markdown: z.string(),
  timestamp_ref: z.string(),
  visual_break: VisualBreakSchema.optional().nullable(),
  image_prompt: z.string().optional(),
});

export const DeepPointSchema = z.object({
  title: z.string(),
  detailed_explanation: z.string(),
  evidence_quote: z.string(),
});

export const DeepAnalysisSchema = z.object({
  mermaid_graph: z.string(),
  deep_points: z.array(DeepPointSchema),
});

export const QAInteractionSchema = z.object({
  question: z.string(),
  answer: z.string(),
  type: z.string(),
});

export const ResourceSchema = z.object({
  name: z.string(),
  type: z.string(),
});

export const ArticleFooterSchema = z.object({
  resources: z.array(ResourceSchema).default([]),
  actionable_next_steps: z.array(z.string()),
});

export const StructuredArticleV2Schema = z.object({
  meta: ArticleMetaSchema,
  header_hook: HeaderHookSchema,
  summary_box: SummaryBoxSchema,
  background_cards: z.array(BackgroundCardSchema),
  main_body: z.array(MainBodySectionSchema),
  deep_analysis: DeepAnalysisSchema,
  qa_interactions: z.array(QAInteractionSchema),
  footer: ArticleFooterSchema,
  visual_summary_chart: z.object({
    title: z.string(),
    ascii_art: z.string(),
  }).optional(),
});

export type ContentItem = z.infer<typeof ContentItemSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type ThemeResult = z.infer<typeof ThemeResultSchema>;
export type StructuredArticleV2 = z.infer<typeof StructuredArticleV2Schema>;
