import { defineEventHandler } from "h3";
import { getYouTubeSearchService } from "../../../server/services/youtube-search.service";

export default defineEventHandler(() => {
  const service = getYouTubeSearchService();
  service.clearCache();
  return { success: true, message: "Cache cleared" };
});
