import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from "h3";

// In-memory comment store (matches Python backend behavior)
const commentsDb = new Map<string, Array<Record<string, string>>>();

export default defineEventHandler(async (event) => {
  const videoId = getRouterParam(event, "video_id")!;
  const body = (await readBody(event)) as { comment: string; author?: string };

  const newComment = {
    id: String(Date.now()),
    author: body.author || "Anonymous",
    text: body.comment,
    timestamp: new Date().toISOString(),
  };

  if (!commentsDb.has(videoId)) {
    commentsDb.set(videoId, []);
  }
  commentsDb.get(videoId)!.push(newComment);

  setResponseStatus(event, 201);
  return newComment;
});
