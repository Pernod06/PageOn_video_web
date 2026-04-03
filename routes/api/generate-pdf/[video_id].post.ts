import { defineEventHandler, getRouterParam, readBody, createError } from "h3";
import {
  getCachedVideoFromSupabase,
  getVideoTitleFromV2,
} from "../../../server/services/supabase.service";
import { generateVideoPdf } from "../../../server/services/pdf-generator.service";

export default defineEventHandler(async (event) => {
  const videoId = getRouterParam(event, "video_id")!;
  const body = ((await readBody(event).catch(() => null)) ?? {}) as {
    notes?: Array<{ text?: string; timestamp?: string }>;
    videoTitle?: string;
  };

  try {
    const cached = await getCachedVideoFromSupabase(videoId);
    if (!cached?.video_data) {
      throw createError({ statusCode: 404, statusMessage: `Video data not found: ${videoId}` });
    }

    const videoData = { ...(cached.video_data as Record<string, unknown>), video_id: videoId };
    if (body.videoTitle && !getVideoTitleFromV2(videoData)) {
      ((videoData.meta as Record<string, unknown>) ??= {}).title = body.videoTitle;
    }

    const pdfBuffer = await generateVideoPdf(videoData, body.notes ?? []);
    const title = getVideoTitleFromV2(videoData, "video");
    const safeTitle = title.replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 50) || videoId;
    const filename = `${safeTitle}_${new Date().toISOString().slice(0, 10)}.pdf`;

    event.node.res.setHeader("Content-Type", "application/pdf");
    event.node.res.setHeader(
      "Content-Disposition",
      `attachment; filename="${videoId}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return pdfBuffer;
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e;
    throw createError({ statusCode: 500, statusMessage: `PDF generation failed: ${e}` });
  }
});
