import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button, Card, Input, UserMenu } from "@/components";
import PageonLogo from "@/assets/pageon-logo.svg";
import { searchYouTubeDataAPI, type YouTubeSearchResult } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

// 预设的示例演示 - 使用本地缓存数据
const EXAMPLE_PRESENTATIONS = [
  {
    videoId: "DxL2HoqLbyA",
    title: "The Most Misunderstood Concept in Physics",
    thumbnail: "https://img.youtube.com/vi/DxL2HoqLbyA/maxresdefault.jpg",
    duration: "14:30",
    isExample: true,
  },
  {
    videoId: "EWFFaKxsz_s",
    title: "How to Learn AI in 17 Minutes",
    thumbnail: "https://img.youtube.com/vi/EWFFaKxsz_s/maxresdefault.jpg",
    duration: "17:00",
    isExample: true,
  },
  {
    videoId: "hKQtjY2koyk",
    title: "外蒙古為何獨立？新疆、西藏為何不行？",
    thumbnail: "https://img.youtube.com/vi/hKQtjY2koyk/maxresdefault.jpg",
    duration: "26:15",
    isExample: true,
  },
];

/**
 * 从输入中提取 YouTube 视频 ID
 * 支持格式:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - 直接视频 ID (11个字符)
 */
const extractVideoId = (input: string): string | null => {
  const trimmed = input.trim();

  // 直接是视频 ID (11个字符，只包含字母数字、下划线、连字符)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = trimmed.match(
    /(?:youtube\.com\/watch\?.*v=|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  );
  if (watchMatch) return watchMatch[1];

  // youtu.be/VIDEO_ID
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // youtube.com/embed/VIDEO_ID
  const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  // youtube.com/v/VIDEO_ID
  const vMatch = trimmed.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/);
  if (vMatch) return vMatch[1];

  return null;
};

/**
 * 检测输入是否是 YouTube URL 或视频 ID
 */
const isYouTubeInput = (input: string): boolean => {
  return extractVideoId(input) !== null;
};

