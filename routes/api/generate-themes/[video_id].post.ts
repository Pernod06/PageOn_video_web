import { defineEventHandler, getRouterParam, getQuery, setResponseHeaders, createError } from "h3";
import {
  getCachedVideoFromSupabase,
  isV2VideoData,
} from "../../../server/services/supabase.service";
import { getLLMService } from "../../../server/services/llm.service";

export default defineEventHandler(async (event) => {
  const videoId = getRouterParam(event, "video_id")!;
  const { stream, language } = getQuery(event) as { stream?: string; language?: string };
  const isStream = stream === "true" || stream === "1";
  const lang = language ?? "en";

  try {
    const cached = await getCachedVideoFromSupabase(videoId);
    if (!cached || !isV2VideoData(cached.video_data)) {
      throw createError({ statusCode: 404, statusMessage: `Video data not found: ${videoId}` });
    }

    const videoData = cached.video_data as Record<string, unknown>;
    const llm = getLLMService();

    if (isStream) {
      setResponseHeaders(event, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const res = event.node.res;
      for await (const chunk of llm.generateThemesStream(videoData, lang)) {
        if (chunk === "\n[STREAM_END]") continue;
        res.write(`data: ${JSON.stringify({ type: "delta", content: chunk })}\n\n`);
      }
      res.write(`data: [DONE]\n\n`);
      res.end();
      return;
    }

    const result = await llm.generateThemes(videoData, lang);
    return { success: true, themes: result.themes };
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e;
    throw createError({ statusCode: 500, statusMessage: String(e) });
  }
});
