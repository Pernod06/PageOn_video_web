import { defineEventHandler, readBody, getHeader, createError } from "h3";
import { getLLMService } from "../../server/services/llm.service";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as {
    message: string;
    video_context?: Record<string, unknown> | null;
  };

  if (!body.message) {
    throw createError({ statusCode: 400, statusMessage: "message is required" });
  }

  const userId =
    getHeader(event, "x-session-id") ??
    event.node.req.socket.remoteAddress ??
    "anonymous";

  try {
    const llm = getLLMService();
    const videoId = String(body.video_context?.videoId ?? "default");

    const response = await llm.chatWithVideo(
      body.message,
      body.video_context ?? null,
      videoId,
      userId,
    );

    return {
      success: true,
      response,
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    console.error(`[ERROR] Chat failed: ${e}`);
    throw createError({
      statusCode: 500,
      statusMessage: `Chat failed: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
});
