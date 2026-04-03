import { defineEventHandler, readBody, setResponseHeaders } from "h3";
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
import { extractJson } from "../../../server/utils/json-extractor";
import { addSectionThumbnails, buildFallbackV2Article } from "../../../server/utils/video-helpers";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as {
    url: string;
    language?: string;
    user_id?: string;
  };

  const url = body.url;
  const language = body.language ?? "en";
  const userId = body.user_id;

  // Set SSE headers
  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const res = event.node.res;

  const send = (data: string) => {
    res.write(`data: ${data}\n\n`);
  };

  try {
    const videoId = extractVideoId(url ?? "");
    if (!videoId) {
      send("[ERROR] Cannot extract video ID from URL");
      res.end();
      return;
    }

    // Check cache
    const cached = await getCachedVideoFromSupabase(videoId);
    if (cached && isV2VideoData(cached.video_data)) {
      let cachedData = cached.video_data as Record<string, unknown>;

      // Add thumbnails if missing
      if (Array.isArray(cachedData.main_body)) {
        const hasThumbnails = (cachedData.main_body as Record<string, unknown>[]).some(
          (s) => s.thumbnail_url,
        );
        if (!hasThumbnails) {
          try {
            const [, chapters] = await extractYouTubeChapters(videoId);
            if (chapters.length > 0) {
              cachedData.main_body = addSectionThumbnails(
                cachedData.main_body as Record<string, unknown>[],
                chapters,
              );
              if (!cachedData.chapters) cachedData.chapters = chapters;
            }
          } catch { /* ignore */ }
        }
      }

      if (language && language !== "en") {
        const llm = getLLMService();
        cachedData = await llm.translateVideoData(cachedData, language);
      }

      send(`[CACHED] ${JSON.stringify(cachedData)}`);
      res.end();
      return;
    }

    // Fetch transcript
    const result = await getFullTranscript(url);
    if (!result) {
      send("[ERROR] Cannot fetch transcript");
      res.end();
      return;
    }

    const { transcript, details } = result;

    // Stream LLM analysis
    const llm = getLLMService();
    let fullResponse = "";

    for await (const chunk of llm.analyzeVideoTranscriptStream(
      transcript,
      details as unknown as Record<string, unknown>,
      videoId,
    )) {
      if (chunk === "\n[STREAM_END]") continue;
      fullResponse += chunk;
      send(JSON.stringify({ type: "delta", content: chunk }));
    }

    // Parse result
    let videoDataJson: Record<string, unknown>;
    try {
      const parsed = extractJson<Record<string, unknown>>(
        fullResponse.replace("[STREAM_END]", "").trim(),
      );
      if (!parsed || !Array.isArray(parsed.main_body)) {
        throw new Error("Invalid V2 schema");
      }
      videoDataJson = parsed;
    } catch {
      try {
        videoDataJson = llm.parseAnalysisResult(fullResponse) as unknown as Record<string, unknown>;
      } catch {
        videoDataJson = buildFallbackV2Article(videoId, details.title);
      }
    }

    // Get chapters and add thumbnails
    try {
      const [videoTitle, chapters] = await extractYouTubeChapters(videoId);
      if (videoTitle) {
        ((videoDataJson.meta as Record<string, unknown>) ??= {}).title = videoTitle;
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

    // Generate key takeaways image (non-blocking)
    let imageUrl: string | null = null;
    try {
      imageUrl = await llm.generateKeyTakeawaysImage(fullResponse, videoId, false);
      if (imageUrl) {
        videoDataJson.key_takeaways_image_url = imageUrl;
      }
    } catch { /* ignore */ }

    // Send complete JSON
    send(`[DONE] ${JSON.stringify(videoDataJson)}`);

    // Save to Supabase (after sending to client)
    const lines = formatTranscriptLines(transcript, details);
    const videoTitle = getVideoTitleFromV2(videoDataJson as Record<string, unknown>, `Video ${videoId}`);
    const transcriptText = `${videoTitle}\n${"=".repeat(70)}\n\n${lines.join("\n")}`;

    await saveVideoToSupabase(
      videoId,
      videoDataJson,
      transcriptText,
      (videoDataJson.chapters ?? []) as unknown[],
    );

    // Save image status
    if (imageUrl) {
      try {
        const { getSupabaseClient } = await import("../../../server/services/supabase.service");
        const client = getSupabaseClient(true);
        await client.from("key_takeaways_images").upsert({
          video_id: videoId,
          image_url: imageUrl,
          status: "completed",
          error_message: "",
        });
      } catch { /* ignore */ }
    }

    // Record usage
    if (userId) {
      await recordUserUsage(userId, videoId, videoTitle);
    }
  } catch (e) {
    send(`[ERROR] ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    res.end();
  }
});
