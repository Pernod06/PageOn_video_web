import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button, Card, Input } from "@/components";
import PageonLogo from "@/assets/pageon-logo.svg";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
];

// 预设的示例演示 - 使用本地缓存数据
const EXAMPLE_PRESENTATIONS = [
  {
    videoId: "DxL2HoqLbyA",
    title: "The Most Misunderstood Concept in Physics",
    thumbnail: "https://img.youtube.com/vi/DxL2HoqLbyA/maxresdefault.jpg",
    duration: "14:30",
    isExample: true, // 标记为示例，使用本地缓存
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

const Home = () => {
  const [url, setUrl] = useState(() => {
    return sessionStorage.getItem("lastVideoUrl") || "";
  });
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [language, setLanguage] = useState("en");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get video URL from extension notification or direct link
  const videoParam = searchParams.get("video");
  const [youtubeUrl, setYoutubeUrl] = useState(() => {
    // Initialize from URL param if present
    return videoParam ? decodeURIComponent(videoParam) : "";
  });

  // Sync youtubeUrl when URL param changes (e.g., navigation from extension)
  useEffect(() => {
    if (videoParam) {
      const decodedUrl = decodeURIComponent(videoParam);
      console.log("[Home] Video URL from params:", decodedUrl);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setYoutubeUrl(decodedUrl);
    }
  }, [videoParam]);

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    if (newUrl) {
      sessionStorage.setItem("lastVideoUrl", newUrl);
    } else {
      sessionStorage.removeItem("lastVideoUrl");
    }
  };

  const runAnalysis = (
    inputUrl: string,
    _setLoading: (value: boolean) => void,
    shouldSyncUrl = false,
  ) => {
    setError("");

    const targetUrl = inputUrl.trim();
    if (shouldSyncUrl) {
      handleUrlChange(targetUrl);
    }

    if (!targetUrl) {
      setError("Please enter a URL");
      return;
    }

    // 简单的 URL 格式验证
    const urlPattern = /^(https?:\/\/)?[^\s]+\.[^\s]+/;
    if (!urlPattern.test(targetUrl)) {
      setError("Please enter a valid URL format");
      return;
    }

    // 直接跳转到 result 页面，使用流式分析
    console.log("[Frontend] Navigating to result page with streaming mode");
    navigate("/result", {
      state: {
        streamingUrl: targetUrl, // 标志需要流式分析的 URL
        language: language,
      },
    });
  };

  // Start Analysis - 使用 YouTube URL 输入框内容
  const handleAnalyze = () => {
    if (!youtubeUrl.trim()) return;
    return runAnalysis(youtubeUrl, setIsAnalyzing);
  };

  // Search - 使用主输入框内容
  const handleSearch = () => {
    return runAnalysis(url, setIsSearching);
  };

  // 主输入框回车触发搜索
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isAnalyzing && !isSearching) {
      handleSearch();
    }
  };

  const exampleUrls = [
    "https://www.youtube.com/watch?v=DxL2HoqLbyA",
    "https://www.youtube.com/watch?v=EWFFaKxsz_s",
    "https://www.youtube.com/watch?v=hKQtjY2koyk",
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
      <div className="w-full max-w-3xl space-y-8">
        {/* Logo and Title */}
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            {/* 替换原来的 logo 为 PageOn 品牌标志 */}
            <img src={PageonLogo} alt="PageOn Logo" className="h-14 w-auto" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">Video Analysis</h1>
          <p className="text-lg text-gray-500">Input video URL and start intelligent analysis</p>
        </div>

        {/* Main Input Card */}
        <Card className="border-2 border-gray-200 shadow-lg transition-all duration-200 hover:border-blue-400 hover:shadow-xl">
          <div className="space-y-6 p-8">
            {/* Input Area */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                {/* <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                <span>Video URL</span> */}
              </div>

              <div className="flex flex-wrap items-center gap-2 font-serif text-2xl tracking-tight text-gray-800 md:text-3xl">
                <span>What do you want to</span>
                <span className="text-blue-600"></span>
                <span className="font-semibold text-blue-600 italic">Read</span>
                <span className="text-blue-600"></span>
                <span>from YouTube today?</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Input
                    type="text"
                    placeholder="Describe what you want to know from these videos..."
                    value={url}
                    onChange={(e) => {
                      handleUrlChange(e.target.value);
                      setError("");
                    }}
                    onKeyPress={handleKeyPress}
                    className="h-14 w-full rounded-xl border-0 bg-gray-50 pr-12 pl-4 text-base focus:bg-white focus:ring-2 focus:ring-blue-500"
                    disabled={isAnalyzing || isSearching}
                  />
                  {url && !isAnalyzing && !isSearching && (
                    <button
                      onClick={() => handleUrlChange("")}
                      className="absolute top-1/2 right-4 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                      aria-label="Clear"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
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
                  onClick={handleSearch}
                  disabled={isSearching || isAnalyzing || !url.trim()}
                  className="h-14 flex-shrink-0 rounded-xl bg-blue-600 px-4 text-base font-medium text-white transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {isSearching ? "Searching..." : "Search"}
                </Button>
              </div>

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

            {/* Action Buttons */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-4">
              {/* YouTube URL Input */}
              <div className="mr-4 flex flex-1 items-center gap-2">
                <svg
                  className="h-5 w-5 flex-shrink-0 text-red-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                <Input
                  type="text"
                  placeholder="Paste YouTube URL here..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !isAnalyzing && youtubeUrl.trim()) {
                      handleAnalyze();
                    }
                  }}
                  className="h-10 flex-1 rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  disabled={isAnalyzing || isSearching}
                />
                {youtubeUrl && !isAnalyzing && (
                  <button
                    onClick={() => setYoutubeUrl("")}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="Clear URL"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

              <div className="flex items-center gap-3">
                {/* Language Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowLangMenu(!showLangMenu)}
                    className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 transition-all duration-200 hover:border-blue-400 hover:bg-gray-50"
                    disabled={isAnalyzing}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                      />
                    </svg>
                    <span>{LANGUAGES.find((l) => l.code === language)?.label}</span>
                    <svg
                      className={`h-3 w-3 transition-transform ${showLangMenu ? "rotate-180" : ""}`}
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
                  </button>

                  {showLangMenu && (
                    <div className="absolute right-0 z-10 mt-2 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setLanguage(lang.code);
                            setShowLangMenu(false);
                          }}
                          className={`flex w-full items-center px-4 py-2 text-left text-sm transition-colors hover:bg-blue-50 ${
                            language === lang.code
                              ? "bg-blue-50 font-medium text-blue-600"
                              : "text-gray-700"
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || isSearching || !youtubeUrl.trim()}
                  className="h-10 rounded-lg bg-blue-600 px-6 font-medium text-white transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {isAnalyzing ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
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
                      Analyzing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
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
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                      Start Analysis
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Example of Presentations */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Example of Presentations</h3>
            <span className="text-xs text-gray-400">Click to view demo</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {EXAMPLE_PRESENTATIONS.map((example) => (
              <button
                key={example.videoId}
                onClick={() => {
                  navigate("/result", {
                    state: {
                      videoId: example.videoId,
                      title: example.title,
                      isExample: true, // 使用本地缓存数据
                    },
                  });
                }}
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

        {/* Example URLs */}
        <div className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            Try like these examples
          </p>
          <div className="flex flex-wrap gap-2">
            {exampleUrls.map((exampleUrl, index) => (
              <button
                key={index}
                onClick={() => setYoutubeUrl(exampleUrl)}
                disabled={isAnalyzing}
                className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 font-mono text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exampleUrl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 text-center">
        <p className="text-xs text-gray-400">PageOn.ai © 2025 · Powered by AI</p>
      </footer>
    </div>
  );
};

export default Home;