const Home = () => {
  const [input, setInput] = useState(() => {
    return sessionStorage.getItem("lastInput") || "";
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [pendingVideoUrl, setPendingVideoUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signInWithGoogle, signInWithGitHub } = useAuth();

  // 搜索的参数
  const [searchOptions, setSearchOptions] = useState({
    duration: "long" as "any" | "short" | "medium" | "long",
    order: "viewCount" as "relevance" | "date" | "viewCount" | "rating",
    time_filter: "" as "" | "hour" | "today" | "week" | "month" | "year",
    limit: 10,
  });
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Get video URL from extension notification or direct link
  const videoParam = searchParams.get("video");

  // Sync input when URL param changes (e.g., navigation from extension)
  useEffect(() => {
    if (videoParam) {
      const decodedUrl = decodeURIComponent(videoParam);
      console.log("[Home] Video URL from params:", decodedUrl);
      setInput(decodedUrl);
      // 自动触发分析
      handleSubmit(decodedUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoParam]);

  const handleInputChange = (newInput: string) => {
    setInput(newInput);
    if (newInput) {
      sessionStorage.setItem("lastInput", newInput);
    } else {
      sessionStorage.removeItem("lastInput");
    }
  };

  /**
   * 跳转到分析页面（需要登录）
   */
  const navigateToAnalysis = (videoUrl: string) => {
    if (!user) {
      // 未登录，显示登录提示
      setPendingVideoUrl(videoUrl);
      setShowLoginPrompt(true);
      return;
    }

    // 已登录，直接跳转
    navigate("/result", {
      state: {
        streamingUrl: videoUrl,
        language: "en",
      },
    });
  };

  /**
   * 智能提交处理：
   * - 如果是 YouTube URL/视频ID -> 直接分析（需登录）
   * - 否则 -> 搜索视频（无需登录）
   */
  const handleSubmit = async (inputValue?: string) => {
    const value = (inputValue ?? input).trim();

    if (!value) {
      setError("Please enter a YouTube URL or search keywords");
      return;
    }

    setError("");

    // 检测是否是 YouTube URL 或视频 ID
    const videoId = extractVideoId(value);

    if (videoId) {
      // 是 YouTube 链接，检查登录后分析
      console.log("[Smart Input] Detected YouTube video ID:", videoId);
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      navigateToAnalysis(videoUrl);
    } else {
      // 不是 YouTube 链接，执行搜索
      console.log("[Smart Input] Searching for:", value);
      setIsLoading(true);
      setHasSearched(true);

      try {
        const response = await searchYouTubeDataAPI(value, {
          limit: searchOptions.limit,
          order: searchOptions.order,
          duration: searchOptions.duration,
          time_filter: searchOptions.time_filter || undefined,
        });

        if (response.success && response.results.length > 0) {
          console.log("[Search] Found", response.results.length, "videos");
          setSearchResults(response.results);
        } else {
          setError(response.error || "No videos found. Try different keywords.");
          setSearchResults([]);
        }
      } catch (err) {
        console.error("[Search] Error:", err);
        setError("Search failed. Please try again.");
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 选择视频进行分析（需要登录）
  const handleSelectVideo = (video: YouTubeSearchResult) => {
    const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
    console.log("[Select] User selected video:", video.title);
    navigateToAnalysis(videoUrl);
  };

  // 选择示例视频（无需登录）
  const handleSelectExample = (example: (typeof EXAMPLE_PRESENTATIONS)[0]) => {
    // 示例视频无需登录，直接跳转
    navigate("/result", {
      state: {
        videoId: example.videoId,
        title: example.title,
        isExample: true,
      },
    });
  };

  // 登录后继续分析
  useEffect(() => {
    if (user && pendingVideoUrl) {
      // 用户登录成功，继续之前的分析
      setShowLoginPrompt(false);
      navigate("/result", {
        state: {
          streamingUrl: pendingVideoUrl,
          language: "en",
        },
      });
      setPendingVideoUrl(null);
    }
  }, [user, pendingVideoUrl, navigate]);

  // 回车触发提交
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleSubmit();
    }
  };

  // 格式化观看次数
  const formatViews = (views?: number) => {
    if (!views) return "";
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
    return `${views} views`;
  };

  // 检测当前输入是 URL 还是搜索关键词
  const isUrl = isYouTubeInput(input);
  const buttonText = isUrl ? "Analyze" : "Search";
  const buttonIcon = isUrl ? (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7l5 5m0 0l-5 5m5-5H6"
      />
    </svg>
  ) : (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-slate-50 to-white p-6">
      {/* Top Navigation Bar */}
      <div className="fixed top-0 right-0 left-0 z-40 flex items-center justify-between bg-white/80 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <img src={PageonLogo} alt="PageOn Logo" className="h-8 w-auto" />
        </div>
        <UserMenu />
      </div>

      <div className="w-full max-w-4xl space-y-8 pt-20">
        {/* Logo and Title */}
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <img src={PageonLogo} alt="PageOn Logo" className="h-14 w-auto" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">Video Analysis</h1>
          <p className="text-lg text-gray-500">Paste a YouTube URL or search for videos</p>
        </div>

        {/* Main Input Card */}
        <Card className="border-2 border-gray-200 shadow-lg transition-all duration-200 hover:border-blue-400 hover:shadow-xl">
          <div className="space-y-5 p-8">
            {/* Title */}
            <div className="flex flex-wrap items-center gap-2 font-serif text-2xl tracking-tight text-gray-800 md:text-3xl">
              <span>What do you want to</span>
              <span className="font-semibold text-blue-600 italic">Read</span>
              <span>from YouTube today?</span>
            </div>

            {/* Smart Input */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                {/* YouTube icon indicator when URL detected */}
                {isUrl && (
                  <div className="absolute top-1/2 left-4 -translate-y-1/2">
                    <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </div>
                )}
                <Input
                  type="text"
                  placeholder="Paste YouTube URL or search for videos..."
                  value={input}
                  onChange={(e) => {
                    handleInputChange(e.target.value);
                    setError("");
                  }}
                  onKeyPress={handleKeyPress}
                  className={`h-14 w-full rounded-xl border-0 bg-gray-50 pr-12 text-base focus:bg-white focus:ring-2 focus:ring-blue-500 ${
                    isUrl ? "pl-12" : "pl-4"
                  }`}
                  disabled={isLoading}
                />
                {input && !isLoading && (
                  <button
                    onClick={() => {
                      handleInputChange("");
                      setSearchResults([]);
                      setHasSearched(false);
                    }}
                    className="absolute top-1/2 right-4 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                    aria-label="Clear"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
              <Button
                onClick={() => handleSubmit()}
                disabled={isLoading || !input.trim()}
                className="h-14 flex-shrink-0 rounded-xl bg-blue-600 px-6 text-base font-medium text-white transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {isUrl ? "Analyzing..." : "Searching..."}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {buttonIcon}
                    {buttonText}
                  </span>
                )}
              </Button>
            </div>

            {/* 高级搜索选项 */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-blue-600"
              >
                <svg
                  className={`h-4 w-4 transition-transform ${showAdvancedOptions ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                Advanced Search Options
              </button>

              {showAdvancedOptions && (
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 md:grid-cols-4">
                  {/* Duration */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Duration</label>
                    <select
                      value={searchOptions.duration}
                      onChange={(e) =>
                        setSearchOptions((prev) => ({
                          ...prev,
                          duration: e.target.value as typeof prev.duration,
                        }))
                      }
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="any">Any</option>
                      <option value="short">&lt; 20 min</option>
                      <option value="medium">20 min - 1 hour</option>
                      <option value="long">&gt; 1 hour</option>
                    </select>
                  </div>

                  {/* Order */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Sort by</label>
                    <select
                      value={searchOptions.order}
                      onChange={(e) =>
                        setSearchOptions((prev) => ({
                          ...prev,
                          order: e.target.value as typeof prev.order,
                        }))
                      }
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="date">Upload Date</option>
                      <option value="viewCount">View Count</option>
                      <option value="rating">Rating</option>
                    </select>
                  </div>

                  {/* Time Filter */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Upload Date</label>
                    <select
                      value={searchOptions.time_filter}
                      onChange={(e) =>
                        setSearchOptions((prev) => ({
                          ...prev,
                          time_filter: e.target.value as typeof prev.time_filter,
                        }))
                      }
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Any time</option>
                      <option value="hour">Last hour</option>
                      <option value="today">Today</option>
                      <option value="week">This week</option>
                      <option value="month">This month</option>
                      <option value="year">This year</option>
                    </select>
                  </div>

                  {/* Limit */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Results</label>
                    <select
                      value={searchOptions.limit}
                      onChange={(e) =>
                        setSearchOptions((prev) => ({ ...prev, limit: parseInt(e.target.value) }))
                      }
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Smart tip - changes based on input type */}
            <p className="text-xs text-gray-400">
              {isUrl ? (
                <>🎬 YouTube URL detected - click Analyze to start</>
              ) : input.trim() ? (
                <>
                  🔍 Searching{" "}
                  {searchOptions.duration === "long"
                    ? ">1 hour"
                    : searchOptions.duration === "medium"
                      ? "20 min - 1 hour"
                      : searchOptions.duration === "short"
                        ? "<20 min"
                        : ""}{" "}
                  videos, sorted by{" "}
                  {searchOptions.order === "viewCount"
                    ? "popularity"
                    : searchOptions.order === "date"
                      ? "upload date"
                      : searchOptions.order === "rating"
                        ? "rating"
                        : "relevance"}
                </>
              ) : (
                <>💡 Paste a YouTube URL to analyze, or type keywords to search</>
              )}
            </p>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </div>
            )}
          </div>
        </Card>

        {/* Search Results */}
        {hasSearched && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {searchResults.length > 0
                  ? `Found ${searchResults.length} videos`
                  : "No results found"}
              </h3>
              {searchResults.length > 0 && (
                <span className="text-sm text-gray-500">Click to analyze</span>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {searchResults.map((video, index) => (
                  <button
                    key={video.videoId || index}
                    onClick={() => handleSelectVideo(video)}
                    className="group flex gap-4 overflow-hidden rounded-xl border border-gray-200 bg-white p-3 text-left transition-all duration-200 hover:border-blue-400 hover:shadow-lg"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-24 w-40 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      <img
                        src={
                          video.thumbnail ||
                          `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`
                        }
                        alt={video.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`;
                        }}
                      />
                      {/* Duration Badge */}
                      {video.length && (
                        <div className="absolute right-1 bottom-1 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
                          {video.length}
                        </div>
                      )}
                      {/* Play Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-lg transition-all group-hover:opacity-100">
                          <svg
                            className="h-4 w-4 text-gray-900"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Video Info */}
                    <div className="flex flex-1 flex-col justify-between py-1">
                      <div>
                        <h4 className="line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-blue-600">
                          {video.title}
                        </h4>
                        {video.channel && (
                          <p className="mt-1 text-xs text-gray-500">{video.channel}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {video.views && <span>{formatViews(video.views)}</span>}
                        {video.views && video.publishedDate && <span>•</span>}
                        {video.publishedDate && <span>{video.publishedDate}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Example Presentations - Show when no search results */}
        {!hasSearched && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">Example Presentations</h3>
              <span className="text-xs text-gray-400">Click to view demo</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {EXAMPLE_PRESENTATIONS.map((example) => (
                <button
                  key={example.videoId}
                  onClick={() => handleSelectExample(example)}
                  className="group overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition-all duration-200 hover:border-blue-400 hover:shadow-lg"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-100">
                    <img
                      src={example.thumbnail}
                      alt={example.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {/* Duration Badge */}
                    <div className="absolute right-2 bottom-2 rounded bg-black/80 px-2 py-0.5 text-xs font-medium text-white">
                      {example.duration}
                    </div>
                    {/* Play Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-lg transition-all group-hover:opacity-100">
                        <svg
                          className="h-5 w-5 text-gray-900"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <h4 className="mb-1 line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-blue-600">
                      {example.title}
                    </h4>
                    <p className="text-xs text-gray-500">Click to view presentation</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Examples */}
        <div className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            Try these examples
          </p>
          <div className="flex flex-wrap gap-2">
            {/* Example URLs */}
            <button
              onClick={() => handleInputChange("Physics Video")}
              disabled={isLoading}
              className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              📹 Physics Video
            </button>
            <button
              onClick={() => handleInputChange("AI Tutorial")}
              disabled={isLoading}
              className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              📹 AI Tutorial
            </button>
            {/* Example Searches */}
            <button
              onClick={() => handleInputChange("machine learning tutorial")}
              disabled={isLoading}
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              🔍 machine learning
            </button>
            <button
              onClick={() => handleInputChange("history documentary")}
              disabled={isLoading}
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              🔍 history documentary
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center">
        <p className="text-xs text-gray-400">PageOn.ai © 2025 · Powered by AI</p>
      </footer>

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <div className="space-y-6">
              {/* Close button */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowLoginPrompt(false);
                    setPendingVideoUrl(null);
                  }}
                  className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Icon */}
              <div className="flex justify-center">
                <div className="rounded-full bg-blue-100 p-4">
                  <svg
                    className="h-12 w-12 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </div>
              </div>

              {/* Title and description */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900">Sign in to continue</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Please sign in to analyze YouTube videos. It's free and takes just a second!
                </p>
              </div>

              {/* Sign in buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => signInWithGoogle()}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 transition-all hover:bg-gray-50 hover:shadow-md"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <button
                  onClick={() => signInWithGitHub()}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-gray-900 px-4 py-3 font-medium text-white transition-all hover:bg-gray-800 hover:shadow-md"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span>Continue with GitHub</span>
                </button>
              </div>

              {/* Terms */}
              <p className="text-center text-xs text-gray-400">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
