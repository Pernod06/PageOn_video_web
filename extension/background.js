// PageOn Extension Background Service Worker
// Handles YouTube video detection and badge updates

const APP_URL = "http://52.72.117.236:3000/";

// Store current video info
let currentVideoInfo = null;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "YOUTUBE_VIDEO_STATUS") {
    currentVideoInfo = message.data;

    console.log("[PageOn Background] Video status:", message.status, message.data);

    // Update badge to show video is detected
    if (message.status === "playing") {
      chrome.action.setBadgeText({ text: "▶" });
      chrome.action.setBadgeBackgroundColor({ color: "#22c55e" }); // Green for playing
    } else if (message.status === "paused") {
      chrome.action.setBadgeText({ text: "⏸" });
      chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" }); // Orange for paused
    } else if (message.status === "ended") {
      chrome.action.setBadgeText({ text: "⏹" });
      chrome.action.setBadgeBackgroundColor({ color: "#666666" });
    } else if (message.status === "video_changed") {
      chrome.action.setBadgeText({ text: "🎬" });
      chrome.action.setBadgeBackgroundColor({ color: "#3b82f6" }); // Blue for new video
    }

    // Store video info for popup to access
    if (message.data) {
      chrome.storage.local.set({ lastVideoInfo: message.data });
    }
  }

  return true;
});

// Clear badge when tab is updated to non-YouTube page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    if (!tab.url.includes("youtube.com/watch")) {
      chrome.action.setBadgeText({ text: "" });
    }
  }
});

// Clear badge when YouTube tab is closed
chrome.tabs.onRemoved.addListener(() => {
  // Check if any remaining tabs have YouTube videos
  chrome.tabs.query({ url: "*://*.youtube.com/watch*" }, (tabs) => {
    if (tabs.length === 0) {
      chrome.action.setBadgeText({ text: "" });
      chrome.storage.local.remove("lastVideoInfo");
    }
  });
});
