// API 服务层 - 用于调用后端接口

export interface URLAnalysisRequest {
  url: string;
}

export interface URLAnalysisResponse {
  success: boolean;
  data?: {
    original: string;
    protocol: string;
    hostname: string;
    pathname: string;
    search: string;
    hash: string;
    port: string;
    domain: string;
    subdomain: string;
    params: Record<string, string>;
  };
  error?: string;
}

// ==================== YouTube Search (SerpAPI) ====================

export interface YouTubeSearchResult {
  position?: number;
  title: string;
  videoId: string;
  link: string;
  thumbnail?: string;
  channel?: string;
  channelLink?: string;
  publishedDate?: string;
  views?: number;
  length?: string;
  description?: string;
}

export interface YouTubeSearchResponse {
  success: boolean;
  results: YouTubeSearchResult[];
  total: number;
  cached?: boolean;
  error?: string;
}

export interface YouTubeSearchParams {
  search_query: string;
  gl?: string; // 国家/地区代码 (如 "us", "cn")
  hl?: string; // 语言代码 (如 "en", "zh-CN")
}

/**
 * 使用 SerpAPI 搜索 YouTube 视频
 * @param query 搜索关键词
 * @param options 可选参数 (gl, hl)
 * @returns 搜索结果
 */
export async function searchYouTubeVideos(
  query: string,
  options?: { gl?: string; hl?: string },
): Promise<YouTubeSearchResponse> {
  try {
    const response = await fetch("/api/search-youtube", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        search_query: query,
        gl: options?.gl || "us",
        hl: options?.hl || "en",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail?.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("YouTube 搜索失败:", error);
    return {
      success: false,
      results: [],
      total: 0,
      error: error instanceof Error ? error.message : "搜索失败",
    };
  }
}

/**
 * 使用 SerpAPI 搜索 YouTube 视频（支持自定义时长过滤）
 * @param query 搜索关键词
 * @param options 搜索选项
 * @returns 搜索结果
 */
export async function searchYouTubeDataAPI(
  query: string,
  options?: {
    limit?: number;
    order?: string;
    duration?: string; // any, short(<20min), medium(20min-1hour), long(>1hour)
    time_filter?: string;
  },
): Promise<YouTubeSearchResponse> {
  try {
    const response = await fetch("/api/search-youtube", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        search_query: query,
        gl: "us",
        hl: "en",
        duration: options?.duration || "long",
        limit: options?.limit || 10,
        has_cc: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail?.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // 转换为统一格式（SerpAPI 返回的格式）
    return {
      success: data.success,
      results: data.results.map(
        (r: {
          videoId: string;
          title: string;
          thumbnail: string;
          link: string;
          length?: string;
          channel?: string;
          views?: number;
          publishedDate?: string;
        }) => ({
          videoId: r.videoId,
          title: r.title,
          thumbnail: r.thumbnail,
          link: r.link,
          length: r.length || "",
          channel: r.channel || "",
          views: r.views || 0,
          publishedDate: r.publishedDate || "",
        }),
      ),
      total: data.total,
    };
  } catch (error) {
    console.error("YouTube Data API 搜索失败:", error);
    return {
      success: false,
      results: [],
      total: 0,
      error: error instanceof Error ? error.message : "搜索失败",
    };
  }
}

/**
 * 调用后端 API 解析 URL
 * @param url 要解析的 URL
 * @returns 解析结果
 */
export async function analyzeURL(url: string): Promise<URLAnalysisResponse> {
  try {
    // TODO: 替换为实际的后端 API 地址
    const response = await fetch("/api/parse-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("URL 分析失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 检查 API 服务是否可用
 */
export async function checkAPIHealth(): Promise<boolean> {
  try {
    // TODO: 替换为实际的健康检查端点
    const response = await fetch("/api/health");
    return response.ok;
  } catch {
    return false;
  }
}
