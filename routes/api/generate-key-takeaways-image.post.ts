import { defineEventHandler, readBody, createError } from "h3";
import { envFlag } from "../../server/utils/env";
import {
  getCachedVideoFromSupabase,
  getSupabaseClient,
} from "../../server/services/supabase.service";
import { getLLMService } from "../../server/services/llm.service";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as {
    video_id: string;
    force_regenerate?: boolean;
  };

  const videoId = body.video_id;
  const forceRegenerate = body.force_regenerate ?? false;

  if (!envFlag("ENABLE_KEY_TAKEAWAYS_IMAGE", true)) {
    return {
      success: false,
      video_id: videoId,
      error: "image_generation_disabled",
      message: "Key Takeaways image generation is disabled",
    };
  }

  try {
    // Check cache first
    if (!forceRegenerate) {
      const cached = await getCachedVideoFromSupabase(videoId);
      if (cached?.video_data) {
        const vd = cached.video_data as Record<string, unknown>;
        if (vd.key_takeaways_image_url) {
          return {
            success: true,
            video_id: videoId,
            image_url: vd.key_takeaways_image_url,
            cached: true,
          };
        }
      }
    }

    const cached = await getCachedVideoFromSupabase(videoId);
    if (!cached?.video_data) {
      throw createError({ statusCode: 404, statusMessage: "Video data not found" });
    }

    const videoData = cached.video_data as Record<string, unknown>;
    const videoDataStr = JSON.stringify(videoData);

    const llm = getLLMService();
    const imageUrl = await llm.generateKeyTakeawaysImage(videoDataStr, videoId, false);

    if (!imageUrl) {
      return {
        success: false,
        video_id: videoId,
        error: "Image generation failed",
        message: "Cannot generate Key Takeaways image",
      };
    }

    // Update video_data with image URL
    videoData.key_takeaways_image_url = imageUrl;
    try {
      const client = getSupabaseClient();
      await client
        .from("youtube_videos")
        .update({ video_data: videoData })
        .eq("video_id", videoId);
    } catch { /* ignore */ }

    // Save to key_takeaways_images table
    try {
      const client = getSupabaseClient(true);
      await client.from("key_takeaways_images").upsert({
        video_id: videoId,
        image_url: imageUrl,
        status: "completed",
        error_message: "",
      });
    } catch { /* ignore */ }

    return {
      success: true,
      video_id: videoId,
      image_url: imageUrl,
      cached: false,
    };
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e;
    throw createError({ statusCode: 500, statusMessage: String(e) });
  }
});
