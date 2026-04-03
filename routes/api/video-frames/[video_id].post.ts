import { defineEventHandler, getRouterParam, readBody, createError } from "h3";
import { extractMultipleFrames } from "../../server/services/video-frame.service";

export default defineEventHandler(async (event) => {
  const videoId = getRouterParam(event, "video_id")!;
  const body = (await readBody(event)) as { timestamps: number[] };

  if (!Array.isArray(body.timestamps) || body.timestamps.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "timestamps array is required" });
  }

  try {
    const results = await extractMultipleFrames(videoId, body.timestamps);

    const frames = results.map((r) =>
      r.success
        ? { timestamp: r.timestamp, success: true, url: `/api/video-frame/${videoId}?timestamp=${r.timestamp}` }
        : { timestamp: r.timestamp, success: false, error: r.error ?? "Unknown error" },
    );

    return { success: true, videoId, frames };
  } catch (e) {
    throw createError({ statusCode: 500, statusMessage: `Batch frame extraction failed: ${e}` });
  }
});
