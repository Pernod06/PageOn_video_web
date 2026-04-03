import { defineEventHandler, getRouterParam, createError } from "h3";
import { getCachedVideoFromSupabase } from "../../../server/services/supabase.service";

export default defineEventHandler(async (event) => {
  const videoId = getRouterParam(event, "video_id")!;

  try {
    const cached = await getCachedVideoFromSupabase(videoId);

    if (!cached || !cached.transcript) {
      throw createError({ statusCode: 404, statusMessage: `Transcript not found: ${videoId}` });
    }

    event.node.res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return cached.transcript as string;
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e;
    throw createError({ statusCode: 500, statusMessage: `Failed to read transcript: ${e}` });
  }
});
