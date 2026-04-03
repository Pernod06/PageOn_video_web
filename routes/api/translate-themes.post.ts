import { defineEventHandler, readBody, createError } from "h3";
import { getLLMService } from "../../server/services/llm.service";
import { extractJson } from "../../server/utils/json-extractor";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as {
    themes: unknown[];
    language?: string;
  };

  const targetLanguage = body.language ?? "en";

  if (targetLanguage === "en" || !body.themes?.length) {
    return { success: true, themes: body.themes ?? [] };
  }

  try {
    const llm = getLLMService();
    const translated = await llm.translateVideoData(
      { themes: body.themes } as Record<string, unknown>,
      targetLanguage,
    );
    const translatedThemes = (translated as Record<string, unknown>).themes ?? body.themes;
    return { success: true, themes: translatedThemes };
  } catch (e) {
    console.error(`[ERROR] Translate themes failed: ${e}`);
    return { success: false, error: String(e), themes: body.themes };
  }
});
