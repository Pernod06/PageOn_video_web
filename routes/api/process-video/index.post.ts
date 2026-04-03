import { defineEventHandler, readBody, createError } from "h3";
import { extractVideoId } from "../../../server/services/youtube-client.service";
import {
  getCachedVideoFromSupabase,
  isV2VideoData,
  saveVideoToSupabase,
  getVideoTitleFromV2,
  recordUserUsage,
} from "../../../server/services/supabase.service";
import { getFullTranscript, formatTranscriptLines } from "../../../server/services/transcript.service";
import { getLLMService } from "../../../server/services/llm.service";
import { extractYouTubeChapters } from "../../../server/services/video-frame.service";
import { addSectionThumbnails, buildFallbackV2Article } from "../../../server/utils/video-helpers";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as {
    url: string;
    language?: string;
    user_id?: string;
  };

  if (!body.url) {
    throw createError({ statusCode: 400, statusMessage: "URL is required" });
  }

  const language = body.language ?? "en";

  try {
    const videoId = extractVideoId(body.url);
    if (!videoId) {
      throw createError({ statusCode: 400, statusMessage: "Cannot extract video ID from URL" });
    }

    // Check Supabase cache
    const cached = await getCachedVideoFromSupabase(videoId);
    if (cached && isV2VideoData(cached.video_data)) {
      let cachedData = cached.video_data as Record<string, unknown>;

      if (language && language !== "en") {
        const llm = getLLMService();
        cachedData = await llm.translateVideoData(cachedData, language);
      }

      return {
        success: true,
        videoId,
        title: getVideoTitleFromV2(cachedData),
        transcriptLength: String(cached.transcript ?? "").length,
        video_data: cachedData,
        meta: cachedData.meta ?? {},
        chapters: cachedData.chapters ?? [],
        main_body: cachedData.main_body ?? [],
        message: "Video processed (cached)",
        cached: true,
      };
    }

    // Fetch transcript
    const result = await getFullTranscript(body.url);
    if (!result) {
      throw createError({ statusCode: 500, statusMessage: "Cannot fetch transcript" });
    }

    const { transcript, details } = result;

    // LLM analysis
    const llm = getLLMService();
    let videoDataJson: Record<string, unknown>;
    try {
      videoDataJson = (await llm.analyzeVideoTranscript(
        transcript,
        details as unknown as Record<string, unknown>,
        videoId,
      )) as unknown as Record<string, unknown>;
    } catch (llmErr) {
      console.warn(`[WARN] LLM failed: ${llmErr}`);
      videoDataJson = buildFallbackV2Article(videoId, details.title);
    }

    // Get chapters
    try {
      const [videoTitle, chapters] = await extractYouTubeChapters(videoId);
      if (videoTitle) {
        (videoDataJson.meta as Record<string, unknown>).title = videoTitle;
      }
      videoDataJson.chapters = chapters;
      if (Array.isArray(videoDataJson.main_body) && chapters.length > 0) {
        videoDataJson.main_body = addSectionThumbnails(
          videoDataJson.main_body as Record<string, unknown>[],
          chapters,
        );
      }
    } catch {
      videoDataJson.chapters = [];
    }

    // Save to Supabase
    const lines = formatTranscriptLines(transcript, details);
    const title = getVideoTitleFromV2(videoDataJson as Record<string, unknown>, `Video ${videoId}`);
    const transcriptText = `${title}\n${"=".repeat(70)}\n\n${lines.join("\n")}`;

    await saveVideoToSupabase(
      videoId,
      videoDataJson,
      transcriptText,
      (videoDataJson.chapters ?? []) as unknown[],
    );

    // Translate if needed
    let responseData = videoDataJson;
    if (language && language !== "en") {
      responseData = await llm.translateVideoData(videoDataJson, language);
    }

    if (body.user_id) {
      await recordUserUsage(body.user_id, videoId, title);
    }

    return {
      success: true,
      videoId,
      title: getVideoTitleFromV2(responseData as Record<string, unknown>, title),
      transcriptLength: transcript.length,
      video_data: responseData,
      meta: responseData.meta ?? {},
      chapters: responseData.chapters ?? [],
      main_body: responseData.main_body ?? [],
      message: "Video processed successfully",
      cached: false,
    };
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e;
    console.error(`[ERROR] /api/process-video: ${e}`);
    throw createError({ statusCode: 500, statusMessage: `Video processing failed: ${e}` });
  }
});
