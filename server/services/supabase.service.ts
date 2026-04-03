/**
 * Supabase server-side client service
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { envString } from "../utils/env";

// Default fallbacks matching the Python backend
const DEFAULT_SUPABASE_URL = "https://dcbpysgftwbjasaucbbr.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4dXJxdWR4cGx4aGlnbmxzaGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNDAxMjEsImV4cCI6MjA4MDgxNjEyMX0." +
  "afuHUdv5pDwKrMbEon5Tcy2W2EHTR9ZMlka8jiECGDY";

function getSupabaseConfig(preferServiceRole = false): { url: string; key: string } {
  const url = envString("SUPABASE_URL", DEFAULT_SUPABASE_URL);

  let key: string;
  if (preferServiceRole) {
    key =
      envString("SUPABASE_SERVICE_ROLE_KEY") ||
      envString("SUPABASE_KEY") ||
      DEFAULT_SUPABASE_KEY;
  } else {
    key =
      envString("SUPABASE_KEY") ||
      envString("SUPABASE_SERVICE_ROLE_KEY") ||
      DEFAULT_SUPABASE_KEY;
  }

  if (!url) throw new Error("SUPABASE_URL is empty");
  if (!key) throw new Error("SUPABASE key is empty");
  return { url, key };
}

// Cached client instances
const clientCache = new Map<boolean, SupabaseClient>();

export function getSupabaseClient(preferServiceRole = false): SupabaseClient {
  if (clientCache.has(preferServiceRole)) {
    return clientCache.get(preferServiceRole)!;
  }
  const { url, key } = getSupabaseConfig(preferServiceRole);
  const client = createClient(url, key);
  clientCache.set(preferServiceRole, client);
  return client;
}

export function resetSupabaseClients(): void {
  clientCache.clear();
}

// ============ Helper functions matching Python backend ============

export async function getCachedVideoFromSupabase(videoId: string): Promise<Record<string, unknown> | null> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("youtube_videos")
      .select("*")
      .eq("video_id", videoId)
      .single();
    if (error || !data) return null;
    return data as Record<string, unknown>;
  } catch (e) {
    console.warn(`[WARN] Failed to get cached video from Supabase: ${e}`);
    return null;
  }
}

export async function saveVideoToSupabase(
  videoId: string,
  videoData: Record<string, unknown>,
  transcript?: string | null,
  chapters?: unknown[] | null,
): Promise<void> {
  try {
    const client = getSupabaseClient();
    const record: Record<string, unknown> = {
      video_id: videoId,
      video_data: videoData,
      transcript: transcript ?? null,
      chapters: chapters ?? null,
    };
    await client
      .from("youtube_videos")
      .upsert(record, { onConflict: "video_id" });
    console.log(`[SUCCESS] Video data saved to Supabase: ${videoId}`);
  } catch (e) {
    console.warn(`[WARN] Failed to save to Supabase: ${e}`);
  }
}

export async function recordUserUsage(
  userId: string,
  videoId: string,
  videoTitle?: string,
  actionType = "analysis",
): Promise<boolean> {
  if (!userId) return false;
  try {
    const client = getSupabaseClient();
    await client.from("user_usage").insert({
      user_id: userId,
      video_id: videoId,
      video_title: videoTitle ?? null,
      action_type: actionType,
    });
    console.log(`[Usage] Recorded user ${userId.slice(0, 8)}... analysis: ${videoId}`);
    return true;
  } catch (e) {
    console.warn(`[Usage] Failed to record usage: ${e}`);
    return false;
  }
}

// ============ V2 schema helpers ============

export function isV2VideoData(videoData: unknown): boolean {
  if (!videoData || typeof videoData !== "object") return false;
  const d = videoData as Record<string, unknown>;
  return Array.isArray(d.main_body) && typeof d.meta === "object";
}

export function getVideoTitleFromV2(videoData: Record<string, unknown> | null, fallback = ""): string {
  const meta = (videoData?.meta as Record<string, unknown>) ?? {};
  return (meta.title as string) || fallback;
}

export function getVideoSummaryFromV2(videoData: Record<string, unknown> | null): string {
  const summaryBox = (videoData?.summary_box as Record<string, unknown>) ?? {};
  return (summaryBox.key_insight as string) || "";
}

export function buildV2ThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}
