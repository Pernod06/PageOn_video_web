import { Button, Card, Input } from "@/components";

// API配置 - 直接使用公网后端
const API_BASE_URL = "http://52.72.117.236:5000";

const Home = () => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const navigate = useNavigate();

  const handleAnalyze = async () => {
    setError("");

    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    // 简单的 URL 格式验证
    const urlPattern = /^(https?:\/\/)?[^\s]+\.[^\s]+/;
    if (!urlPattern.test(url.trim())) {
      setError("Please enter a valid URL format");
      return;
    }

    setIsAnalyzing(true);

    try {
      const apiUrl = `${API_BASE_URL}/api/process-video`;
      console.log("[Frontend] Sending request to:", apiUrl);
      console.log("[Frontend] Request body:", { url: url.trim() });

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      console.log("[Frontend] Response status:", response.status);
      console.log("[Frontend] Response ok:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Frontend] Error response:", errorText);
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.detail || errorJson.message || "Failed to process video");
        } catch {
          throw new Error(`Server error: ${response.status}`);
        }
      }

      const data = await response.json();
      console.log("[Frontend] Success response:", data);

      if (data.success) {
        navigate("/result", {
          state: {
            videoId: data.videoId,
            title: data.title,
            url: url.trim(),
          },
        });
      } else {
        setError(data.message || data.error || "Analysis failed");
      }
    } catch (err) {
      console.error("[Frontend] Error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Analysis failed, please try again later";
      setError(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isAnalyzing) {
      handleAnalyze();
    }
  };

  const exampleUrls = [
    "https://www.youtube.com/watch?v=example",
    "https://vimeo.com/123456789",
    "https://www.bilibili.com/video/BV1xx411c7mD",
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
      <div className="w-full max-w-3xl space-y-8">
        {/* Logo and Title */}
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
              <svg
                className="h-8 w-8 text-white"
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
          </div>
          <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">
            PageOn.ai - Video Analysis
          </h1>
          <p className="text-lg text-gray-500">Input video URL and start intelligent analysis</p>
        </div>

        {/* Main Input Card */}
        <Card className="border-2 border-gray-200 shadow-lg transition-all duration-200 hover:border-blue-400 hover:shadow-xl">
          <div className="space-y-6 p-8">
            {/* Input Area */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                <span>Video URL</span>
              </div>

              <div className="relative">
                <Input
                  type="text"
                  placeholder="Paste video URL here or enter keywords to search..."
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError("");
                  }}
                  onKeyPress={handleKeyPress}
                  className="h-14 rounded-xl border-0 bg-gray-50 pr-12 pl-4 text-base focus:bg-white focus:ring-2 focus:ring-blue-500"
                  disabled={isAnalyzing}
                />
                {url && !isAnalyzing && (
                  <button
                    onClick={() => setUrl("")}
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
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                  <span>Auto</span>
                </button>
                <button className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <span>Explore</span>
                </button>
              </div>

              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !url.trim()}
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
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        </Card>

        {/* Quick Start Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Quick Start</h3>
            <button className="text-xs text-gray-400 hover:text-gray-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <QuickActionCard
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              }
              title="AI Video Summary"
              description="Auto generate video summaries"
              onClick={() => {}}
            />
            <QuickActionCard
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              }
              title="Analyze PDF"
              description="Extract content from PDF"
              onClick={() => {}}
            />
            <QuickActionCard
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              }
              title="Create Transcript"
              description="Generate video transcripts"
              onClick={() => {}}
            />
          </div>
        </div>

        {/* Example URLs */}
        <div className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            Try these examples
          </p>
          <div className="flex flex-wrap gap-2">
            {exampleUrls.map((exampleUrl, index) => (
              <button
                key={index}
                onClick={() => setUrl(exampleUrl)}
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

// Quick Action Card Component
interface QuickActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function QuickActionCard({ icon, title, description, onClick }: QuickActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="group rounded-xl border border-gray-200 bg-white p-4 text-left transition-all duration-200 hover:border-blue-300 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-gray-600 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="mb-1 text-sm font-medium text-gray-900">{title}</h4>
          <p className="text-xs leading-relaxed text-gray-500">{description}</p>
        </div>
      </div>
    </button>
  );
}
