import { defineEventHandler, getRouterParam, getQuery, createError } from "h3";
import { google } from "googleapis";
import { envString } from "../../../../server/utils/env";

export default defineEventHandler(async (event) => {
  const videoId = getRouterParam(event, "video_id")!;
  const { maxResults } = getQuery(event) as { maxResults?: string };
  const limit = Math.min(Number(maxResults) || 20, 30);

  const apiKey = envString("YOUTUBE_API_KEY");
  if (!apiKey) {
    return {
      success: false,
      videoId,
      comments: [],
      total: 0,
      message: "YouTube API key not configured",
    };
  }

  try {
    const youtube = google.youtube({ version: "v3", auth: apiKey });
    const res = await youtube.commentThreads.list({
      part: ["snippet"],
      videoId,
      maxResults: limit,
      textFormat: "plainText",
    });

    const comments = (res.data.items ?? []).map((item) => {
      const snippet = item.snippet!.topLevelComment!.snippet!;
      return {
        author: snippet.authorDisplayName ?? "Unknown",
        text: snippet.textDisplay ?? "",
        like_count: snippet.likeCount ?? 0,
        published_at: snippet.publishedAt ?? "",
      };
    });

    return {
      success: true,
      videoId,
      comments,
      total: comments.length,
    };
  } catch (e: unknown) {
    console.error(`[ERROR] Failed to fetch comments for ${videoId}: ${e}`);
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      videoId,
      comments: [],
      total: 0,
      error: msg,
      message: "Failed to fetch comments",
    };
  }
});
