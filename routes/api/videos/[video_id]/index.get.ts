import { defineEventHandler, getQuery, getRouterParam, createError } from "h3";
import {
  getCachedVideoFromSupabase,
  isV2VideoData,
} from "../../../server/services/supabase.service";

export default defineEventHandler(async (event) => {
  const videoId = getRouterParam(event, "video_id")!;
  const { language } = getQuery(event) as { language?: string };

  try {
    const cached = await getCachedVideoFromSupabase(videoId);

    if (!cached || !cached.video_data) {
      throw createError({ statusCode: 404, statusMessage: `Video data not found: ${videoId}` });
    }

    const videoData = cached.video_data as Record<string, unknown>;

    if (!isV2VideoData(videoData)) {
      throw createError({
        statusCode: 404,
        statusMessage: `Video data is old schema, needs re-analysis: ${videoId}`,
      });
    }

    // Translation for non-English languages will be implemented in Phase 5 (LLM service)
    if (language && language !== "en") {
      console.log(`[INFO] Translation to ${language} requested (will be implemented with LLM service)`);
    }

    return videoData;
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e;
    throw createError({ statusCode: 500, statusMessage: String(e) });
  }
});
