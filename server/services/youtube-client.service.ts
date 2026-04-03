/**
 * YouTube Data API v3 Client
 * Migrated from youtube_client.py
 */
import { google, type youtube_v3 } from "googleapis";
import { envString } from "../utils/env";

function getYouTubeApi(): youtube_v3.Youtube {
  const apiKey = envString("YOUTUBE_API_KEY");
  if (!apiKey) throw new Error("YOUTUBE_API_KEY not configured");
  return google.youtube({ version: "v3", auth: apiKey });
}

/** Extract video ID from a YouTube URL or bare ID */
export function extractVideoId(url: string): string | null {
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (["www.youtube.com", "youtube.com", "m.youtube.com"].includes(parsed.hostname)) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      const m = parsed.pathname.match(/^\/(embed|v)\/([^/]+)/);
      if (m) return m[2];
    }
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1);
  } catch { /* not a URL */ }
  return null;
}

/** Format ISO 8601 duration (PT1H2M3S) to readable string */
function formatDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return iso;
  const h = parseInt(m[1] || "0");
  const min = parseInt(m[2] || "0");
  const sec = parseInt(m[3] || "0");
  return h > 0
    ? `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${min}:${String(sec).padStart(2, "0")}`;
}

/** Format relative date string */
function formatRelativeDate(isoDate: string): string | null {
  try {
    const pub = new Date(isoDate);
    const diffMs = Date.now() - pub.getTime();
    const days = Math.floor(diffMs / 86_400_000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) {
      const w = Math.floor(days / 7);
      return `${w} week${w > 1 ? "s" : ""} ago`;
    }
    if (days < 365) {
      const mo = Math.floor(days / 30);
      return `${mo} month${mo > 1 ? "s" : ""} ago`;
    }
    const y = Math.floor(days / 365);
    return `${y} year${y > 1 ? "s" : ""} ago`;
  } catch {
    return isoDate.slice(0, 10);
  }
}

export interface VideoSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  url: string;
  duration: string;
  channel: string;
  views: number;
  publishedDate: string | null;
}

export interface VideoDetails {
  video_id: string;
  title: string;
  description: string;
  channel_title: string;
  published_at: string;
  duration: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  thumbnails: Record<string, string | undefined>;
}

/**
 * Search videos using YouTube Data API v3 with details (duration, views).
 * Matches Python backend's search endpoint response format.
 */
export async function searchVideos(
  query: string,
  opts: {
    maxResults?: number;
    order?: string;
    duration?: string;
    publishedAfter?: string;
  } = {},
): Promise<VideoSearchResult[]> {
  const yt = getYouTubeApi();
  const maxResults = opts.maxResults ?? 10;
  const order = opts.order ?? "viewCount";
  const duration = opts.duration ?? "long";

  const timeMapping: Record<string, number> = {
    hour: 3_600_000,
    today: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000,
    year: 31_536_000_000,
  };

  const searchParams: youtube_v3.Params$Resource$Search$List = {
    q: query,
    part: ["id", "snippet"],
    maxResults,
    type: ["video"],
    order,
  };

  if (duration && duration !== "any") {
    searchParams.videoDuration = duration as "short" | "medium" | "long";
  }

  if (opts.publishedAfter) {
    if (timeMapping[opts.publishedAfter]) {
      const d = new Date(Date.now() - timeMapping[opts.publishedAfter]);
      searchParams.publishedAfter = d.toISOString();
    } else if (opts.publishedAfter.includes("T")) {
      searchParams.publishedAfter = opts.publishedAfter;
    }
  }

  const searchRes = await yt.search.list(searchParams);
  const items = searchRes.data.items ?? [];

  const videoIds = items.map((i) => i.id!.videoId!).filter(Boolean);
  if (videoIds.length === 0) return [];

  // Fetch details (duration + stats) in one batch call
  const detailsRes = await yt.videos.list({
    part: ["contentDetails", "statistics"],
    id: videoIds,
  });

  const detailsMap = new Map<string, youtube_v3.Schema$Video>();
  for (const item of detailsRes.data.items ?? []) {
    detailsMap.set(item.id!, item);
  }

  return items.map((item) => {
    const vid = item.id!.videoId!;
    const snippet = item.snippet!;
    const detail = detailsMap.get(vid);
    const thumbs = snippet.thumbnails ?? {};
    const thumbnail =
      thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ??
      `https://img.youtube.com/vi/${vid}/maxresdefault.jpg`;

    return {
      videoId: vid,
      title: snippet.title ?? "",
      thumbnail,
      url: `https://www.youtube.com/watch?v=${vid}`,
      duration: detail ? formatDuration(detail.contentDetails?.duration ?? "") : "",
      channel: snippet.channelTitle ?? "",
      views: Number(detail?.statistics?.viewCount ?? 0),
      publishedDate: formatRelativeDate(snippet.publishedAt ?? ""),
    };
  });
}

/** Get full details for a single video */
export async function getVideoDetails(videoId: string): Promise<VideoDetails | null> {
  const yt = getYouTubeApi();
  const res = await yt.videos.list({
    part: ["snippet", "contentDetails", "statistics"],
    id: [videoId],
  });

  const item = res.data.items?.[0];
  if (!item) return null;

  const snippet = item.snippet!;
  const stats = item.statistics ?? {};
  const thumbs = snippet.thumbnails ?? {};

  return {
    video_id: videoId,
    title: snippet.title ?? "",
    description: snippet.description ?? "",
    channel_title: snippet.channelTitle ?? "",
    published_at: snippet.publishedAt ?? "",
    duration: item.contentDetails?.duration ?? "",
    view_count: Number(stats.viewCount ?? 0),
    like_count: Number(stats.likeCount ?? 0),
    comment_count: Number(stats.commentCount ?? 0),
    thumbnails: {
      default: thumbs.default?.url ?? undefined,
      medium: thumbs.medium?.url ?? undefined,
      high: thumbs.high?.url ?? undefined,
      standard: thumbs.standard?.url ?? undefined,
      maxres: thumbs.maxres?.url ?? undefined,
    },
  };
}
