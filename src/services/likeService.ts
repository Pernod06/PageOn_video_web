// Like Service - handles video like operations with Supabase
// 直接操作 youtube_videos 表的 like_counts 字段
import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * Check if user has liked a video (使用 localStorage 存储)
 */
export async function checkUserLiked(videoId: string, userId: string): Promise<boolean> {
  if (!userId || !videoId) return false;

  // 使用 localStorage 记录用户的点赞状态
  const likedVideos = JSON.parse(localStorage.getItem(`liked_videos_${userId}`) || "[]");
  return likedVideos.includes(videoId);
}

/**
 * Toggle like for a video
 * 直接修改 youtube_videos 表的 like_counts 字段
 */
export async function toggleVideoLike(
  videoId: string,
  userId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  if (!isSupabaseConfigured() || !supabase || !userId) {
    console.warn("[LikeService] Supabase not configured or user not logged in");
    return { liked: false, likeCount: 0 };
  }

  try {
    // 检查用户是否已点赞（从 localStorage）
    const likedVideos = JSON.parse(localStorage.getItem(`liked_videos_${userId}`) || "[]");
    const isCurrentlyLiked = likedVideos.includes(videoId);

    // 获取当前点赞数
    const { data: video, error: fetchError } = await supabase
      .from("youtube_videos")
      .select("like_counts")
      .eq("video_id", videoId)
      .single();

    if (fetchError) {
      console.error("[LikeService] Error fetching video:", fetchError);
      return { liked: isCurrentlyLiked, likeCount: 0 };
    }

    const currentCount = video?.like_counts || 0;
    let newCount: number;
    let newLiked: boolean;

    if (isCurrentlyLiked) {
      // 取消点赞
      newCount = Math.max(0, currentCount - 1);
      newLiked = false;
      // 从 localStorage 移除
      const updatedLikes = likedVideos.filter((id: string) => id !== videoId);
      localStorage.setItem(`liked_videos_${userId}`, JSON.stringify(updatedLikes));
      console.log("[LikeService] 💔 Unlike video:", videoId);
    } else {
      // 点赞
      newCount = currentCount + 1;
      newLiked = true;
      // 添加到 localStorage
      likedVideos.push(videoId);
      localStorage.setItem(`liked_videos_${userId}`, JSON.stringify(likedVideos));
      console.log("[LikeService] ❤️ Liked video:", videoId);
    }

    // 更新数据库
    const { error: updateError } = await supabase
      .from("youtube_videos")
      .update({ like_counts: newCount })
      .eq("video_id", videoId);

    if (updateError) {
      console.error("[LikeService] Error updating like count:", updateError);
      return { liked: isCurrentlyLiked, likeCount: currentCount };
    }

    return { liked: newLiked, likeCount: newCount };
  } catch (err) {
    console.error("[LikeService] Exception toggling like:", err);
    return { liked: false, likeCount: 0 };
  }
}

/**
 * Get the total like count for a video from youtube_videos.like_counts
 */
export async function getVideoLikeCount(videoId: string): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) {
    return 0;
  }

  try {
    const { data, error } = await supabase
      .from("youtube_videos")
      .select("like_counts")
      .eq("video_id", videoId)
      .single();

    if (error) {
      console.error("[LikeService] Error getting like count:", error);
      return 0;
    }

    return data?.like_counts || 0;
  } catch (err) {
    console.error("[LikeService] Exception getting like count:", err);
    return 0;
  }
}
