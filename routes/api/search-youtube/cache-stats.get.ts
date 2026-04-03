import { defineEventHandler } from "h3";
import { getYouTubeSearchService } from "../../../server/services/youtube-search.service";

export default defineEventHandler(() => {
  const service = getYouTubeSearchService();
  return { success: true, stats: service.getCacheStats() };
});
