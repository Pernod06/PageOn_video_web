import { Button, SentenceWithComments } from "@/components";
import { useLocation, Link } from "react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  getAllCommentCounts,
  fetchSentenceComments,
  postComment,
  SentenceComment,
} from "@/services/commentService";

interface VideoData {
  videoInfo?: {
    videoId: string;
    title: string;
    description?: string;
    thumbnail?: string;
    summary?: string;
  };
  sections?: Array<{
    id: string;
    title: string;
    content: Array<{
      content: string;
      timestampStart: string;
    }>;
  }>;
  chapters?: Array<{
    timestamp: number;
    title: string;
    thumbnail_url?: string;
  }>;
}

interface YouTubePlayer {
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  destroy?: () => void;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  likeCount?: number;
  publishedAt?: string;
  avatar?: string;
  published_at?: string;
  like_count?: number;
  reply_count?: number;
}

interface Chapter {
  timestamp: number;
  title: string;
  thumbnail_url?: string;
}

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string, config: unknown) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type TabType = "transcript" | "chat" | "notes";

interface Note {
  id: string;
  sectionId: string;
  sentenceIndex: number;
  contentPreview: string;
  noteText: string;
  createdAt: Date;
}

// API配置
// 开发环境使用相对路径（通过 vite 代理），生产环境使用完整 URL
const API_BASE_URL = import.meta.env.DEV ? "" : "http://52.72.117.236:5500";

// 流式请求直接访问后端，绕过 Vite 代理的缓冲问题
const STREAM_API_URL = "http://52.72.117.236:5500";

// 检测是否在扩展环境中运行
const isExtension = import.meta.env.VITE_IS_EXTENSION === "true";

