// PageOn Content Script - YouTube Video Detection
// Detects when a YouTube video is being played and shows notification banner

(function () {
  "use strict";

  const APP_URL = "http://52.72.117.236:3000/";

  let currentVideoId = null;
  let isPlaying = false;
  let videoElement = null;
  let notificationBanner = null;
  let hasShownNotification = false;

  // Extract video ID from URL
  function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("v");
  }

  // Get video information
  function getVideoInfo() {
    const videoId = getVideoId();
    if (!videoId) return null;

    const titleElement = document.querySelector(
      "h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata yt-formatted-string",
    );
    const channelElement = document.querySelector("#channel-name a, ytd-channel-name a");

    return {
      videoId: videoId,
      url: window.location.href,
      title: titleElement?.textContent?.trim() || "Unknown Title",
      channel: channelElement?.textContent?.trim() || "Unknown Channel",
      isPlaying: isPlaying,
      timestamp: Date.now(),
    };
  }

  // Create notification banner styles - Compact version
  function createStyles() {
    if (document.getElementById("pageon-styles")) return;

    const style = document.createElement("style");
    style.id = "pageon-styles";
    style.textContent = `
      @keyframes pageon-slide-in {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      @keyframes pageon-slide-out {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(-20px); opacity: 0; }
      }
      
      @keyframes pageon-dot-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      .pageon-banner {
        position: fixed;
        top: 12px;
        right: 12px;
        width: 260px;
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: pageon-slide-in 0.3s ease-out;
      }
      
      .pageon-banner.hiding {
        animation: pageon-slide-out 0.2s ease-in forwards;
      }
      
      .pageon-banner-content {
        padding: 12px;
      }
      
      .pageon-banner-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      
      .pageon-banner-logo {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .pageon-banner-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #22c55e;
        animation: pageon-dot-pulse 1.5s infinite;
      }
      
      .pageon-banner-name {
        font-size: 12px;
        font-weight: 600;
        color: #3b82f6;
      }
      
      .pageon-banner-close {
        background: transparent;
        border: none;
        color: #64748b;
        width: 20px;
        height: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s;
      }
      
      .pageon-banner-close:hover {
        color: #f1f5f9;
        background: rgba(255, 255, 255, 0.1);
      }
      
      .pageon-banner-title {
        font-size: 13px;
        font-weight: 500;
        color: #e2e8f0;
        line-height: 1.3;
        margin-bottom: 10px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      
      .pageon-banner-btn {
        width: 100%;
        padding: 8px 12px;
        background: #3b82f6;
        border: none;
        border-radius: 8px;
        color: white;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      
      .pageon-banner-btn:hover {
        background: #2563eb;
        transform: translateY(-1px);
      }
    `;
    document.head.appendChild(style);
  }

  // Create and show notification banner
  function showNotificationBanner(videoInfo) {
    // Don't show if already shown for this video
    if (hasShownNotification) return;
    hasShownNotification = true;

    // Remove existing banner if any
    hideNotificationBanner();

    // Create styles
    createStyles();

    // Create banner element - Compact version
    notificationBanner = document.createElement("div");
    notificationBanner.className = "pageon-banner";
    notificationBanner.innerHTML = `
      <div class="pageon-banner-content">
        <div class="pageon-banner-header">
          <div class="pageon-banner-logo">
            <div class="pageon-banner-dot"></div>
            <span class="pageon-banner-name">PageOn</span>
          </div>
          <button class="pageon-banner-close" id="pageon-close">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="pageon-banner-title">${escapeHtml(videoInfo.title)}</div>
        <button class="pageon-banner-btn" id="pageon-analyze">
          <span>🚀 Analyze Video</span>
        </button>
      </div>
    `;

    document.body.appendChild(notificationBanner);

    // Add event listeners
    document.getElementById("pageon-close").addEventListener("click", () => {
      sessionStorage.setItem("pageon-dismissed", "true");
      hideNotificationBanner();
    });
    document.getElementById("pageon-analyze").addEventListener("click", () => {
      const videoUrl = encodeURIComponent(videoInfo.url);
      window.open(`${APP_URL}?video=${videoUrl}`, "_blank");
      hideNotificationBanner();
    });

    // Auto-hide after 8 seconds
    setTimeout(() => {
      if (notificationBanner && notificationBanner.parentNode) {
        hideNotificationBanner();
      }
    }, 8000);
  }

  // Hide notification banner
  function hideNotificationBanner() {
    if (notificationBanner && notificationBanner.parentNode) {
      notificationBanner.classList.add("hiding");
      setTimeout(() => {
        if (notificationBanner && notificationBanner.parentNode) {
          notificationBanner.parentNode.removeChild(notificationBanner);
          notificationBanner = null;
        }
      }, 200);
    }
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Send video status to background script
  function sendVideoStatus(status, videoInfo) {
    chrome.runtime
      .sendMessage({
        type: "YOUTUBE_VIDEO_STATUS",
        status: status,
        data: videoInfo,
      })
      .catch(() => {
        // Extension context may be invalidated, ignore
      });
  }

  // Monitor video element
  function setupVideoMonitor() {
    videoElement = document.querySelector("video.html5-main-video, video");

    if (!videoElement) {
      // Retry after a short delay
      setTimeout(setupVideoMonitor, 1000);
      return;
    }

    // Video play event
    videoElement.addEventListener("play", () => {
      isPlaying = true;
      const info = getVideoInfo();
      if (info) {
        console.log("[PageOn] Video started playing:", info.title);
        sendVideoStatus("playing", info);

        // Show notification if not dismissed
        if (!sessionStorage.getItem("pageon-dismissed")) {
          // Small delay to ensure video info is loaded
          setTimeout(() => {
            const updatedInfo = getVideoInfo();
            if (updatedInfo) {
              showNotificationBanner(updatedInfo);
            }
          }, 1500);
        }
      }
    });

    // Video pause event
    videoElement.addEventListener("pause", () => {
      isPlaying = false;
      const info = getVideoInfo();
      if (info) {
        console.log("[PageOn] Video paused:", info.title);
        sendVideoStatus("paused", info);
      }
    });

    // Video ended event
    videoElement.addEventListener("ended", () => {
      isPlaying = false;
      const info = getVideoInfo();
      if (info) {
        console.log("[PageOn] Video ended:", info.title);
        sendVideoStatus("ended", info);
      }
      hideNotificationBanner();
    });

    // Check if video is already playing
    if (!videoElement.paused) {
      isPlaying = true;
      const info = getVideoInfo();
      if (info) {
        console.log("[PageOn] Video already playing:", info.title);
        sendVideoStatus("playing", info);

        // Show notification if not dismissed
        if (!sessionStorage.getItem("pageon-dismissed")) {
          setTimeout(() => {
            const updatedInfo = getVideoInfo();
            if (updatedInfo) {
              showNotificationBanner(updatedInfo);
            }
          }, 1500);
        }
      }
    }
  }

  // Detect video ID changes (YouTube SPA navigation)
  function setupNavigationMonitor() {
    let lastVideoId = getVideoId();

    // Check for URL changes periodically
    setInterval(() => {
      const newVideoId = getVideoId();
      if (newVideoId && newVideoId !== lastVideoId) {
        lastVideoId = newVideoId;
        currentVideoId = newVideoId;
        hasShownNotification = false; // Reset notification for new video
        console.log("[PageOn] New video detected:", newVideoId);

        // Hide current banner
        hideNotificationBanner();

        // Reset and setup monitor for new video
        setTimeout(setupVideoMonitor, 500);

        const info = getVideoInfo();
        if (info) {
          sendVideoStatus("video_changed", info);
        }
      }
    }, 1000);
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_VIDEO_STATUS") {
      const info = getVideoInfo();
      sendResponse({
        isYouTube: true,
        hasVideo: !!getVideoId(),
        videoInfo: info,
      });
    }
    return true;
  });

  // Initialize
  function init() {
    currentVideoId = getVideoId();

    if (currentVideoId) {
      console.log("[PageOn] YouTube video page detected, Video ID:", currentVideoId);
      setupVideoMonitor();
    }

    setupNavigationMonitor();

    // Notify background that content script is ready
    sendVideoStatus("content_script_ready", { url: window.location.href });
  }

  // Wait for page to be ready
  if (document.readyState === "complete") {
    init();
  } else {
    window.addEventListener("load", init);
  }
})();
