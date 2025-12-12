// Comment Service - handles all comment-related operations with Supabase
import { supabase, isSupabaseConfigured, SentenceComment, NewSentenceComment } from "./supabase";

// Re-export types for convenience
export type { SentenceComment, NewSentenceComment } from "./supabase";

// API配置 - 使用与 result.tsx 相同的后端
// 开发环境使用相对路径（通过 vite 代理），生产环境使用完整 URL
const API_BASE_URL = import.meta.env.DEV ? "" : "http://52.72.117.236:5500";

// Random avatar URLs for AI-generated comments
const AI_AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=reader1",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=reader2",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=reader3",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=scholar1",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=scholar2",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=curious1",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=thinker1",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=student1",
];

// Random AI commenter names
const AI_NAMES = [
  "Curious Reader",
  "Knowledge Seeker",
  "Deep Thinker",
  "Science Fan",
  "Learning Enthusiast",
  "Avid Viewer",
  "Thoughtful Observer",
  "Question Asker",
];

/**
 * Fetch comments for a specific sentence
 */
export async function fetchSentenceComments(
  videoId: string,
  sectionId: string,
  sentenceIndex: number,
): Promise<SentenceComment[]> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[CommentService] Supabase not configured");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("sentence_comments")
      .select("*")
      .eq("video_id", videoId)
      .eq("section_id", sectionId)
      .eq("sentence_index", sentenceIndex)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[CommentService] Error fetching comments:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[CommentService] Exception fetching comments:", err);
    return [];
  }
}

/**
 * Fetch all comments for a video (used to check if AI comments exist)
 */
export async function fetchVideoComments(videoId: string): Promise<SentenceComment[]> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[CommentService] Supabase not configured");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("sentence_comments")
      .select("*")
      .eq("video_id", videoId)
      .eq("is_ai_generated", true)
      .limit(1);

    if (error) {
      console.error("[CommentService] Error checking video comments:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[CommentService] Exception checking video comments:", err);
    return [];
  }
}

/**
 * Get comment count for a specific sentence
 */
export async function getSentenceCommentCount(
  videoId: string,
  sectionId: string,
  sentenceIndex: number,
): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) {
    return 0;
  }

  try {
    const { count, error } = await supabase
      .from("sentence_comments")
      .select("*", { count: "exact", head: true })
      .eq("video_id", videoId)
      .eq("section_id", sectionId)
      .eq("sentence_index", sentenceIndex);

    if (error) {
      console.error("[CommentService] Error getting comment count:", error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error("[CommentService] Exception getting comment count:", err);
    return 0;
  }
}

/**
 * Post a new user comment
 */
export async function postComment(
  videoId: string,
  sectionId: string,
  sentenceIndex: number,
  sentenceContent: string,
  author: string,
  commentText: string,
  avatar?: string,
): Promise<SentenceComment | null> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn("[CommentService] Supabase not configured");
    return null;
  }

  const newComment: NewSentenceComment = {
    video_id: videoId,
    section_id: sectionId,
    sentence_index: sentenceIndex,
    sentence_content: sentenceContent,
    author: author || "Anonymous",
    avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
    comment_text: commentText,
    is_ai_generated: false,
  };

  try {
    const { data, error } = await supabase
      .from("sentence_comments")
      .insert([newComment])
      .select()
      .single();

    if (error) {
      console.error("[CommentService] Error posting comment:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[CommentService] Exception posting comment:", err);
    return null;
  }
}

/**
 * Generate AI comments for all sentences in a video's sections
 * Uses the backend LLM API to generate contextual comments
 */