export default function Result() {
  const location = useLocation();
  const {
    videoId: initialVideoId,
    title,
    chapters: initialChapters = [],
    isExample = false,
    language = "en",
    sections: initialSections = null,
    videoInfo: initialVideoInfo = null,
    cached = false,
    streamingUrl = null, // 流式分析 URL
  } = (location.state as {
    videoId?: string;
    title?: string;
    chapters?: Chapter[];
    isExample?: boolean;
    language?: string;
    sections?: VideoData["sections"];
    videoInfo?: VideoData["videoInfo"];
    cached?: boolean;
    streamingUrl?: string | null;
  }) || {};

  // 如果有 streamingUrl，videoId 从流式分析中获取
  const [videoId, setVideoId] = useState<string | undefined>(initialVideoId);

  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 流式分析状态
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // 流式增量解析/节流相关 refs（避免每个 chunk 都 JSON.parse 全量内容导致 UI 卡顿）
  const fullStreamContentRef = useRef<string>("");
  const streamChunkAccRef = useRef<string>("");
  const streamFlushRafRef = useRef<number | null>(null);
  const streamParseStateRef = useRef<{
    videoInfoDone: boolean;
    videoInfoStart: number;
    sectionsStart: number;
    scanIndex: number;
    seenSectionIds: Set<string>;
  }>({
    videoInfoDone: false,
    videoInfoStart: -1,
    sectionsStart: -1,
    scanIndex: 0,
    seenSectionIds: new Set(),
  });
  const [activeTab, setActiveTab] = useState<TabType>("transcript");
  const [chatMessages, setChatMessages] = useState([
    { type: "bot", content: "Hello! I'm your video assistant. How can I help you?" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatThinking, setIsChatThinking] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [transcriptData, setTranscriptData] = useState<Array<{ timestamp: string; text: string }>>(
    [],
  );
  const [currentTranscriptIndex, setCurrentTranscriptIndex] = useState<number>(-1);
  const [, setComments] = useState<Comment[]>([]);
  const [, setCommentsLoading] = useState(false);
  const [, setCommentsError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);

  // Sentence comments state
  const [sentenceCommentCounts, setSentenceCommentCounts] = useState<Map<string, number>>(
    new Map(),
  );

  // Selected sentence for sidebar comments (Feishu-style)
  const [selectedSentence, setSelectedSentence] = useState<{
    videoId: string;
    sectionId: string;
    sentenceIndex: number;
    content: string;
  } | null>(null);
  const [sidebarComments, setSidebarComments] = useState<SentenceComment[]>([]);
  const [sidebarCommentsLoading, setSidebarCommentsLoading] = useState(false);
  const [newSidebarComment, setNewSidebarComment] = useState("");
  const [sidebarAuthorName, setSidebarAuthorName] = useState("");
  const [isSubmittingSidebarComment, setIsSubmittingSidebarComment] = useState(false);

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNote, setEditingNote] = useState<{
    sectionId: string;
    sentenceIndex: number;
    content: string;
  } | null>(null);
  const [noteInputText, setNoteInputText] = useState("");

  // 保存完整的 transcript 文本内容
  const transcriptContent = useRef<string>("");

  const transcriptRefs = useRef<(HTMLDivElement | null)[]>([]);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [youtubeStartTime, setYoutubeStartTime] = useState(0);

  // 增量解析：从 SSE 累积文本中尽量提取已"闭合"的 videoInfo / section 对象
  // @ts-expect-error - This callback is kept for potential future use
  // eslint-disable-next-line
  const flushStreamingUpdates = useCallback(() => {
    streamFlushRafRef.current = null;
    if (!streamChunkAccRef.current) return;

    fullStreamContentRef.current += streamChunkAccRef.current;
    streamChunkAccRef.current = "";

    // 清理 markdown 代码块标记（LLM 可能输出 ```json ... ```）
    let content = fullStreamContentRef.current;
    // 移除开头的 ```json 或 ```
    content = content.replace(/^```json?\s*\n?/, "");
    // 移除结尾的 ```（如果已经完整）
    content = content.replace(/\n?```\s*$/, "");

    // 调试：打印内容前100字符，看看是否正确
    if (content.length < 200) {
      console.log("[Stream] content preview:", content.slice(0, 200));
    }
    const state = streamParseStateRef.current;
    const patch: Partial<VideoData> = {};

    // 1) videoInfo：只要拿到完整的 { ... } 就 parse 一次
    if (!state.videoInfoDone) {
      if (state.videoInfoStart === -1) {
        const idx = content.indexOf('"videoInfo"');
        if (idx !== -1) state.videoInfoStart = idx;
      }
      if (state.videoInfoStart !== -1) {
        const braceStart = content.indexOf("{", state.videoInfoStart);
        if (braceStart !== -1) {
          let depth = 0;
          let inString = false;
          let escape = false;
          for (let i = braceStart; i < content.length; i++) {
            const ch = content[i];
            if (escape) {
              escape = false;
              continue;
            }
            if (ch === "\\\\") {
              if (inString) escape = true;
              continue;
            }
            if (ch === '"') {
              inString = !inString;
              continue;
            }
            if (inString) continue;
            if (ch === "{") depth++;
            if (ch === "}") {
              depth--;
              if (depth === 0) {
                const objStr = content.slice(braceStart, i + 1);
                try {
                  patch.videoInfo = JSON.parse(objStr);
                  state.videoInfoDone = true;
                } catch {
                  // ignore
                }
                break;
              }
            }
          }
        }
      }
    }

    // 2) sections：从 "sections": [ 开始扫描，提取闭合的 { ... } section 对象
    if (state.sectionsStart === -1) {
      const idx = content.indexOf('"sections"');
      if (idx !== -1) {
        const bracketStart = content.indexOf("[", idx);
        if (bracketStart !== -1) {
          state.sectionsStart = bracketStart;
          state.scanIndex = bracketStart + 1;
        }
      }
    }

    if (state.sectionsStart !== -1 && state.scanIndex < content.length) {
      const newSections: NonNullable<VideoData["sections"]> = [];
      let inString = false;
      let escape = false;
      let objDepth = 0;
      let objStart = -1;

      for (let i = Math.max(state.scanIndex, state.sectionsStart + 1); i < content.length; i++) {
        const ch = content[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\\\") {
          if (inString) escape = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;

        if (ch === "{") {
          if (objDepth === 0) objStart = i;
          objDepth++;
          continue;
        }
        if (ch === "}") {
          objDepth--;
          if (objDepth === 0 && objStart !== -1) {
            const objStr = content.slice(objStart, i + 1);
            try {
              const section = JSON.parse(objStr) as NonNullable<VideoData["sections"]>[number];
              if (section?.id && !state.seenSectionIds.has(section.id)) {
                state.seenSectionIds.add(section.id);
                newSections.push(section);
              }
            } catch {
              // ignore
            }
            objStart = -1;
          }
          continue;
        }

        // sections 数组闭合
        if (ch === "]" && objDepth === 0) {
          state.scanIndex = i + 1;
          break;
        }

        state.scanIndex = i;
      }

      if (newSections.length > 0) {
        patch.sections = newSections;
      }
    }

    if (Object.keys(patch).length > 0) {
      console.log("[Stream] 解析到数据:", {
        hasVideoInfo: !!patch.videoInfo,
        newSectionsCount: patch.sections?.length || 0,
      });
      setVideoData((prev) => {
        const base: VideoData = prev || {};
        const merged: VideoData = { ...base, ...patch };
        if (patch.sections) {
          merged.sections = [...(base.sections || []), ...(patch.sections || [])];
        }
        console.log("[Stream] 更新 videoData, sections:", merged.sections?.length || 0);
        return merged;
      });
    } else {
      // 调试：看看为什么没有解析到数据
      const state = streamParseStateRef.current;
      console.log("[Stream] flush 但无数据:", {
        contentLen: content.length,
        videoInfoDone: state.videoInfoDone,
        sectionsStart: state.sectionsStart,
        scanIndex: state.scanIndex,
      });
    }
  }, []);

  // 流式分析视频
  const startStreamingAnalysis = useCallback(
    async (url: string) => {
      console.log("[Result] Starting streaming analysis for:", url);
      setIsStreaming(true);
      setLoading(true);
      setVideoData(null);
      fullStreamContentRef.current = "";
      streamChunkAccRef.current = "";
      streamParseStateRef.current = {
        videoInfoDone: false,
        videoInfoStart: -1,
        sectionsStart: -1,
        scanIndex: 0,
        seenSectionIds: new Set(),
      };

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(`${STREAM_API_URL}/api/process-video/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
          },
          cache: "no-store",
          body: JSON.stringify({ url, language }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`服务器错误: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("无法读取响应流");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const payload = line.slice(6);
              if (!payload) continue;

              // 处理特殊标签：[DONE] [CACHED] [ERROR]
              if (payload.startsWith("[DONE]") || payload.startsWith("[CACHED]")) {
                const jsonText = payload.replace(/^\[(DONE|CACHED)\]\s*/, "");
                try {
                  const finalData = JSON.parse(jsonText) as VideoData;
                  console.log("[Result] Streaming complete:", finalData);
                  setVideoData(finalData);
                  setVideoId(finalData.videoInfo?.videoId);
                  if (finalData.chapters) {
                    setChapters(finalData.chapters as Chapter[]);
                  }
                  setIsStreaming(false);
                  setLoading(false);
                } catch (e) {
                  console.error("[Result] Failed to parse DONE/CACHED JSON:", e);
                  setIsStreaming(false);
                  setLoading(false);
                  setError("解析最终结果失败");
                }
                continue;
              }

              if (payload.startsWith("[ERROR]")) {
                const errorMsg = payload.replace(/^\[ERROR\]\s*/, "");
                console.error("[Result] Streaming error:", errorMsg);
                setIsStreaming(false);
                setLoading(false);
                setError(errorMsg || "分析失败");
                continue;
              }

              // 处理结构化事件流 {"type": "video_info" | "section", "data": {...}}
              try {
                const event = JSON.parse(payload);
                if (event.type && event.data) {
                  if (event.type === "video_info") {
                    console.log("[Stream] 收到 video_info 事件:", event.data.title);
                    setVideoData((prev) => ({
                      ...(prev ?? {}),
                      videoInfo: event.data,
                    }));
                    setVideoId(event.data.videoId);
                  } else if (event.type === "section") {
                    console.log("[Stream] 收到 section 事件:", event.data.id, event.data.title);
                    setVideoData((prev) => ({
                      ...(prev ?? {}),
                      sections: [...(prev?.sections || []), event.data],
                    }));
                  }
                  continue;
                }
              } catch {
                // 不是结构化事件，忽略
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          console.log("[Result] Streaming aborted");
          return;
        }
        console.error("[Result] Streaming error:", err);
        setIsStreaming(false);
        setLoading(false);
        setError(err instanceof Error ? err.message : "分析失败");
      }
    },
    [language],
  );

  // 记录是否已经完成流式分析后的初始化
  const streamingInitializedRef = useRef(false);

  useEffect(() => {
    // 如果有 streamingUrl，启动流式分析（只在首次挂载时）
    if (streamingUrl) {
      // 防止 StrictMode 重复调用
      if (abortControllerRef.current) {
        return;
      }
      console.log("[Result] Starting streaming analysis for URL:", streamingUrl);
      startStreamingAnalysis(streamingUrl);
      return () => {
        abortControllerRef.current?.abort();
      };
    }

    // 原有逻辑：使用 videoId 加载数据（仅在非流式模式下）
    if (videoId && !streamingUrl) {
      console.log(
        "[Result] Component mounted with videoId:",
        videoId,
        "isExample:",
        isExample,
        "cached:",
        cached,
      );
      setPlayerReady(false); // 重置 player ready 状态

      // 如果有从 index.tsx 传过来的完整数据（翻译后的缓存数据），直接使用
      if (initialSections && initialVideoInfo) {
        console.log("[Result] ✅ Using pre-loaded data from navigation state (translated)");
        setVideoData({
          videoInfo: initialVideoInfo,
          sections: initialSections,
        });
        setLoading(false);
      } else {
        // Load all data - 示例视频优先使用本地缓存
        loadVideoData(videoId, isExample);
      }

      loadTranscript(videoId, isExample);
      if (isExample) {
        loadChapters(videoId); // 示例视频加载本地 chapters
      } else {
        loadComments(videoId, 20); // 非示例视频加载评论
      }
      initializeYouTubePlayer();
    } else if (!streamingUrl && !videoId) {
      console.warn("[Result] No videoId or streamingUrl provided");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExample, streamingUrl]); // 移除 videoId 依赖，避免流式分析完成后重复触发

  // 流式分析完成后，videoId 更新，初始化播放器和加载 transcript（只执行一次）
  useEffect(() => {
    if (streamingUrl && videoId && !isStreaming && !streamingInitializedRef.current) {
      streamingInitializedRef.current = true;
      console.log(
        "[Result] Streaming complete, initializing player and loading transcript for:",
        videoId,
      );
      initializeYouTubePlayer();
      loadTranscript(videoId, false);
      loadComments(videoId, 20);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, isStreaming, streamingUrl]);

  // Load comment counts when video data is ready
  useEffect(() => {
    const loadCommentCounts = async () => {
      if (!videoId || !videoData?.sections) return;

      // Load comment counts for all sentences
      const counts = await getAllCommentCounts(videoId);
      setSentenceCommentCounts(counts);
      console.log("[Result] Loaded comment counts:", counts.size, "sentences with comments");
    };

    loadCommentCounts();
  }, [videoId, videoData?.sections]);

  // Load sidebar comments when selected sentence changes
  useEffect(() => {
    const loadSidebarComments = async () => {
      if (!selectedSentence) {
        setSidebarComments([]);
        return;
      }

      setSidebarCommentsLoading(true);
      try {
        const comments = await fetchSentenceComments(
          selectedSentence.videoId,
          selectedSentence.sectionId,
          selectedSentence.sentenceIndex,
        );
        setSidebarComments(comments);
      } catch (err) {
        console.error("[Result] Failed to load sidebar comments:", err);
        setSidebarComments([]);
      } finally {
        setSidebarCommentsLoading(false);
      }
    };

    loadSidebarComments();
  }, [selectedSentence]);

  // Handle sentence selection for sidebar comments
  const handleSentenceSelect = useCallback(
    (
      info: {
        videoId: string;
        sectionId: string;
        sentenceIndex: number;
        content: string;
      } | null,
    ) => {
      setSelectedSentence(info);
      setNewSidebarComment("");
    },
    [],
  );

  // Handle submitting a new comment from sidebar
  const handleSubmitSidebarComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSidebarComment.trim() || !selectedSentence) return;

    setIsSubmittingSidebarComment(true);
    try {
      const posted = await postComment(
        selectedSentence.videoId,
        selectedSentence.sectionId,
        selectedSentence.sentenceIndex,
        selectedSentence.content,
        sidebarAuthorName || "Anonymous",
        newSidebarComment.trim(),
      );

      if (posted) {
        setSidebarComments((prev) => [...prev, posted]);
        setNewSidebarComment("");
        // Update the comment count
        const commentKey = `${selectedSentence.sectionId}-${selectedSentence.sentenceIndex}`;
        setSentenceCommentCounts((prev) => {
          const newMap = new Map(prev);
          newMap.set(commentKey, (prev.get(commentKey) || 0) + 1);
          return newMap;
        });
      }
    } catch (err) {
      console.error("[Result] Failed to post sidebar comment:", err);
    } finally {
      setIsSubmittingSidebarComment(false);
    }
  };

  // Handle double-click on sentence to create/edit note
  const handleSentenceDoubleClick = useCallback(
    (info: { sectionId: string; sentenceIndex: number; content: string }) => {
      // Check if there's already a note for this sentence
      const existingNote = notes.find(
        (n) => n.sectionId === info.sectionId && n.sentenceIndex === info.sentenceIndex,
      );

      setEditingNote(info);
      setNoteInputText(existingNote?.noteText || "");
      setActiveTab("notes");
    },
    [notes],
  );

  // Save note
  const handleSaveNote = useCallback(() => {
    if (!editingNote || !noteInputText.trim()) return;

    const existingNoteIndex = notes.findIndex(
      (n) => n.sectionId === editingNote.sectionId && n.sentenceIndex === editingNote.sentenceIndex,
    );

    if (existingNoteIndex >= 0) {
      // Update existing note
      setNotes((prev) =>
        prev.map((n, i) =>
          i === existingNoteIndex ? { ...n, noteText: noteInputText.trim() } : n,
        ),
      );
    } else {
      // Create new note
      const newNote: Note = {
        id: `note-${Date.now()}`,
        sectionId: editingNote.sectionId,
        sentenceIndex: editingNote.sentenceIndex,
        contentPreview: editingNote.content.slice(0, 100),
        noteText: noteInputText.trim(),
        createdAt: new Date(),
      };
      setNotes((prev) => [...prev, newNote]);
    }

    setEditingNote(null);
    setNoteInputText("");
  }, [editingNote, noteInputText, notes]);

  // Delete note
  const handleDeleteNote = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  // Cancel note editing
  const handleCancelNote = useCallback(() => {
    setEditingNote(null);
    setNoteInputText("");
  }, []);

  // 加载本地 chapters 数据（用于示例视频）
  const loadChapters = async (id: string) => {
    try {
      console.log("[Result] 📂 Loading chapters from local cache for:", id);
      const response = await fetch(`/data/chapter/chapters_${id}.json`);

      if (response.ok) {
        const data = await response.json();
        // JSON 结构: { video_id, video_title, chapters: [...] } 或直接是数组
        const chaptersArray = Array.isArray(data) ? data : data.chapters;
        if (chaptersArray && chaptersArray.length > 0) {
          console.log("[Result] ✅ Chapters loaded:", chaptersArray.length, "chapters");
          setChapters(chaptersArray);
        } else {
          console.log("[Result] ⚠️ No chapters in data for:", id);
        }
      } else {
        console.log("[Result] ⚠️ No local chapters found for:", id);
      }
    } catch (error) {
      console.error("[Result] ❌ Failed to load chapters:", error);
    }
  };

  const loadTranscript = async (id: string, useLocalCache: boolean = false) => {
    console.log("[Result] Loading transcript for:", id, "useLocalCache:", useLocalCache);

    // 如果是示例视频，优先使用本地缓存
    if (useLocalCache) {
      try {
        console.log("[Result] 📂 Loading transcript from local cache");
        const localResponse = await fetch(`/data/transcript/transcript_${id}.txt`);

        if (localResponse.ok) {
          const text = await localResponse.text();
          console.log("[Result] ✅ Local transcript loaded, length:", text.length);
          transcriptContent.current = text;
          const parsed = parseTranscript(text);
          setTranscriptData(parsed);
          return;
        }
      } catch (localError) {
        console.error("[Result] ❌ Local cache failed:", localError);
      }
    }

    // Try to load from backend API
    try {
      const url = `${API_BASE_URL}/api/transcript/${id}`;
      console.log("[Result] Attempting API:", url);
      const response = await fetch(url);

      if (response.ok) {
        const text = await response.text();
        console.log("[Result] API response text length:", text.length);
        transcriptContent.current = text;
        const parsed = parseTranscript(text);
        setTranscriptData(parsed);
        console.log("[Result] ✅ Transcript loaded from API, entries:", parsed.length);
        return;
      } else {
        console.warn("[Result] API returned status:", response.status);
      }
    } catch (apiError) {
      console.error("[Result] ❌ API failed:", apiError);
    }

    // Fallback: load from local file
    try {
      console.log("[Result] Attempting local fallback: /data/transcript/transcript_" + id + ".txt");
      const localResponse = await fetch(`/data/transcript/transcript_${id}.txt`);

      if (localResponse.ok) {
        const text = await localResponse.text();
        transcriptContent.current = text;
        const parsed = parseTranscript(text);
        setTranscriptData(parsed);
        console.log("[Result] ✅ Local transcript loaded, entries:", parsed.length);
      } else {
        console.error("[Result] ❌ Local file not found, status:", localResponse.status);
      }
    } catch (localError) {
      console.error("[Result] ❌ Failed to load local transcript:", localError);
    }
  };

  // 辅助函数：将时间戳 "MM:SS" 转换为秒数
  const parseTimestamp = (timestamp: string): number => {
    const parts = timestamp.split(":");
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    return minutes * 60 + seconds;
  };

  const parseTranscript = (text: string): Array<{ timestamp: string; text: string }> => {
    const lines = text.split("\n");

    // Step 1: Extract all text with timestamps
    interface TextSegment {
      timestamp: string;
      text: string;
    }
    const segments: TextSegment[] = [];
    let currentTimestamp = "";

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip header lines and empty lines
      if (line.includes("====") || (!line.includes("[") && segments.length === 0) || !trimmedLine) {
        continue;
      }

      // Match lines with timestamps like [00:00] or [00:00] - text
      const timestampMatch = line.match(/\[(\d{2}:\d{2})\]\s*-?\s*(.*)/);

      if (timestampMatch) {
        currentTimestamp = timestampMatch[1];
        const textContent = timestampMatch[2].trim();
        if (textContent) {
          segments.push({ timestamp: currentTimestamp, text: textContent });
        }
      } else if (trimmedLine && currentTimestamp) {
        // Remove leading "|-" or "-"
        const cleanedLine = trimmedLine.replace(/^[-|]\s*/, "");
        if (cleanedLine) {
          segments.push({ timestamp: currentTimestamp, text: cleanedLine });
        }
      }
    }

    // Step 2: Combine segments into complete sentences based on punctuation and time gaps
    const entries: Array<{ timestamp: string; text: string }> = [];
    let sentenceTimestamp = "";
    let sentenceText = "";
    const TIME_GAP_THRESHOLD = 3; // 如果时间间隔超过3秒，强制分割

    console.log("[Result] Starting sentence combination, segments:", segments.length);

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // 检查时间戳间隔 - 如果间隔太大，强制结束当前句子
      if (sentenceText && sentenceTimestamp) {
        const prevTime = parseTimestamp(sentenceTimestamp);
        const currentTime = parseTimestamp(segment.timestamp);
        const timeDiff = currentTime - prevTime;

        // 如果时间间隔超过阈值，强制分割句子
        if (timeDiff > TIME_GAP_THRESHOLD) {
          entries.push({
            timestamp: sentenceTimestamp,
            text: sentenceText.trim(),
          });

          // 重置，准备开始新句子
          sentenceText = "";
          sentenceTimestamp = "";
        }
      }

      // If starting a new sentence, record the timestamp
      if (!sentenceText) {
        sentenceTimestamp = segment.timestamp;
      }

      // Add text to current sentence
      if (sentenceText) {
        sentenceText += " " + segment.text;
      } else {
        sentenceText = segment.text;
      }

      // Check if sentence ends with sentence-ending punctuation
      // Only . ! ? ... 。！？ are sentence endings, NOT comma (,)
      const endsWithPeriod = /[.!?。！？]\s*$/.test(sentenceText);
      const endsWithEllipsis = /\.\.\.\s*$/.test(sentenceText);

      if (endsWithPeriod || endsWithEllipsis) {
        // Complete sentence found
        entries.push({
          timestamp: sentenceTimestamp,
          text: sentenceText.trim(),
        });

        // Reset for next sentence
        sentenceText = "";
        sentenceTimestamp = "";
      }
    }

    // Add any remaining text as the last entry
    if (sentenceText) {
      entries.push({
        timestamp: sentenceTimestamp,
        text: sentenceText.trim(),
      });
    }

    console.log("[Result] Parsed transcript entries:", entries.length);
    console.log("[Result] Sample sentences (first 5):");
    entries.slice(0, 5).forEach((entry, idx) => {
      console.log(`  ${idx + 1}. [${entry.timestamp}] ${entry.text}`);
    });

    // Debug: Find the "power plant" sentence
    const powerPlantEntry = entries.find((e) => e.text.includes("at a power plant"));
    if (powerPlantEntry) {
      console.log("[Result] Power plant sentence:", powerPlantEntry);
    }

    return entries;
  };

  const initializeYouTubePlayer = () => {
    if (isExtension) {
      // 扩展模式：使用沙盒 iframe
      console.log("[Result] Extension mode: using sandboxed player");
      // 沙盒播放器通过 postMessage 通信，在 useEffect 中设置监听
      return;
    }

    // 普通 web 模式：使用 YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        createPlayer();
      };
    } else {
      createPlayer();
    }
  };

  const createPlayer = () => {
    const YT = window.YT;
    if (YT && YT.Player) {
      const newPlayer = new YT.Player("youtube-player", {
        videoId: videoId,
        playerVars: {
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            console.log("[Result] YouTube player ready");
            setPlayerReady(true);
          },
        },
      });
      setPlayer(newPlayer);
      console.log("[Result] YouTube player initialized");
    }
  };

  const scrollToTranscript = useCallback(
    (index: number) => {
      // Only scroll if Transcript tab is active
      if (activeTab !== "transcript") {
        console.log("[Result] Skip scroll - tab not active");
        return;
      }

      const element = transcriptRefs.current[index];
      const container = transcriptContainerRef.current;

      if (element && container) {
        try {
          // Get element and container positions
          const elementRect = element.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          // Calculate the element's position relative to the container
          const relativeTop = elementRect.top - containerRect.top;

          // Current scroll position
          const currentScroll = container.scrollTop;

          // Calculate new scroll position to center the element
          const containerHeight = container.clientHeight;
          const targetScroll = currentScroll + relativeTop - containerHeight / 2;

          console.log(
            "[Result] Scrolling transcript container to index:",
            index,
            "position:",
            targetScroll,
          );

          // Scroll within the container only (NOT the whole page)
          container.scrollTo({
            top: targetScroll,
            behavior: "smooth",
          });
        } catch (err) {
          console.error("[Result] Scroll error:", err);
        }
      } else {
        console.log("[Result] Skip scroll - element or container not found");
      }
    },
    [activeTab],
  );

  const updateCurrentTranscript = useCallback(
    (currentTimeInSeconds: number) => {
      if (transcriptData.length === 0) return;

      // Convert transcript timestamps to seconds and find the current one
      for (let i = transcriptData.length - 1; i >= 0; i--) {
        const timestamp = transcriptData[i].timestamp;
        const parts = timestamp.split(":").map(Number);
        let transcriptSeconds = 0;

        if (parts.length === 2) {
          transcriptSeconds = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
          transcriptSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }

        // If current time is past this transcript entry, highlight it
        if (currentTimeInSeconds >= transcriptSeconds) {
          setCurrentTranscriptIndex((prev) => {
            if (prev !== i) {
              scrollToTranscript(i);
              return i;
            }
            return prev;
          });
          break;
        }
      }
    },
    [transcriptData, scrollToTranscript],
  );

  // Track video time updates (web mode)
  useEffect(() => {
    if (isExtension) return; // 扩展模式下使用 postMessage
    if (!player || !playerReady || transcriptData.length === 0) return;

    console.log("[Result] Starting time tracking with", transcriptData.length, "entries");

    const interval = setInterval(() => {
      if (player && playerReady && player.getCurrentTime) {
        try {
          const currentTime = player.getCurrentTime();
          updateCurrentTranscript(currentTime);
        } catch (err) {
          console.error("[Result] Error getting current time:", err);
        }
      }
    }, 500);

    return () => {
      clearInterval(interval);
      console.log("[Result] Stopped time tracking");
    };
  }, [player, playerReady, transcriptData, updateCurrentTranscript]);

  // 扩展模式：直接使用 YouTube iframe embed，无需沙盒
  // 时间跳转通过更新 youtubeStartTime state 实现

  const parseMessageWithTimestamp = (content: string) => {
    // 匹配[MM:SS] 或者 [HH:MM:SS] 的格式
    const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = timestampRegex.exec(content)) !== null) {
      // 添加时间戳之前的文本
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: content.substring(lastIndex, match.index),
        });
      }

      // 添加时间戳
      parts.push({
        type: "timestamp",
        content: match[1],
        fullMatch: match[0],
      });

      lastIndex = match.index + match[0].length;
    }

    // 添加剩余文本
    if (lastIndex < content.length) {
      parts.push({
        type: "text",
        content: content.substring(lastIndex),
      });
    }

    return parts;
  };

  const jumpToTimestamp = (timestamp: string) => {
    // Convert timestamp (MM:SS or HH:MM:SS) to seconds
    const parts = timestamp.split(":").map(Number);
    let seconds = 0;

    if (parts.length === 2) {
      // MM:SS format
      seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // HH:MM:SS format
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    console.log("[Result] Jumping to timestamp:", timestamp, "=", seconds, "seconds");

    if (isExtension) {
      // 扩展模式：通过更新 iframe src 来跳转时间
      console.log("[Result] Extension mode: seeking to", seconds, "seconds");
      setYoutubeStartTime(seconds);
    } else {
      // Web 模式：直接调用 player API
      if (player && playerReady && player.seekTo) {
        player.seekTo(seconds, true);
        player.playVideo();
      } else {
        console.warn("[Result] Player not ready, cannot seek. Ready:", playerReady);
      }
    }
  };

  const loadVideoData = async (id: string, useLocalCache: boolean = false) => {
    try {
      console.log("[Result] Loading video data for:", id, "useLocalCache:", useLocalCache);
      setError(null);

      // 如果是示例视频，优先使用本地缓存
      if (useLocalCache) {
        console.log("[Result] 📂 Loading from local cache for example video");
        try {
          const localResponse = await fetch(`/data/json/video-data-${id}.json`);
          if (localResponse.ok) {
            const localData = await localResponse.json();
            console.log("[Result] ✅ Local cache loaded successfully");
            console.log("[Result] Sections count:", localData.sections?.length || 0);
            setVideoData(localData);
            setLoading(false);
            return;
          }
        } catch (localError) {
          console.error("[Result] ❌ Local cache failed:", localError);
        }
      }

      // Try to load from backend API
      const timeoutId = setTimeout(() => {
        console.log("[Result] ⏱️ Request taking longer than 60s");
      }, 60000);

      try {
        // 构建 URL，如果有非英文语言则添加 language 参数
        let url = `${API_BASE_URL}/api/videos/${id}`;
        if (language && language !== "en") {
          url += `?language=${language}`;
        }
        console.log("[Result] 🔍 Fetching from:", url, "language:", language);
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
          },
        });
        console.log("[Result] 📥 Response received:", response.status, response.ok);

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        console.log("[Result] ✅ Video data loaded successfully");
        setVideoData(data);
        return;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.error("[Result] ❌ Fetch error:", fetchError);
        throw fetchError;
      }
    } catch (apiError) {
      console.error("[Result] Failed to load from API:", apiError);

      // Fallback: Try to load from local data directory
      try {
        console.log("[Result] Attempting local fallback: /data/json/video-data-" + id + ".json");
        const localResponse = await fetch(`/data/json/video-data-${id}.json`);

        if (localResponse.ok) {
          const localData = await localResponse.json();
          console.log("[Result] Local data loaded successfully");
          setVideoData(localData);
        } else {
          throw new Error("Local data not found");
        }
      } catch (localError) {
        console.error("[Result] Failed to load local data:", localError);
        setError("Failed to load video data. Please try analyzing the video again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (id: string, maxResults: number = 20) => {
    console.log("[Result] Loading comments for:", id);
    setCommentsLoading(true);
    setCommentsError(null);

    try {
      const url = `${API_BASE_URL}/api/videos/${id}/comments?maxResults=${maxResults}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status}`);
      }

      const data = await response.json();
      console.log("[Result] Comments response:", data);

      if (data.success) {
        setComments(data.comments || []);
        console.log("[Result] ✅ Loaded", data.total, "comments");
      } else {
        setCommentsError(data.message || data.error || "Failed to load comments");
        console.warn("[Result] ⚠️ Comments loading unsuccessful:", data.message);
      }
    } catch (error) {
      console.error("[Result] ❌ Failed to load comments:", error);
      setCommentsError(error instanceof Error ? error.message : "Failed to load comments");
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    setChatMessages((prev) => [...prev, { type: "user", content: chatInput }]);
    const userMessage = chatInput;
    setChatInput("");
    setIsChatThinking(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          video_context: {
            videoId,
            title,
            transcript: transcriptContent.current, // 添加完整的 transcript 内容
          },
        }),
      });
      const data = await response.json();

      if (data.success) {
        setChatMessages((prev) => [...prev, { type: "bot", content: data.response }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages((prev) => [
        ...prev,
        {
          type: "bot",
          content: "Sorry, I'm having trouble processing your request. Please try again later.",
        },
      ]);
    } finally {
      setIsChatThinking(false);
    }
  };

  const downloadPDF = async () => {
    try {
      // Prepare notes data for PDF export
      const notesForExport = notes.map((note) => ({
        sectionId: note.sectionId,
        sentenceIndex: note.sentenceIndex,
        contentPreview: note.contentPreview,
        noteText: note.noteText,
        createdAt: note.createdAt.toISOString(),
      }));

      const response = await fetch(`${API_BASE_URL}/api/generate-pdf/${videoId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes: notesForExport,
          videoTitle: videoData?.videoInfo?.title || title || "Video Analysis",
        }),
      });

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${title || "video"}.pdf`;
      a.click();
    } catch (error) {
      console.error("PDF download failed:", error);
    }
  };

  // 如果没有 videoId 且没有 streamingUrl，显示错误页面
  if (!videoId && !streamingUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md space-y-4 rounded-lg border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg
              className="h-8 w-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">No Video Data</h2>
          <p className="text-gray-600">Please analyze a video first</p>
          <Link to="/">
            <Button className="bg-blue-600 text-white hover:bg-blue-700">Return to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f5]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="font-medium">Back</span>
          </Link>
          <Button onClick={downloadPDF} variant="outline" className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export PDF
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar - Navigation & Comments */}
          <div className="w-[240px] flex-shrink-0">
            <div className="sticky top-20 space-y-4">
              {/* Table of Contents */}
              <div className="rounded-lg border bg-white p-4">
                <div className="mb-3 text-xs font-medium tracking-wide text-gray-500 uppercase">
                  目录
                </div>
                <nav className="space-y-1">
                  {videoData?.sections?.map((section, index) => (
                    <a
                      key={section.id}
                      href={`#section-${section.id}`}
                      className="block truncate rounded px-2 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                      title={section.title}
                    >
                      {index + 1}. {section.title}
                    </a>
                  ))}
                  {(!videoData?.sections || videoData.sections.length === 0) && (
                    <p className="text-xs text-gray-400">加载中...</p>
                  )}
                </nav>
              </div>

              {/* Comments Panel - Feishu style */}
              <div className="rounded-lg border bg-white">
                <div className="border-b border-gray-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    <span className="text-xs font-medium text-gray-700">评论</span>
                  </div>
                </div>

                {!selectedSentence ? (
                  <div className="px-4 py-8 text-center">
                    <svg
                      className="mx-auto mb-2 h-8 w-8 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                      />
                    </svg>
                    <p className="text-xs text-gray-500">悬停在句子上</p>
                    <p className="text-xs text-gray-400">查看或添加评论</p>
                  </div>
                ) : (
                  <>
                    {/* Selected sentence preview */}
                    <div className="border-b border-gray-100 bg-amber-50 px-4 py-2">
                      <p className="line-clamp-2 text-xs text-amber-800">
                        "{selectedSentence.content}"
                      </p>
                      <button
                        onClick={() => setSelectedSentence(null)}
                        className="mt-1 text-[10px] text-amber-600 hover:text-amber-700"
                      >
                        取消选择
                      </button>
                    </div>

                    {/* Comments list */}
                    <div className="max-h-[280px] overflow-y-auto">
                      {sidebarCommentsLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                        </div>
                      ) : sidebarComments.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                          <p className="text-xs text-gray-500">暂无评论</p>
                          <p className="text-xs text-gray-400">成为第一个评论者！</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {sidebarComments.map((comment) => (
                            <div key={comment.id} className="px-4 py-3">
                              <div className="flex gap-2">
                                {comment.avatar && (
                                  <img
                                    src={comment.avatar}
                                    alt={comment.author}
                                    className="h-5 w-5 flex-shrink-0 rounded-full bg-gray-100"
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="mb-1 flex items-baseline gap-1">
                                    <span className="text-[11px] font-medium text-gray-900">
                                      {comment.author}
                                    </span>
                                    {comment.is_ai_generated && (
                                      <span className="rounded bg-purple-100 px-1 py-0.5 text-[8px] font-medium text-purple-600">
                                        AI
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] leading-relaxed text-gray-700">
                                    {comment.comment_text}
                                  </p>
                                  <span className="text-[9px] text-gray-400">
                                    {new Date(comment.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add comment form */}
                    <form
                      onSubmit={handleSubmitSidebarComment}
                      className="border-t border-gray-100 p-3"
                    >
                      <input
                        type="text"
                        placeholder="你的名字（可选）"
                        value={sidebarAuthorName}
                        onChange={(e) => setSidebarAuthorName(e.target.value)}
                        className="mb-2 w-full rounded border border-gray-200 px-2 py-1 text-[11px] focus:border-blue-400 focus:outline-none"
                      />
                      <div className="flex gap-1">
                        <input
                          type="text"
                          placeholder="添加评论..."
                          value={newSidebarComment}
                          onChange={(e) => setNewSidebarComment(e.target.value)}
                          className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-[11px] focus:border-blue-400 focus:outline-none"
                          disabled={isSubmittingSidebarComment}
                        />
                        <button
                          type="submit"
                          disabled={!newSidebarComment.trim() || isSubmittingSidebarComment}
                          className="rounded bg-blue-600 px-2 py-1.5 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                          {isSubmittingSidebarComment ? (
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          ) : (
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Middle - Main Content */}
          <div className="min-w-0 flex-1 space-y-6">
            {/* Video Information */}
            <div className="rounded-lg bg-white p-6">
              <h1 className="mb-3 text-2xl font-bold text-gray-900">
                {videoData?.videoInfo?.title || title || "Video Analysis"}
              </h1>
              {videoData?.videoInfo?.summary && (
                <p className="leading-relaxed text-gray-600">{videoData.videoInfo.summary}</p>
              )}
            </div>

            {/* Content Sections */}
            <div className="rounded-lg border bg-white">
              <div className="border-b px-6 py-4">
                <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                  Content Sections
                </div>
              </div>

              {error ? (
                <div className="p-12 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <svg
                      className="h-8 w-8 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="mb-4 text-gray-600">{error}</p>
                  <Link to="/">
                    <Button className="bg-blue-600 text-white hover:bg-blue-700">
                      Return to Home
                    </Button>
                  </Link>
                </div>
              ) : !videoData?.sections || videoData.sections.length === 0 ? (
                <div className="p-12 text-center">
                  {isStreaming ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                      <p className="text-gray-600">AI 正在分析视频内容...</p>
                    </div>
                  ) : (
                    <p className="text-gray-600">No content sections available</p>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {videoData?.sections?.map((section) => {
                    // 根据 section 中间 content 的时间戳找到对应的 chapter
                    let matchedChapter: Chapter | undefined;

                    if (
                      chapters &&
                      chapters.length > 0 &&
                      section.content &&
                      section.content.length > 0
                    ) {
                      // 获取 section 中间 content 的时间戳并转换为秒数
                      const midIndex = Math.floor(section.content.length / 2);
                      const midTimestamp = section.content[midIndex].timestampStart;
                      const parts = midTimestamp.split(":").map(Number);
                      let sectionMidSeconds = 0;
                      if (parts.length === 2) {
                        sectionMidSeconds = parts[0] * 60 + parts[1];
                      } else if (parts.length === 3) {
                        sectionMidSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                      }

                      // 找到时间戳小于等于 section 中间时间的最后一个 chapter
                      for (let i = chapters.length - 1; i >= 0; i--) {
                        if (chapters[i].timestamp <= sectionMidSeconds) {
                          matchedChapter = chapters[i];
                          break;
                        }
                      }

                      // 如果没找到（section 时间早于所有 chapter），使用第一个 chapter
                      if (!matchedChapter && chapters.length > 0) {
                        matchedChapter = chapters[0];
                      }
                    }

                    return (
                      <div
                        key={section.id}
                        id={`section-${section.id}`}
                        className="scroll-mt-20 p-6"
                      >
                        {/* Section Header with Thumbnail */}
                        <div className="mb-4 flex gap-4">
                          {/* Chapter Thumbnail */}
                          {matchedChapter && (
                            <div
                              onClick={() => {
                                const minutes = Math.floor(matchedChapter.timestamp / 60);
                                const seconds = matchedChapter.timestamp % 60;
                                const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
                                jumpToTimestamp(timeStr);
                              }}
                              className="group relative w-40 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg"
                            >
                              <div className="aspect-video bg-gray-100">
                                {matchedChapter.thumbnail_url ? (
                                  <img
                                    src={matchedChapter.thumbnail_url}
                                    alt={matchedChapter.title}
                                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-gray-200">
                                    <svg
                                      className="h-6 w-6 text-gray-400"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                      />
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                  </div>
                                )}
                                {/* Timestamp Badge */}
                                <div className="absolute right-1 bottom-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                  {Math.floor(matchedChapter.timestamp / 60)}:
                                  {(matchedChapter.timestamp % 60).toString().padStart(2, "0")}
                                </div>
                                {/* Play overlay on hover */}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                                  <svg
                                    className="h-8 w-8 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Section Title */}
                          <div className="flex-1 border-b border-gray-100 pb-3">
                            <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
                            {matchedChapter && matchedChapter.title !== section.title && (
                              <p className="mt-1 text-xs text-gray-500">
                                Chapter: {matchedChapter.title}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Section Content with Interactive Comments */}
                        <p className="text-sm leading-relaxed text-gray-700">
                          {section.content?.map((item, itemIndex) => {
                            const commentKey = `${section.id}-${itemIndex}`;
                            const commentCount = sentenceCommentCounts.get(commentKey) || 0;
                            const isSelected =
                              selectedSentence?.sectionId === section.id &&
                              selectedSentence?.sentenceIndex === itemIndex;
                            const hasNote = notes.some(
                              (n) => n.sectionId === section.id && n.sentenceIndex === itemIndex,
                            );

                            return (
                              <span key={itemIndex}>
                                <SentenceWithComments
                                  videoId={videoId || ""}
                                  sectionId={section.id}
                                  sentenceIndex={itemIndex}
                                  content={item.content}
                                  timestampStart={item.timestampStart}
                                  commentCount={commentCount}
                                  hasNote={hasNote}
                                  isSelected={isSelected}
                                  onTimestampClick={jumpToTimestamp}
                                  onSentenceSelect={handleSentenceSelect}
                                  onDoubleClick={handleSentenceDoubleClick}
                                />
                                {itemIndex < (section.content?.length || 0) - 1 && " "}
                              </span>
                            );
                          })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Video & Tabs */}
          <div className="w-[420px] flex-shrink-0 space-y-4">
            {/* Video Player */}
            <div className="sticky top-20 overflow-visible rounded-lg border bg-white">
              <div className="aspect-video bg-black">
                {!videoId ? (
                  // 流式分析中，videoId 尚未获取
                  <div className="flex h-full w-full items-center justify-center bg-gray-900">
                    <div className="text-center">
                      <svg
                        className="mx-auto h-12 w-12 animate-pulse text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="mt-2 text-sm text-gray-500">正在加载视频...</p>
                    </div>
                  </div>
                ) : isExtension ? (
                  <iframe
                    ref={youtubeIframeRef}
                    src={`https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0${youtubeStartTime > 0 ? `&start=${Math.floor(youtubeStartTime)}&autoplay=1` : ""}`}
                    className="h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <div id="youtube-player" className="h-full w-full"></div>
                )}
              </div>

              {/* Chapter/Show Toggle */}
              {/* <div className="flex items-center gap-2 border-b p-3 text-sm">
                <button className="rounded bg-gray-900 px-3 py-1.5 font-medium text-white">
                  Chapter
                </button>
                <button className="rounded px-3 py-1.5 font-medium text-gray-700 transition-colors hover:bg-gray-100">
                  Show
                </button>
              </div> */}

              {/* Tab Headers */}
              <div className="relative z-30 flex items-center border-b">
                <button
                  onClick={() => setActiveTab("transcript")}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === "transcript"
                      ? "border-b-2 border-gray-900 text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Transcript
                </button>
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === "chat"
                      ? "border-b-2 border-gray-900 text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab("notes")}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === "notes"
                      ? "border-b-2 border-gray-900 text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Notes{" "}
                  {notes.length > 0 && (
                    <span className="ml-1 rounded-full bg-yellow-400 px-1.5 text-[10px] text-yellow-900">
                      {notes.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Content */}
              <div ref={transcriptContainerRef} className="h-[500px] overflow-y-auto">
                {/* Transcript Tab */}
                {activeTab === "transcript" && (
                  <div className="space-y-3 p-4">
                    {transcriptData.length > 0 ? (
                      transcriptData.map((item, index) => (
                        <div
                          key={index}
                          ref={(el) => {
                            transcriptRefs.current[index] = el;
                          }}
                          className={`cursor-pointer rounded-sm px-3 py-2 transition-all ${
                            currentTranscriptIndex === index
                              ? "bg-yellow-200 font-medium text-gray-900"
                              : "bg-white hover:bg-blue-50"
                          }`}
                          title={item.timestamp}
                        >
                          <div className="text-xs leading-relaxed text-gray-700">{item.text}</div>
                        </div>
                      ))
                    ) : (
                      <p className="py-8 text-center text-xs text-gray-500">
                        Loading transcript...
                      </p>
                    )}
                  </div>
                )}

                {/* Chat Tab */}
                {activeTab === "chat" && (
                  <div className="flex h-full flex-col">
                    <div className="flex-1 space-y-3 overflow-y-auto p-4">
                      {chatMessages.map((msg, index) => (
                        <div
                          key={index}
                          className={`flex gap-2 ${msg.type === "user" ? "justify-end" : ""}`}
                        >
                          {msg.type === "bot" && (
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs">
                              🤖
                            </div>
                          )}
                          <div
                            className={`rounded-lg px-3 py-2 text-xs ${
                              msg.type === "bot"
                                ? "flex-1 bg-gray-100"
                                : "max-w-[80%] bg-blue-100 whitespace-pre-wrap text-gray-900"
                            }`}
                          >
                            {msg.type === "bot"
                              ? parseMessageWithTimestamp(msg.content).map((part, idx) => {
                                  if (part.type === "timestamp") {
                                    return (
                                      <span
                                        key={idx}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          jumpToTimestamp(part.content);
                                        }}
                                        className="inline-flex cursor-pointer items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-700 transition-colors hover:bg-blue-200 hover:text-blue-800"
                                        title={`Jump to ${part.content}`}
                                      >
                                        <svg
                                          className="h-3 w-3"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                          />
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                          />
                                        </svg>
                                        {part.content}
                                      </span>
                                    );
                                  }
                                  return <span key={idx}>{part.content}</span>;
                                })
                              : msg.content}
                          </div>
                        </div>
                      ))}

                      {/* 思考中的动画 */}
                      {isChatThinking && (
                        <div className="mt-2 flex gap-2">
                          <div className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-600">Thinking</span>
                              <div className="flex gap-1">
                                <span
                                  className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-400"
                                  style={{ animationDelay: "0ms" }}
                                ></span>
                                <span
                                  className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-400"
                                  style={{ animationDelay: "150ms" }}
                                ></span>
                                <span
                                  className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-400"
                                  style={{ animationDelay: "300ms" }}
                                ></span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="border-t p-4">
                      <div
                        className={`flex gap-2 transition-transform duration-200 ${
                          isDragOver ? "scale-105" : "scale-100"
                        }`}
                        onDragOver={(e) => {
                          // 允许拖拽
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                          setIsDragOver(true);
                        }}
                        onDragLeave={() => {
                          setIsDragOver(false);
                        }}
                        onDrop={(e) => {
                          // 处理拖拽数据
                          e.preventDefault();
                          setIsDragOver(false);

                          const droppedText = e.dataTransfer.getData("text/plain");
                          if (droppedText) {
                            setChatInput((prev) => (prev ? `${prev}${droppedText}` : droppedText));
                          }
                        }}
                      >
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              handleSendMessage();
                            }
                          }}
                          placeholder="Ask about the video..."
                          className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                            isDragOver ? "border-blue-400 bg-blue-50" : ""
                          }`}
                        />
                        <button
                          onClick={handleSendMessage}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-white transition-colors hover:bg-blue-700"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes Tab */}
                {activeTab === "notes" && (
                  <div className="flex h-full flex-col">
                    {/* Note Editor - when editing */}
                    {editingNote && (
                      <div className="border-b border-gray-200 bg-yellow-50 p-4">
                        <div className="mb-2">
                          <p className="mb-1 text-[10px] font-medium text-gray-500 uppercase">
                            添加笔记到：
                          </p>
                          <p className="line-clamp-2 text-xs text-gray-600 italic">
                            "{editingNote.content}"
                          </p>
                        </div>
                        <textarea
                          value={noteInputText}
                          onChange={(e) => setNoteInputText(e.target.value)}
                          placeholder="写下你的笔记..."
                          className="mb-2 h-24 w-full resize-none rounded-lg border border-yellow-300 bg-white p-3 text-xs focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 focus:outline-none"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={handleCancelNote}
                            className="rounded px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-100"
                          >
                            取消
                          </button>
                          <button
                            onClick={handleSaveNote}
                            disabled={!noteInputText.trim()}
                            className="rounded bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-yellow-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                          >
                            保存笔记
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Notes List */}
                    <div className="flex-1 overflow-y-auto p-4">
                      {notes.length === 0 && !editingNote ? (
                        <div className="py-8 text-center">
                          <svg
                            className="mx-auto mb-3 h-12 w-12 text-gray-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                          <p className="text-sm font-medium text-gray-600">暂无笔记</p>
                          <p className="mt-1 text-xs text-gray-400">双击左侧内容可添加笔记</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {notes.map((note) => (
                            <div
                              key={note.id}
                              className="group rounded-lg border border-yellow-200 bg-yellow-50 p-3 transition-colors hover:border-yellow-300"
                            >
                              {/* Content preview */}
                              <p className="mb-2 line-clamp-1 text-[10px] text-gray-500 italic">
                                "{note.contentPreview}..."
                              </p>

                              {/* Note text */}
                              <p className="text-xs leading-relaxed text-gray-800">
                                {note.noteText}
                              </p>

                              {/* Footer */}
                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-[10px] text-gray-400">
                                  {note.createdAt.toLocaleDateString()}
                                </span>
                                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button
                                    onClick={() => {
                                      // Find the original content
                                      const section = videoData?.sections?.find(
                                        (s) => s.id === note.sectionId,
                                      );
                                      const content =
                                        section?.content?.[note.sentenceIndex]?.content ||
                                        note.contentPreview;
                                      setEditingNote({
                                        sectionId: note.sectionId,
                                        sentenceIndex: note.sentenceIndex,
                                        content,
                                      });
                                      setNoteInputText(note.noteText);
                                    }}
                                    className="rounded p-1 text-gray-400 transition-colors hover:bg-yellow-100 hover:text-yellow-600"
                                    title="编辑"
                                  >
                                    <svg
                                      className="h-3 w-3"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteNote(note.id)}
                                    className="rounded p-1 text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600"
                                    title="删除"
                                  >
                                    <svg
                                      className="h-3 w-3"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
