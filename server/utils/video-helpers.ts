/**
 * Video processing helper utilities
 * Migrated from main.py helper functions
 */
import { parseTimestampToSeconds } from "./timestamp";

interface Chapter {
  timestamp: number;
  title: string;
  thumbnail_url: string | null;
}

/**
 * Add chapter thumbnails to main_body sections based on timestamp matching.
 */
export function addSectionThumbnails(
  mainBody: Record<string, unknown>[],
  chapters: Chapter[],
): Record<string, unknown>[] {
  if (!chapters.length) return mainBody;

  return mainBody.map((section) => {
    const tsRef = String(section.timestamp_ref ?? "00:00");
    const sectionSec = parseTimestampToSeconds(tsRef);

    let closest: Chapter | null = null;
    let minDiff = Infinity;
    for (const ch of chapters) {
      const diff = Math.abs(ch.timestamp - sectionSec);
      if (diff < minDiff) {
        minDiff = diff;
        closest = ch;
      }
    }

    if (closest?.thumbnail_url) {
      return { ...section, thumbnail_url: closest.thumbnail_url };
    }
    return section;
  });
}

/**
 * Build a minimal fallback V2 article when LLM fails.
 */
export function buildFallbackV2Article(
  videoId: string,
  title = "",
): Record<string, unknown> {
  const safeTitle = title || `Video ${videoId}`;
  const fallbackMsg = "Structured analysis is temporarily unavailable. Please retry.";
  return {
    meta: {
      title: safeTitle,
      tags: [],
      reading_time: "5 min",
      difficulty: "Intermediate",
      last_updated: new Date().toISOString().slice(0, 10),
    },
    header_hook: { quote: safeTitle, author: "" },
    summary_box: { key_insight: fallbackMsg, bullet_points: [fallbackMsg] },
    background_cards: [],
    main_body: [
      {
        section_title: "Content",
        content_markdown: fallbackMsg,
        timestamp_ref: "00:00",
        visual_break: null,
      },
    ],
    deep_analysis: { mermaid_graph: "", deep_points: [] },
    qa_interactions: [],
    footer: { resources: [], actionable_next_steps: [] },
    chapters: [],
  };
}
