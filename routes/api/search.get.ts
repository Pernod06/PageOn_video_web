import { defineEventHandler, getQuery, createError } from "h3";
import { searchVideos } from "../../server/services/youtube-client.service";

export default defineEventHandler(async (event) => {
  const q = getQuery(event) as {
    query?: string;
    limit?: string;
    order?: string;
    duration?: string;
    time_filter?: string;
  };

  if (!q.query) {
    throw createError({ statusCode: 400, statusMessage: "query parameter is required" });
  }

  try {
    const results = await searchVideos(q.query, {
      maxResults: Number(q.limit) || 10,
      order: q.order ?? "viewCount",
      duration: q.duration ?? "long",
      publishedAfter: q.time_filter ?? undefined,
    });

    return { results, total: results.length };
  } catch (e: unknown) {
    console.error(`[ERROR] Search failed: ${e}`);
    throw createError({ statusCode: 500, statusMessage: String(e) });
  }
});
