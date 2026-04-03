import { defineEventHandler, readBody, createError } from "h3";
import { getYouTubeSearchService } from "../../server/services/youtube-search.service";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as {
    search_query: string;
    gl?: string;
    hl?: string;
    duration?: string;
    limit?: number;
    has_cc?: boolean;
  };

  if (!body.search_query) {
    throw createError({ statusCode: 400, statusMessage: "search_query is required" });
  }

  try {
    const service = getYouTubeSearchService();
    const response = await service.searchYouTube({
      search_query: body.search_query,
      engine: "youtube",
      gl: body.gl,
      hl: body.hl,
      duration: body.duration,
      limit: body.limit,
      has_cc: body.has_cc,
    });

    // Transform to frontend-friendly format
    const results = response.video_results.map((video) => {
      const link = String(video.link ?? "");
      let videoId = "";
      if (link.includes("watch?v=")) {
        videoId = link.split("watch?v=")[1].split("&")[0];
      }

      let thumbnail = "";
      const thumbData = video.thumbnail;
      if (thumbData && typeof thumbData === "object") {
        const td = thumbData as Record<string, string>;
        thumbnail = td.static ?? td.rich ?? "";
      } else if (typeof thumbData === "string") {
        thumbnail = thumbData;
      }

      let channelName = "";
      let channelLink = "";
      const ch = video.channel;
      if (ch && typeof ch === "object") {
        const cd = ch as Record<string, string>;
        channelName = cd.name ?? "";
        channelLink = cd.link ?? "";
      } else if (typeof ch === "string") {
        channelName = ch;
      }

      return {
        position: video.position ?? null,
        title: String(video.title ?? ""),
        videoId,
        link,
        thumbnail,
        channel: channelName,
        channelLink,
        publishedDate: video.published_date ?? null,
        views: video.views ?? null,
        length: video.length ?? null,
        description: video.description ?? null,
      };
    });

    return {
      success: true,
      results,
      total: results.length,
      cached: false,
    };
  } catch (e: unknown) {
    console.error(`[ERROR] SerpAPI search failed: ${e}`);
    throw createError({
      statusCode: 500,
      statusMessage: `YouTube search failed: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
});