export async function generateAIComments(
  videoId: string,
  sections: Array<{
    id: string;
    title: string;
    content: Array<{
      content: string;
      timestampStart: string;
    }>;
  }>,
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.warn("[CommentService] Supabase not configured, skipping AI comment generation");
    return false;
  }

  // Check if AI comments already exist for this video
  const existingComments = await fetchVideoComments(videoId);
  if (existingComments.length > 0) {
    console.log("[CommentService] AI comments already exist for this video");
    return true;
  }

  console.log("[CommentService] Generating AI comments for video:", videoId);

  const allComments: NewSentenceComment[] = [];

  for (const section of sections) {
    if (!section.content) continue;

    for (let sentenceIndex = 0; sentenceIndex < section.content.length; sentenceIndex++) {
      const sentence = section.content[sentenceIndex];

      // Generate 1-3 comments per sentence (randomly)
      const numComments = Math.floor(Math.random() * 3) + 1;

      try {
        // Call backend API to generate comments
        const generatedComments = await generateCommentsFromAPI(
          sentence.content,
          section.title,
          numComments,
        );

        for (const commentText of generatedComments) {
          const randomAvatar = AI_AVATARS[Math.floor(Math.random() * AI_AVATARS.length)];
          const randomName = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];

          allComments.push({
            video_id: videoId,
            section_id: section.id,
            sentence_index: sentenceIndex,
            sentence_content: sentence.content,
            author: randomName,
            avatar: randomAvatar,
            comment_text: commentText,
            is_ai_generated: true,
          });
        }
      } catch (err) {
        console.error("[CommentService] Error generating comments for sentence:", err);
        // Continue with fallback comments
        const fallbackComments = generateFallbackComments(sentence.content, numComments);
        for (const commentText of fallbackComments) {
          const randomAvatar = AI_AVATARS[Math.floor(Math.random() * AI_AVATARS.length)];
          const randomName = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];

          allComments.push({
            video_id: videoId,
            section_id: section.id,
            sentence_index: sentenceIndex,
            sentence_content: sentence.content,
            author: randomName,
            avatar: randomAvatar,
            comment_text: commentText,
            is_ai_generated: true,
          });
        }
      }
    }
  }

  // Batch insert all comments
  if (allComments.length > 0 && supabase) {
    try {
      const { error } = await supabase.from("sentence_comments").insert(allComments);

      if (error) {
        console.error("[CommentService] Error inserting AI comments:", error);
        return false;
      }

      console.log("[CommentService] Successfully generated", allComments.length, "AI comments");
      return true;
    } catch (err) {
      console.error("[CommentService] Exception inserting AI comments:", err);
      return false;
    }
  }

  return true;
}

/**
 * Call backend API to generate contextual comments using LLM
 */
async function generateCommentsFromAPI(
  sentenceContent: string,
  sectionTitle: string,
  numComments: number,
): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sentence: sentenceContent,
        context: sectionTitle,
        count: numComments,
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    if (data.success && data.comments) {
      return data.comments;
    }

    throw new Error("Invalid API response");
  } catch (err) {
    console.warn("[CommentService] API call failed, using fallback:", err);
    return generateFallbackComments(sentenceContent, numComments);
  }
}

/**
 * Generate fallback comments when API is unavailable
 * These are template-based comments that feel natural
 */
function generateFallbackComments(_sentenceContent: string, count: number): string[] {
  const templates = [
    // Appreciation comments
    "This is such a clear explanation! Really helps understand the concept.",
    "I never thought about it this way before. Eye-opening!",
    "Great point! This connects so many ideas together.",
    "Finally someone explains this in a way that makes sense.",

    // Curiosity comments
    "I wonder how this applies to other fields?",
    "This makes me want to learn more about the topic!",
    "Interesting! Are there any exceptions to this?",
    "How does this compare to the traditional view?",

    // Agreement comments
    "Exactly what I was thinking! Well said.",
    "This confirms what I suspected. Nice to see it explained.",
    "So true! I've observed this myself.",
    "Couldn't agree more with this perspective.",

    // Thoughtful comments
    "This is the key insight of the whole video.",
    "Important point that many people overlook.",
    "This deserves more attention!",
    "Bookmarking this for future reference.",

    // Question-style comments
    "Makes you think about the bigger picture...",
    "What would happen if we applied this elsewhere?",
    "The implications of this are fascinating.",
    "This raises some interesting questions.",
  ];

  // Shuffle and pick random comments
  const shuffled = templates.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, templates.length));
}

/**
 * Get all comment counts for a video (for displaying badges)
 */
export async function getAllCommentCounts(videoId: string): Promise<Map<string, number>> {
  if (!isSupabaseConfigured() || !supabase) {
    return new Map();
  }

  try {
    const { data, error } = await supabase
      .from("sentence_comments")
      .select("section_id, sentence_index")
      .eq("video_id", videoId);

    if (error) {
      console.error("[CommentService] Error fetching comment counts:", error);
      return new Map();
    }

    // Count comments per sentence
    const counts = new Map<string, number>();
    for (const row of data || []) {
      const key = `${row.section_id}-${row.sentence_index}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return counts;
  } catch (err) {
    console.error("[CommentService] Exception fetching comment counts:", err);
    return new Map();
  }
}
