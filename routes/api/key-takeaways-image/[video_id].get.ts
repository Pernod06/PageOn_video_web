import { defineEventHandler, getRouterParam } from "h3";
import {
  getSupabaseClient,
  getCachedVideoFromSupabase,
} from "../../../server/services/supabase.service";

export default defineEventHandler(async (event) => {
  const videoId = getRouterParam(event, "video_id")!;

  try {
    const client = getSupabaseClient(true);

    // Check key_takeaways_images table
    const { data } = await client
      .from("key_takeaways_images")
      .select("*")
      .eq("video_id", videoId)
      .single();

    if (data) {
      return {
        success: true,
        status: data.status,
        image_url: data.status === "completed" ? data.image_url : null,
        error_message: data.error_message ?? null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    }

    // Fallback: check video_data for image URL
    const cached = await getCachedVideoFromSupabase(videoId);
    if (cached?.video_data) {
      const vd = cached.video_data as Record<string, unknown>;
      if (vd.key_takeaways_image_url) {
        return {
          success: true,
          status: "completed",
          image_url: vd.key_takeaways_image_url,
        };
      }
    }

    return {
      success: false,
      status: "not_found",
      message: "No image record found",
    };
  } catch (e) {
    return {
      success: false,
      status: "error",
      error: String(e),
    };
  }
});
