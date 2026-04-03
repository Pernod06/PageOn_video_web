import { defineEventHandler, getRouterParam, createError } from "h3";
import { getVideoDetails } from "../../server/services/youtube-client.service";

export default defineEventHandler(async (event) => {
  const videoId = getRouterParam(event, "video_id")!;

  try {
    const info = await getVideoDetails(videoId);
    if (!info) {
      throw createError({ statusCode: 404, statusMessage: "Video not found" });
    }

    return {
      success: true,
      videoId,
      title: info.title,
      description: info.description,
      channelTitle: info.channel_title,
      publishedAt: info.published_at,
      duration: info.duration,
      viewCount: info.view_count,
      likeCount: info.like_count,
      thumbnail: info.thumbnails.maxres ?? info.thumbnails.high ?? "",
    };
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e;
    throw createError({ statusCode: 500, statusMessage: String(e) });
  }
});
