import { defineEventHandler, readBody, createError } from "h3";
import { getLLMService } from "../../../server/services/llm.service";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as {
    video_data: Record<string, unknown>;
    language?: string;
  };

  if (!body.video_data) {
    throw createError({ statusCode: 400, statusMessage: "video_data is required" });
  }

  try {
    const llm = getLLMService();
    const result = await llm.generateThemes(body.video_data, body.language ?? "en");
    return { success: true, themes: result.themes };
  } catch (e) {
    throw createError({ statusCode: 500, statusMessage: String(e) });
  }
});
