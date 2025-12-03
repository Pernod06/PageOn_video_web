// URL 解析工具函数

export interface URLInfo {
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
  isValid: boolean;
  error?: string;
}

export function parseURL(urlString: string): URLInfo {
  const result: URLInfo = {
    original: urlString,
    protocol: "",
    hostname: "",
    pathname: "",
    search: "",
    hash: "",
    port: "",
    domain: "",
    subdomain: "",
    params: {},
    isValid: false,
  };

  try {
    // 如果没有协议，添加 http://
    const urlToParse = urlString.match(/^https?:\/\//) ? urlString : `http://${urlString}`;

    const url = new URL(urlToParse);

    result.protocol = url.protocol.replace(":", "");
    result.hostname = url.hostname;
    result.pathname = url.pathname;
    result.search = url.search;
    result.hash = url.hash.replace("#", "");
    result.port = url.port;
    result.isValid = true;

    // 解析域名和子域名
    const hostParts = url.hostname.split(".");
    if (hostParts.length >= 2) {
      result.domain = hostParts.slice(-2).join(".");
      if (hostParts.length > 2) {
        result.subdomain = hostParts.slice(0, -2).join(".");
      }
    }

    // 解析查询参数
    url.searchParams.forEach((value, key) => {
      result.params[key] = value;
    });
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Invalid URL";
  }

  return result;
}

export function isValidURL(urlString: string): boolean {
  try {
    const urlToParse = urlString.match(/^https?:\/\//) ? urlString : `http://${urlString}`;
    new URL(urlToParse);
    return true;
  } catch {
    return false;
  }
}
