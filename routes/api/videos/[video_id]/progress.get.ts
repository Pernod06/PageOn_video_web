import { defineEventHandler, getRouterParam } from "h3";

// In-memory progress store (matches Python backend behavior)
const progressDb = new Map<string, { timestamp: number; updatedAt?: string }>();

export { progressDb };

export default defineEventHandler(async (event) => {
  const videoId = getRouterParam(event, "video_id")!;
  return progressDb.get(videoId) ?? { timestamp: 0 };
});
