// Supabase client configuration
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Database types for sentence comments
export interface SentenceComment {
  id: string;
  video_id: string;
  section_id: string;
  sentence_index: number;
  sentence_content: string;
  author: string;
  avatar: string | null;
  comment_text: string;
  is_ai_generated: boolean;
  like_count: number;
  created_at: string;
}

export type NewSentenceComment = Omit<SentenceComment, "id" | "created_at" | "like_count">;

// Supabase configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Helper to check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

// Create Supabase client only if configured, otherwise create a placeholder
let supabaseInstance: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn(
    "[Supabase] Missing environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Comment features will be disabled.",
  );
}

// Export the Supabase client (may be null if not configured)
export const supabase = supabaseInstance;
