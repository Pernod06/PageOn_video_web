import { defineEventHandler, getRouterParam, createError } from "h3";
import { extractYouTubeChapters } from "../../server/services/video-frame.service";

export default defineEventHandler(async (event) => {
  const videoId = getRouterParam(event, "video_id")!;

  try {
    const [, chapters] = await extractYouTubeChapters(videoId);

    if (chapters.length === 0) {
      throw createError({ statusCode: 404, statusMessage: "No chapters found" });
    }

    return { success: true, chapters, total: chapters.length };
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e;
    throw createError({ statusCode: 500, statusMessage: String(e) });
  }
});
