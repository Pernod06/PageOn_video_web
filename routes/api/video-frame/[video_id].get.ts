import { defineEventHandler, getRouterParam, getQuery, createError } from "h3";
import { extractFrameAtTimestamp } from "../../server/services/video-frame.service";
import { readFileSync } from "fs";

export default defineEventHandler(async (event) => {
  const videoId = getRouterParam(event, "video_id")!;
  const { timestamp } = getQuery(event) as { timestamp?: string };
  const ts = Number(timestamp) || 0;

  try {
    const framePath = await extractFrameAtTimestamp(videoId, ts);
    const buffer = readFileSync(framePath);

    event.node.res.setHeader("Content-Type", "image/jpeg");
    event.node.res.setHeader(
      "Content-Disposition",
      `inline; filename="frame_${videoId}_${ts}.jpg"`,
    );
    return buffer;
  } catch (e) {
    throw createError({ statusCode: 500, statusMessage: `Frame extraction failed: ${e}` });
  }
});
