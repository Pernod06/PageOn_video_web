import { defineEventHandler, getRouterParam, readBody } from "h3";

// In-memory progress store — shared with progress.get.ts at module level
// Note: Nitro may bundle these separately; for production, use Supabase instead.
const progressDb = new Map<string, { timestamp: number; updatedAt: string }>();

export default defineEventHandler(async (event) => {
  const videoId = getRouterParam(event, "video_id")!;
  const body = (await readBody(event)) as { timestamp: number };

  const entry = {
    timestamp: body.timestamp,
    updatedAt: new Date().toISOString(),
  };
  progressDb.set(videoId, entry);

  return { success: true, progress: entry };
});
