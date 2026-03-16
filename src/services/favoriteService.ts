// Favorite Service - handles video favorite operations with Supabase
// 操作 user_favorites 表
import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * Check if user has favorited a video
 */
export async function checkUserFavorited(videoId: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase || !userId || !videoId) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from("user_favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("video_id", videoId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" error, which is expected when not favorited
      console.error("[FavoriteService] Error checking favorite:", error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error("[FavoriteService] Exception checking favorite:", err);
    return false;
  }
}

/**
 * Add video to favorites
 */
export async function addFavorite(videoId: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase || !userId || !videoId) {
    console.warn("[FavoriteService] Supabase not configured or missing parameters");
    return false;
  }

  try {
    const { error } = await supabase.from("user_favorites").insert({
      user_id: userId,
      video_id: videoId,
    });

    if (error) {
      // If it's a unique constraint violation, the video is already favorited
      if (error.code === "23505") {
        console.log("[FavoriteService] Video already favorited");
        return true;
      }
      console.error("[FavoriteService] Error adding favorite:", error);
      return false;
    }

    console.log("[FavoriteService] ✅ Added to favorites:", videoId);
    return true;
  } catch (err) {
    console.error("[FavoriteService] Exception adding favorite:", err);
    return false;
  }
}

/**
 * Remove video from favorites
 */
export async function removeFavorite(videoId: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase || !userId || !videoId) {
    console.warn("[FavoriteService] Supabase not configured or missing parameters");
    return false;
  }

  try {
    const { error } = await supabase
      .from("user_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("video_id", videoId);

    if (error) {
      console.error("[FavoriteService] Error removing favorite:", error);
      return false;
    }

    console.log("[FavoriteService] ❌ Removed from favorites:", videoId);
    return true;
  } catch (err) {
    console.error("[FavoriteService] Exception removing favorite:", err);
    return false;
  }
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(videoId: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase || !userId || !videoId) {
    console.warn("[FavoriteService] Supabase not configured or missing parameters");
    return false;
  }

  try {
    // Check current status
    const isFavorited = await checkUserFavorited(videoId, userId);

    if (isFavorited) {
      return await removeFavorite(videoId, userId);
    } else {
      return await addFavorite(videoId, userId);
    }
  } catch (err) {
    console.error("[FavoriteService] Exception toggling favorite:", err);
    return false;
  }
}

/**
 * Get all favorites for a user (returns video IDs only)
 */
export async function getUserFavorites(userId: string): Promise<string[]> {
  if (!isSupabaseConfigured() || !supabase || !userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("user_favorites")
      .select("video_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[FavoriteService] Error getting favorites:", error);
      return [];
    }

    return data?.map((item) => item.video_id) || [];
  } catch (err) {
    console.error("[FavoriteService] Exception getting favorites:", err);
    return [];
  }
}

/**
 * Favorite video with metadata
 */
export interface FavoriteVideo {
  video_id: string;
  created_at: string;
  video_title?: string;
  video_thumbnail?: string;
}

/**
 * Get all favorites for a user with video metadata
 */
export async function getUserFavoritesWithMetadata(userId: string): Promise<FavoriteVideo[]> {
  if (!isSupabaseConfigured() || !supabase || !userId) {
    return [];
  }

  try {
    // Get favorites
    const { data: favorites, error: favoritesError } = await supabase
      .from("user_favorites")
      .select("video_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (favoritesError) {
      console.error("[FavoriteService] Error getting favorites:", favoritesError);
      return [];
    }

    if (!favorites || favorites.length === 0) {
      return [];
    }

    // Get video metadata from youtube_videos table
    const videoIds = favorites.map((f) => f.video_id);
    const { data: videos, error: videosError } = await supabase
      .from("youtube_videos")
      .select("video_id, video_data")
      .in("video_id", videoIds);

    if (videosError) {
      console.error("[FavoriteService] Error getting video metadata:", videosError);
      // Return favorites without metadata if video data fetch fails
      return favorites.map((f) => ({
        video_id: f.video_id,
        created_at: f.created_at,
      }));
    }

    // Merge favorites with video metadata
    interface VideoDataWithInfo {
      meta?: {
        title?: string;
      };
    }
    const videoMap = new Map(
      videos?.map((v) => [
        v.video_id,
        {
          title: (v.video_data as VideoDataWithInfo)?.meta?.title,
          thumbnail: `https://img.youtube.com/vi/${v.video_id}/maxresdefault.jpg`,
        },
      ]) || [],
    );

    return favorites.map((favorite) => {
      const metadata = videoMap.get(favorite.video_id);
      return {
        video_id: favorite.video_id,
        created_at: favorite.created_at,
        video_title: metadata?.title,
        video_thumbnail: metadata?.thumbnail,
      };
    });
  } catch (err) {
    console.error("[FavoriteService] Exception getting favorites with metadata:", err);
    return [];
  }
}
