import { defineEventHandler } from "h3";

export default defineEventHandler(() => {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  };
});
