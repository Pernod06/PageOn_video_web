/**
 * YouTube Search Service — SerpAPI with TTL cache
 * Migrated from youtube_search_service.py
 */
import { createHash } from "crypto";
import { envString } from "../utils/env";
import { parseTimestampToSeconds } from "../utils/timestamp";

// Duration filter ranges (seconds)
const DURATION_RANGES: Record<string, [number, number]> = {
  short: [0, 1200],         // < 20 min
  medium: [1200, 3600],     // 20 min - 1 hour
  long: [3600, Infinity],   // > 1 hour
};

// YouTube sp filter for CC subtitles
const SP_CC = "EgIoAQ%3D%3D";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface SearchYouTubeParams {
  search_query: string;
  engine?: string;
  gl?: string;
  hl?: string;
  sp?: string;
  duration?: string;
  limit?: number;
  has_cc?: boolean;
}

export interface YouTubeSearchResponse {
  video_results: Record<string, unknown>[];
  search_metadata?: Record<string, unknown>;
  search_parameters?: Record<string, unknown>;
}

function hashObject(obj: Record<string, unknown>): string {
  const sorted = JSON.stringify(obj, Object.keys(obj).sort());
  return createHash("sha256").update(sorted).digest("hex");
}

class YouTubeSearchService {
  private cache = new Map<string, CacheEntry<YouTubeSearchResponse>>();
  private readonly maxSize = 100;
  private readonly ttlMs = 600_000; // 10 minutes

  get serpApiKey(): string {
    return envString("SERP_API_KEY");
  }

  async searchYouTube(params: SearchYouTubeParams): Promise<YouTubeSearchResponse> {
    const durationFilter = params.duration;
    const limit = params.limit ?? 50;

    // Build cache key from all params
    const paramsForKey: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) paramsForKey[k] = v;
    }
    const cacheKey = hashObject(paramsForKey);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[YouTube Search] Cache hit: ${params.search_query.slice(0, 30)}...`);
      return cached.data;
    }

    if (!this.serpApiKey) {
      throw new Error("SERP_API_KEY not configured");
    }

    // Build SerpAPI query params (exclude custom filter params)
    const serpParams = new URLSearchParams();
    serpParams.set("api_key", this.serpApiKey);
    serpParams.set("engine", params.engine ?? "youtube");
    serpParams.set("search_query", params.search_query);
    if (params.gl) serpParams.set("gl", params.gl);
    if (params.hl) serpParams.set("hl", params.hl);

    // Always filter for CC subtitles
    serpParams.set("sp", params.sp ?? SP_CC);

    const url = `https://serpapi.com/search?${serpParams.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SerpAPI HTTP ${res.status}: ${text}`);
    }
    const data = (await res.json()) as Record<string, unknown>;

    let videoResults = (data.video_results ?? []) as Record<string, unknown>[];

    // Duration filter
    if (durationFilter && durationFilter !== "any" && DURATION_RANGES[durationFilter]) {
      const [minSec, maxSec] = DURATION_RANGES[durationFilter];
      videoResults = videoResults.filter((v) => {
        const seconds = parseTimestampToSeconds(String(v.length ?? ""));
        return seconds >= minSec && seconds < maxSec;
      });
    }

    // Limit
    if (videoResults.length > limit) {
      videoResults = videoResults.slice(0, limit);
    }

    const result: YouTubeSearchResponse = {
      video_results: videoResults,
      search_metadata: data.search_metadata as Record<string, unknown>,
      search_parameters: data.search_parameters as Record<string, unknown>,
    };

    // Cache non-empty results
    if (result.video_results.length > 0) {
      if (this.cache.size >= this.maxSize) {
        // Evict oldest entry
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) this.cache.delete(oldestKey);
      }
      this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + this.ttlMs });
    }

    return result;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; maxsize: number; ttl: number } {
    // Prune expired entries
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
    return { size: this.cache.size, maxsize: this.maxSize, ttl: this.ttlMs / 1000 };
  }
}

// Singleton
let _instance: YouTubeSearchService | null = null;

export function getYouTubeSearchService(): YouTubeSearchService {
  if (!_instance) _instance = new YouTubeSearchService();
  return _instance;
}
