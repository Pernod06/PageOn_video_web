import { Button } from "@/components";
import { useLocation, Link } from "react-router";
import { useState, useEffect, useRef, useCallback } from "react";

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

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string, config: unknown) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type TabType = "transcript" | "chat" | "comments" | "notes";

// API配置 - 直接使用公网后端，避免 proxy 的 ERR_CONTENT_LENGTH_MISMATCH 问题
const API_BASE_URL = "http://52.72.117.236:5000";

export default function Result() {
  const location = useLocation();
  const { videoId, title } = location.state || {};

  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const [translatedData, setTranslatedData] = useState<
    Array<{ timestamp: string; text: string; translated?: string }>
  >([]);
  const [currentTranscriptIndex, setCurrentTranscriptIndex] = useState<number>(-1);
  const [selectedLanguage, setSelectedLanguage] = useState("en"); // 'en', 'zh', 'ja', 'es'
  const [isTranslating, setIsTranslating] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  // 保存完整的 transcript 文本内容
  const transcriptContent = useRef<string>("");

  const transcriptRefs = useRef<(HTMLDivElement | null)[]>([]);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (videoId) {
      console.log("[Result] Component mounted with videoId:", videoId);
      setPlayerReady(false); // 重置 player ready 状态

      // Load all data - they will complete even if component unmounts due to HMR
      loadVideoData(videoId);
      loadTranscript(videoId);
      loadComments(videoId, 20);
      initializeYouTubePlayer();
    } else {
      console.warn("[Result] No videoId provided");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const loadTranscript = async (id: string) => {
    console.log("[Result] Loading transcript for:", id);

    // Try to load from backend API first
    try {
      const url = `${API_BASE_URL}/api/transcript/${id}`;
      console.log("[Result] Attempting API:", url);
      const response = await fetch(url);

      if (response.ok) {
        const text = await response.text();
        console.log("[Result] API response text length:", text.length);

        // 保存完整的原始文本
        transcriptContent.current = text;

        const parsed = parseTranscript(text);
        setTranscriptData(parsed);
        console.log("[Result] ✅ Transcript loaded from API, entries:", parsed.length);
        if (parsed.length > 0) {
          console.log("[Result] First entry:", parsed[0]);
          console.log("[Result] Last entry:", parsed[parsed.length - 1]);
        }
        return;
      } else {
        console.warn("[Result] API returned status:", response.status);
      }
    } catch (apiError) {
      console.error("[Result] ❌ API failed:", apiError);
    }

    // Fallback: load from local file in src/data/transcript/
    try {
      console.log("[Result] Attempting local file: /src/data/transcript/transcript_" + id + ".txt");
      const localResponse = await fetch(`/src/data/transcript/transcript_${id}.txt`);

      if (localResponse.ok) {
        const text = await localResponse.text();
        console.log("[Result] Local file text length:", text.length);

        // 保存完整的原始文本
        transcriptContent.current = text;

        const parsed = parseTranscript(text);
        setTranscriptData(parsed);
        console.log("[Result] ✅ Local transcript loaded, entries:", parsed.length);
        if (parsed.length > 0) {
          console.log("[Result] First entry:", parsed[0]);
          console.log("[Result] Last entry:", parsed[parsed.length - 1]);
        }
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
    // Load YouTube IFrame API
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

  // Track video time updates
  useEffect(() => {
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

    if (player && playerReady && player.seekTo) {
      player.seekTo(seconds, true);
      player.playVideo();
    } else {
      console.warn("[Result] Player not ready, cannot seek. Ready:", playerReady);
    }
  };

  const translateTranscript = async (targetLang: string) => {
    if (targetLang === "en") {
      // 英文，清空翻译数据
      setTranslatedData([]);
      return;
    }

    setIsTranslating(true);
    console.log("[Result] Starting concurrent translation to:", targetLang);
    console.log("[Result] Total sentences:", transcriptData.length);

    try {
      // 翻译单个句子的函数
      const translateSentence = async (
        item: { timestamp: string; text: string },
        index: number,
      ) => {
        try {
          const response = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(item.text)}&langpair=en|${targetLang}`,
          );

          if (response.ok) {
            const data = await response.json();
            return {
              index,
              item: {
                ...item,
                translated: data.responseData.translatedText,
              },
            };
          } else {
            console.warn(`[Result] Translation failed for sentence ${index}`);
            return {
              index,
              item: {
                ...item,
                translated: item.text,
              },
            };
          }
        } catch (error) {
          console.error(`[Result] Translation error for sentence ${index}:`, error);
          return {
            index,
            item: {
              ...item,
              translated: item.text,
            },
          };
        }
      };

      // 批量并发翻译（每批10个，避免请求过多）
      const BATCH_SIZE = 10;
      const results: Array<{ timestamp: string; text: string; translated?: string } | undefined> =
        new Array(transcriptData.length);

      for (let i = 0; i < transcriptData.length; i += BATCH_SIZE) {
        const batch = transcriptData.slice(i, i + BATCH_SIZE);
        console.log(
          `[Result] Translating batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(transcriptData.length / BATCH_SIZE)}`,
        );

        // 并发翻译这一批
        const batchPromises = batch.map((item, batchIndex) =>
          translateSentence(item, i + batchIndex),
        );

        const batchResults = await Promise.all(batchPromises);

        // 保存结果
        batchResults.forEach((result) => {
          results[result.index] = result.item;
        });

        // 实时更新显示（过滤掉undefined）
        const currentTranslated = results.filter((item) => item !== undefined);
        setTranslatedData([...currentTranslated]);

        // 批次之间稍微延迟，避免API限流
        if (i + BATCH_SIZE < transcriptData.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      console.log("[Result] Translation completed, total:", results.length);
    } catch (error) {
      console.error("[Result] Translation error:", error);
      setTranslatedData([]);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    setShowLanguageMenu(false);
    translateTranscript(lang);
  };

  // 点击外部关闭语言菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showLanguageMenu && !target.closest(".language-selector")) {
        setShowLanguageMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showLanguageMenu]);

  const loadVideoData = async (id: string) => {
    try {
      console.log("[Result] Loading video data for:", id);
      console.log("[Result] ⚡ CODE UPDATED - NEW VERSION LOADED ⚡");
      setError(null);

      // Try to load from backend API first
      // Note: We don't use abort signal here to avoid HMR interruption
      const timeoutId = setTimeout(() => {
        console.log("[Result] ⏱️ Request taking longer than 60s");
      }, 60000); // Log warning after 60 seconds

      try {
        const url = `${API_BASE_URL}/api/videos/${id}`;
        console.log("[Result] 🔍 Fetching from:", url);
        const response = await fetch(url, {
          // Don't use signal - let the request complete even if component unmounts
          // signal: signal,
          headers: {
            Accept: "application/json",
          },
        });
        console.log("[Result] 📥 Response received:", response.status, response.ok);

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        console.log("[Result] 🔄 Parsing JSON...");

        const data = await response.json();
        console.log("[Result] ✅ JSON parsed successfully, type:", typeof data);
        console.log("[Result] ✅ Video data loaded successfully");
        console.log("[Result] Data structure:", {
          hasVideoInfo: !!data.videoInfo,
          hasSections: !!data.sections,
          sectionsCount: data.sections?.length || 0,
        });

        console.log("[Result] 💾 Setting video data state...");
        setVideoData(data);
        console.log("[Result] 💾 Video data state set successfully");
        return; // Success, exit early
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.error("[Result] ❌ Fetch error:", fetchError);
        throw fetchError;
      }
    } catch (apiError) {
      console.error("[Result] Failed to load from API:", apiError);

      // Fallback: Try to load from local data directory (development mode)
      try {
        console.log(
          "[Result] Attempting to load local data from /src/data/json/video-data-" + id + ".json",
        );
        const localResponse = await fetch(`/src/data/json/video-data-${id}.json`);

        if (localResponse.ok) {
          const localData = await localResponse.json();
          console.log("[Result] Local data loaded successfully");
          console.log("[Result] Sections count:", localData.sections?.length || 0);
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
      const response = await fetch(`${API_BASE_URL}/api/generate-pdf`);
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

  if (!videoId) {
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
    <div className="min-h-screen bg-gray-50">
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
      <div className="mx-auto max-w-[1200px] px-6 py-6">
        <div className="flex gap-6">
          {/* Left Side - Main Content */}
          <div className="flex-2 space-y-6">
            {/* Video Information */}
            <div className="rounded-lg bg-gray-100 p-6">
              <div className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
                Video Information
              </div>
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

              {loading ? (
                <div className="p-12 text-center">
                  <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                  <p className="text-gray-600">Loading content...</p>
                </div>
              ) : error ? (
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
                  <p className="text-gray-600">No content sections available</p>
                </div>
              ) : (
                <div className="divide-y">
                  {videoData?.sections?.map((section) => (
                    <div key={section.id} className="p-6">
                      {/* Section Title */}
                      <div className="mb-4 border-b border-gray-100 pb-3">
                        <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
                      </div>

                      {/* Section Content */}
                      <p className="text-sm leading-relaxed text-gray-700">
                        {section.content?.map((item, itemIndex) => (
                          <>
                            <span
                              key={itemIndex}
                              draggable="true"
                              onDragStart={(e) => {
                                // 保存句子内容到拖拽数据
                                e.dataTransfer.setData("text/plain", item.content);
                                e.dataTransfer.effectAllowed = "copy";

                                // 视觉反馈
                                e.currentTarget.style.opacity = "0.5";
                              }}
                              onDragEnd={(e) => {
                                // 恢复视觉反馈
                                e.currentTarget.style.opacity = "1";
                              }}
                              onClick={() => jumpToTimestamp(item.timestampStart)}
                              className="cursor-pointer rounded-sm px-0.5 transition-colors hover:bg-blue-100 hover:text-blue-900"
                              title="Click to jump, Drag to chat"
                            >
                              {item.content}
                            </span>
                            {itemIndex < (section.content?.length || 0) - 1 && " "}
                          </>
                        ))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Video & Tabs */}
          <div className="w-[420px] flex-shrink-0 space-y-4">
            {/* Video Player */}
            <div className="sticky top-20 overflow-visible rounded-lg border bg-white">
              <div className="aspect-video bg-black">
                <div id="youtube-player" className="h-full w-full"></div>
              </div>

              {/* Chapter/Show Toggle */}
              <div className="flex items-center gap-2 border-b p-3 text-sm">
                <button className="rounded bg-gray-900 px-3 py-1.5 font-medium text-white">
                  Chapter
                </button>
                <button className="rounded px-3 py-1.5 font-medium text-gray-700 transition-colors hover:bg-gray-100">
                  Show
                </button>
              </div>

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
                <div
                  className={`language-selector relative py-4 transition-colors ${
                    activeTab === "transcript" ? "border-b-2 border-gray-900" : ""
                  }`}
                >
                  <button
                    onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                    className={`flex items-center rounded text-xs transition-colors hover:bg-gray-100 ${
                      activeTab === "transcript"
                        ? "text-gray-900"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    title="Select Language"
                  >
                    {/* <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                      </svg> */}
                    {/* <span className="text-xs">
                        {selectedLanguage === 'en' && 'EN'}
                        {selectedLanguage === 'zh' && '中文'}
                        {selectedLanguage === 'ja' && '日本語'}
                        {selectedLanguage === 'es' && 'ES'}
                      </span> */}
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Language Menu */}
                  {showLanguageMenu && (
                    <div className="absolute top-full right-0 z-[100] mt-1 w-48 rounded-md border bg-white shadow-lg">
                      <button
                        onClick={() => handleLanguageChange("en")}
                        className={`flex w-full items-center justify-between px-4 py-2 text-left text-xs transition-colors hover:bg-gray-100 ${
                          selectedLanguage === "en" ? "bg-blue-50 text-blue-700" : ""
                        }`}
                      >
                        <span>English</span>
                        {selectedLanguage === "en" && (
                          <svg
                            className="h-4 w-4 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleLanguageChange("zh")}
                        className={`flex w-full items-center justify-between px-4 py-2 text-left text-xs transition-colors hover:bg-gray-100 ${
                          selectedLanguage === "zh" ? "bg-blue-50 text-blue-700" : ""
                        }`}
                      >
                        <div>
                          <div>简体中文</div>
                          <div className="text-gray-400">Simplified Chinese</div>
                        </div>
                        {selectedLanguage === "zh" && (
                          <svg
                            className="h-4 w-4 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleLanguageChange("ja")}
                        className={`flex w-full items-center justify-between px-4 py-2 text-left text-xs transition-colors hover:bg-gray-100 ${
                          selectedLanguage === "ja" ? "bg-blue-50 text-blue-700" : ""
                        }`}
                      >
                        <div>
                          <div>日本語</div>
                          <div className="text-gray-400">Japanese</div>
                        </div>
                        {selectedLanguage === "ja" && (
                          <svg
                            className="h-4 w-4 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleLanguageChange("es")}
                        className={`flex w-full items-center justify-between px-4 py-2 text-left text-xs transition-colors hover:bg-gray-100 ${
                          selectedLanguage === "es" ? "bg-blue-50 text-blue-700" : ""
                        }`}
                      >
                        <div>
                          <div>Español</div>
                          <div className="text-gray-400">Spanish</div>
                        </div>
                        {selectedLanguage === "es" && (
                          <svg
                            className="h-4 w-4 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Translating indicator */}
                  {isTranslating && (
                    <div className="absolute -top-1 -right-1">
                      <svg
                        className="h-3 w-3 animate-spin text-blue-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    </div>
                  )}
                </div>

                {/* Language Selector - Only show when Transcript tab is active */}
                {activeTab === "transcript"}

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
                  onClick={() => setActiveTab("comments")}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === "comments"
                      ? "border-b-2 border-gray-900 text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Comments
                </button>
                <button
                  onClick={() => setActiveTab("notes")}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === "notes"
                      ? "border-b-2 border-gray-900 text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Notes
                </button>
              </div>

              {/* Tab Content */}
              <div ref={transcriptContainerRef} className="h-[500px] overflow-y-auto">
                {/* Transcript Tab */}
                {activeTab === "transcript" && (
                  <div className="space-y-3 p-4">
                    {transcriptData.length > 0 ? (
                      transcriptData.map((item, index) => {
                        const translatedItem = translatedData[index];
                        const hasTranslation =
                          selectedLanguage !== "en" && translatedItem?.translated;

                        return (
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
                            {/* 原文 */}
                            <div className="text-xs leading-relaxed text-gray-700">{item.text}</div>

                            {/* 译文（如果存在） */}
                            {hasTranslation && (
                              <div className="mt-1.5 border-t border-gray-200 pt-1.5 text-[11px] leading-relaxed text-gray-500">
                                {translatedItem.translated}
                              </div>
                            )}

                            {/* 翻译中提示 */}
                            {isTranslating &&
                              selectedLanguage !== "en" &&
                              !translatedItem?.translated && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                                  <svg
                                    className="h-3 w-3 animate-spin"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    ></circle>
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                  </svg>
                                  <span>Translating...</span>
                                </div>
                              )}
                          </div>
                        );
                      })
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

                {/* Comments Tab */}
                {activeTab === "comments" && (
                  <div className="p-4">
                    {/* 加载状态 */}
                    {commentsLoading && (
                      <div className="flex items-center justify-center py-8">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <svg
                            className="h-4 w-4 animate-spin"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          <span>Loading comments...</span>
                        </div>
                      </div>
                    )}

                    {/* 错误状态 */}
                    {!commentsLoading && commentsError && (
                      <div className="py-8 text-center text-xs">
                        <div className="mb-2 text-red-500">⚠️ {commentsError}</div>
                        <button
                          onClick={() => videoId && loadComments(videoId)}
                          className="text-blue-600 underline hover:text-blue-700"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {/* 评论列表 */}
                    {!commentsLoading && !commentsError && comments.length > 0 && (
                      <div className="space-y-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600">
                            {comments.length} Comments
                          </span>
                          <button
                            onClick={() => videoId && loadComments(videoId, 50)}
                            disabled={commentsLoading}
                            className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                          >
                            Load More
                          </button>
                        </div>

                        {comments.map((comment, index) => (
                          <div key={index} className="border-b border-gray-100 pb-3 last:border-0">
                            {/* 评论作者和时间 */}
                            <div className="mb-1.5 flex items-start gap-2">
                              {comment.avatar && (
                                <img
                                  src={comment.avatar}
                                  alt={comment.author || "User"}
                                  className="h-7 w-7 flex-shrink-0 rounded-full"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="mb-1 flex items-baseline gap-2">
                                  <span className="truncate text-xs font-medium text-gray-900">
                                    {comment.author || "Unknown User"}
                                  </span>
                                  <span className="flex-shrink-0 text-[10px] text-gray-500">
                                    {comment.published_at
                                      ? new Date(comment.published_at).toLocaleDateString()
                                      : ""}
                                  </span>
                                </div>

                                {/* 评论内容 */}
                                <p className="text-xs leading-relaxed whitespace-pre-wrap text-gray-700">
                                  {comment.text || ""}
                                </p>

                                {/* 点赞数 */}
                                {comment.like_count !== undefined && comment.like_count > 0 && (
                                  <div className="mt-1.5 flex items-center gap-1">
                                    <svg
                                      className="h-3 w-3 text-gray-400"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                                    </svg>
                                    <span className="text-[10px] text-gray-500">
                                      {comment.like_count}
                                    </span>
                                  </div>
                                )}

                                {/* 回复数 */}
                                {comment.reply_count !== undefined && comment.reply_count > 0 && (
                                  <div className="mt-1 text-[10px] text-blue-600">
                                    {comment.reply_count}{" "}
                                    {comment.reply_count === 1 ? "reply" : "replies"}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 无评论状态 */}
                    {!commentsLoading && !commentsError && comments.length === 0 && (
                      <div className="py-8 text-center text-xs text-gray-500">
                        No comments available for this video
                      </div>
                    )}
                  </div>
                )}

                {/* Notes Tab */}
                {activeTab === "notes" && (
                  <div className="p-4">
                    <textarea
                      placeholder="Take notes about the video..."
                      className="h-[350px] w-full resize-none rounded-lg border p-3 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
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
