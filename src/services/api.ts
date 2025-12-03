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
