// PageOn Extension Popup Script

const APP_URL = "http://52.72.117.236:3000/";

// DOM elements
const videoDetectedDiv = document.getElementById("video-detected");
const noVideoDiv = document.getElementById("no-video");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const videoTitle = document.getElementById("video-title");
const videoChannel = document.getElementById("video-channel");
const videoUrl = document.getElementById("video-url");
const analyzeBtn = document.getElementById("analyze-btn");
const openAppLink = document.getElementById("open-app");

let currentVideoInfo = null;

// Initialize popup
async function init() {
  // Try to get video info from current tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url && tab.url.includes("youtube.com/watch")) {
      // Send message to content script to get video status
      const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_VIDEO_STATUS" });

      if (response && response.videoInfo) {
        showVideoInfo(response.videoInfo);
        return;
      }
    }
  } catch (e) {
    console.log("[Popup] Could not get video info from tab:", e);
  }

  // Try to get last stored video info
  try {
    const stored = await chrome.storage.local.get("lastVideoInfo");
    if (stored.lastVideoInfo) {
      showVideoInfo(stored.lastVideoInfo);
      return;
    }
  } catch (e) {
    console.log("[Popup] Could not get stored video info:", e);
  }

  // No video found
  showNoVideo();
}

// Show video information
function showVideoInfo(info) {
  currentVideoInfo = info;

  videoDetectedDiv.style.display = "block";
  noVideoDiv.style.display = "none";

  // Update status
  if (info.isPlaying) {
    statusDot.className = "status-dot";
    statusText.textContent = "▶ Video Playing";
  } else {
    statusDot.className = "status-dot paused";
    statusText.textContent = "⏸ Video Paused";
  }

  // Update video info
  videoTitle.textContent = info.title || "Unknown Title";
  videoChannel.textContent = info.channel ? `📺 ${info.channel}` : "";
  videoUrl.textContent = info.url || "";

  // Enable analyze button
  analyzeBtn.disabled = false;
}

// Show no video state
function showNoVideo() {
  videoDetectedDiv.style.display = "none";
  noVideoDiv.style.display = "block";
  currentVideoInfo = null;
}

// Handle analyze button click
analyzeBtn.addEventListener("click", () => {
  if (currentVideoInfo && currentVideoInfo.url) {
    const videoUrlParam = encodeURIComponent(currentVideoInfo.url);
    const targetUrl = `${APP_URL}?video=${videoUrlParam}`;
    chrome.tabs.create({ url: targetUrl });
    window.close();
  }
});

// Handle open app link click
openAppLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: APP_URL });
  window.close();
});

// Listen for video status updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "YOUTUBE_VIDEO_STATUS" && message.data) {
    showVideoInfo(message.data);
  }
});

// Initialize on load
init();
