/**
 * Transcript Service — fetches YouTube transcripts via TranscriptAPI.com
 * Migrated from get_full_transcript_ytdlp.py
 */
import { envString } from "../utils/env";
import { getVideoDetails } from "./youtube-client.service";

const DEFAULT_TRANSCRIPT_KEY = "sk_xEEnrdnWKBMM4zt6wI8klBfnaX3KspU86fGw1V0oMnU";

export interface TranscriptEntry {
  start: number;
  text: string;
  duration?: number;
}

export interface VideoTranscriptResult {
  transcript: TranscriptEntry[];
  details: {
    title: string;
    video_id: string;
    duration: string | number;
    view_count: number;
  };
}

/**
 * Fetch full transcript for a YouTube video via TranscriptAPI.com
 */
export async function getFullTranscript(
  videoIdOrUrl: string,
): Promise<VideoTranscriptResult | null> {
  // Extract video ID if URL
  let videoId = videoIdOrUrl;
  if (videoIdOrUrl.includes("youtube.com") || videoIdOrUrl.includes("youtu.be")) {
    const { extractVideoId } = await import("./youtube-client.service");
    videoId = extractVideoId(videoIdOrUrl) ?? videoIdOrUrl;
  }

  const apiKey = envString("TranscriptAPI_KEY") || envString("TRANSCRIPT_API_KEY") || DEFAULT_TRANSCRIPT_KEY;

  const url = new URL("https://transcriptapi.com/api/v2/youtube/transcript");
  url.searchParams.set("video_url", videoId);
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30_000),
  });

  const data = (await res.json()) as Record<string, unknown>;

  if (data.error || (data.detail && !data.transcript)) {
    console.error(`[Transcript] API error: ${data.error ?? data.detail}`);
    return null;
  }

  const transcript = data.transcript as TranscriptEntry[] | undefined;
  if (!transcript || transcript.length === 0) {
    console.error("[Transcript] No transcript available");
    return null;
  }

  // Get video details from YouTube API
  let title = String(data.title ?? `Video ${videoId}`);
  let duration: string | number = 0;
  let viewCount = 0;

  try {
    const details = await getVideoDetails(videoId);
    if (details) {
      title = details.title || title;
      duration = details.duration;
      viewCount = details.view_count;
    }
  } catch {
    // YouTube API may not be configured
  }

  return {
    transcript,
    details: {
      title,
      video_id: videoId,
      duration,
      view_count: viewCount,
    },
  };
}

/** Format transcript entries to text lines */
export function formatTranscriptLines(
  transcript: TranscriptEntry[],
  details?: { title?: string },
): string[] {
  const toTs = (s: number) => {
    const t = Math.floor(s);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = t % 60;
    return h > 0
      ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return transcript.map((e) => `[${toTs(e.start)}] ${e.text}`);
}
