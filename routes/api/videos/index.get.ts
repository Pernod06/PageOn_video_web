import { defineEventHandler, getQuery } from "h3";
import {
  getSupabaseClient,
  isV2VideoData,
  getVideoTitleFromV2,
  getVideoSummaryFromV2,
  buildV2ThumbnailUrl,
} from "../../server/services/supabase.service";

export default defineEventHandler(async (event) => {
  try {
    const { user_id } = getQuery(event) as { user_id?: string };
    const client = getSupabaseClient();

    const { data: records, error } = await client
      .from("youtube_videos")
      .select("video_id, video_data, created_at, like_counts")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const videoIds = (records ?? []).map((r: Record<string, unknown>) => r.video_id as string);

    // Batch query user likes if logged in
    let userLikesSet = new Set<string>();
    if (videoIds.length > 0 && user_id) {
      try {
        const { data: userLikes } = await client
          .from("video_likes")
          .select("video_id")
          .in("video_id", videoIds)
          .eq("user_id", user_id);
        userLikesSet = new Set(
          (userLikes ?? []).map((l: Record<string, unknown>) => l.video_id as string),
        );
      } catch {
        // Table might not exist, ignore
      }
    }

    const videos = (records ?? [])
      .filter((r: Record<string, unknown>) => isV2VideoData(r.video_data))
      .map((r: Record<string, unknown>) => {
        const videoData = r.video_data as Record<string, unknown>;
        const videoId = r.video_id as string;
        return {
          videoId,
          title: getVideoTitleFromV2(videoData, `Video ${videoId}`),
          description: "",
          thumbnail: buildV2ThumbnailUrl(videoId),
          summary: getVideoSummaryFromV2(videoData),
          createdAt: r.created_at ?? "",
          like_count: (r.like_counts as number) ?? 0,
          is_liked: user_id ? userLikesSet.has(videoId) : false,
        };
      });

    return videos;
  } catch (e) {
    console.error(`[ERROR] Failed to get video list: ${e}`);
    return [];
  }
});
