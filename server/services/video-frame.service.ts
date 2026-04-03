/**
 * Video Frame Extractor — YouTube chapter thumbnails + yt-dlp fallback
 * Migrated from video_frame_extractor.py
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { parseTimestampToSeconds } from "../utils/timestamp";

const execFileAsync = promisify(execFile);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface Chapter {
  timestamp: number;
  title: string;
  thumbnail_url: string | null;
}

/**
 * Scrape chapter info from YouTube's ytInitialData.
 * Returns [videoTitle, chapters].
 */
export async function extractYouTubeChapters(
  videoId: string,
): Promise<[string, Chapter[]]> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(10_000),
    });
    const html = await res.text();

    const dataMatch = html.match(/var ytInitialData = ({.*?});/s);
    if (!dataMatch) {
      console.log("[WARNING] ytInitialData not found, trying yt-dlp fallback...");
      return extractChaptersFallback(videoId);
    }

    const data = JSON.parse(dataMatch[1]);

    // Extract title
    let videoTitle = "";
    try {
      const contents =
        data.contents?.twoColumnWatchNextResults?.results?.results?.contents ?? [];
      for (const c of contents) {
        if (c.videoPrimaryInfoRenderer) {
          videoTitle = (c.videoPrimaryInfoRenderer.title.runs ?? [])
            .map((r: { text: string }) => r.text)
            .join("");
          break;
        }
      }
    } catch {
      const titleMatch = html.match(/<title>(.+?) - YouTube<\/title>/);
      if (titleMatch) videoTitle = titleMatch[1];
    }

    // Path 1: playerOverlays
    try {
      const decorated =
        data.playerOverlays?.playerOverlayRenderer?.decoratedPlayerBarRenderer
          ?.decoratedPlayerBarRenderer;
      const markersMap =
        decorated?.playerBar?.multiMarkersPlayerBarRenderer?.markersMap ?? [];

      for (const group of markersMap) {
        const chapterList = group?.value?.chapters;
        if (!chapterList) continue;

        const chapters: Chapter[] = chapterList.map(
          (ch: Record<string, unknown>) => {
            const r = ch.chapterRenderer as Record<string, unknown> | undefined;
            if (!r) return { timestamp: 0, title: "", thumbnail_url: null };
            const thumbs = ((r.thumbnail as Record<string, unknown>)?.thumbnails ?? []) as {
              url: string;
            }[];
            return {
              timestamp: Math.floor(Number(r.timeRangeStartMillis ?? 0) / 1000),
              title: String((r.title as Record<string, string>)?.simpleText ?? ""),
              thumbnail_url: thumbs.length > 0 ? thumbs[thumbs.length - 1].url : null,
            };
          },
        );

        return [videoTitle, chapters];
      }
    } catch { /* fall through */ }

    // Path 2: engagementPanels
    try {
      const panels = data.engagementPanels ?? [];
      for (const panel of panels) {
        const macro =
          panel?.engagementPanelSectionListRenderer?.content?.macroMarkersListRenderer;
        if (!macro) continue;

        const chapters: Chapter[] = (macro.contents ?? []).map(
          (item: Record<string, unknown>) => {
            const marker = item.macroMarkersListItemRenderer as Record<string, unknown> | undefined;
            if (!marker) return { timestamp: 0, title: "", thumbnail_url: null };
            const timeStr = String(
              (marker.timeDescription as Record<string, string>)?.simpleText ?? "0:00",
            );
            const thumbs = ((marker.thumbnail as Record<string, unknown>)?.thumbnails ?? []) as {
              url: string;
            }[];
            return {
              timestamp: parseTimestampToSeconds(timeStr),
              title: String((marker.title as Record<string, string>)?.simpleText ?? ""),
              thumbnail_url: thumbs.length > 0 ? thumbs[thumbs.length - 1].url : null,
            };
          },
        );

        if (chapters.length > 0) return [videoTitle, chapters];
      }
    } catch { /* fall through */ }

    return [videoTitle, []];
  } catch (e) {
    console.error(`[ERROR] extractYouTubeChapters: ${e}`);
    return ["", []];
  }
}

/** Fallback: use yt-dlp to get chapters */
async function extractChaptersFallback(
  videoId: string,
): Promise<[string, Chapter[]]> {
  try {
    const { stdout } = await execFileAsync(
      "yt-dlp",
      ["--dump-json", "--skip-download", `https://www.youtube.com/watch?v=${videoId}`],
      { timeout: 15_000 },
    );
    const data = JSON.parse(stdout);
    const videoTitle = data.title ?? "";
    const chapters: Chapter[] = (data.chapters ?? []).map(
      (ch: { start_time?: number; title?: string }) => ({
        timestamp: Math.floor(ch.start_time ?? 0),
        title: ch.title ?? "",
        thumbnail_url: null,
      }),
    );
    return [videoTitle, chapters];
  } catch (e) {
    console.error(`[ERROR] yt-dlp fallback failed: ${e}`);
    return ["", []];
  }
}

/**
 * Extract a single frame at a given timestamp.
 * First tries chapter thumbnails, then falls back to yt-dlp + ffmpeg.
 * Returns the local file path.
 */
export async function extractFrameAtTimestamp(
  videoId: string,
  timestampSeconds: number,
  outputPath?: string,
): Promise<string> {
  const out = outputPath ?? `/tmp/frame_${videoId}_${timestampSeconds}.jpg`;

  const [, chapters] = await extractYouTubeChapters(videoId);

  if (chapters.length > 0) {
    let closest: Chapter | null = null;
    let minDiff = Infinity;
    for (const ch of chapters) {
      const diff = Math.abs(ch.timestamp - timestampSeconds);
      if (diff < minDiff) {
        minDiff = diff;
        closest = ch;
      }
    }

    if (closest?.thumbnail_url) {
      try {
        const res = await fetch(closest.thumbnail_url, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(10_000),
        });
        const buffer = Buffer.from(await res.arrayBuffer());
        const { writeFileSync } = await import("fs");
        writeFileSync(out, buffer);
        return out;
      } catch { /* fall through to traditional */ }
    }
  }

  return extractFrameTraditional(videoId, timestampSeconds, out);
}

async function extractFrameTraditional(
  videoId: string,
  timestampSeconds: number,
  outputPath: string,
): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const { stdout } = await execFileAsync(
    "yt-dlp",
    ["--quiet", "--no-warnings", "--get-url", "-f", "best", url],
    { timeout: 30_000 },
  );
  const videoUrl = stdout.trim().split("\n")[0];

  await execFileAsync(
    "ffmpeg",
    ["-ss", String(timestampSeconds), "-i", videoUrl, "-vframes", "1", "-q:v", "2", "-y", outputPath],
    { timeout: 30_000 },
  );

  if (!existsSync(outputPath)) {
    throw new Error("Frame extraction failed");
  }
  return outputPath;
}

/** Batch extract frames for multiple timestamps */
export async function extractMultipleFrames(
  videoId: string,
  timestamps: number[],
): Promise<Array<{ timestamp: number; path?: string; error?: string; success: boolean }>> {
  const results = [];
  for (const ts of timestamps) {
    try {
      const path = await extractFrameAtTimestamp(videoId, ts);
      results.push({ timestamp: ts, path, success: true });
    } catch (e) {
      results.push({ timestamp: ts, error: String(e), success: false });
    }
  }
  return results;
}
