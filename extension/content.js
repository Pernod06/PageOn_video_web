// PageOn Content Script - YouTube Video Detection
// Detects when a YouTube video is being played and shows notification banner
// Also adds analysis buttons to video thumbnails

(function () {
  "use strict";

  const APP_URL = "http://52.72.117.236:3000/";

  let currentVideoId = null;
  let isPlaying = false;
  let videoElement = null;
  let notificationBanner = null;
  let hasShownNotification = false;
  let thumbnailObserver = null;

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

        // Disabled: Show notification if not dismissed
        // We only want buttons on homepage, not notifications on watch page
        // if (!sessionStorage.getItem("pageon-dismissed")) {
        //   // Small delay to ensure video info is loaded
        //   setTimeout(() => {
        //     const updatedInfo = getVideoInfo();
        //     if (updatedInfo) {
        //       showNotificationBanner(updatedInfo);
        //     }
        //   }, 1500);
        // }
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

        // Disabled: Show notification if not dismissed
        // We only want buttons on homepage, not notifications on watch page
        // if (!sessionStorage.getItem("pageon-dismissed")) {
        //   setTimeout(() => {
        //     const updatedInfo = getVideoInfo();
        //     if (updatedInfo) {
        //       showNotificationBanner(updatedInfo);
        //     }
        //   }, 1500);
        // }
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

        // Remove old player button if exists
        const oldButton = document.querySelector(".pageon-player-btn-container");
        if (oldButton) {
          oldButton.remove();
        }

        // Reset and setup monitor for new video
        setTimeout(setupVideoMonitor, 500);

        // Re-inject player button for new video
        setTimeout(() => {
          injectPlayerButton();
        }, 1500);

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

  // ========== Thumbnail Overlay Button Feature ==========

  // Create the PageOn button SVG icon
  function createPageOnIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>`;
  }

  // Extract video URL from thumbnail link
  function extractVideoUrl(thumbnail, debug = false) {
    let linkAnchor = null;
    let foundIn = "";

    // Strategy 1: Check if thumbnail itself is an anchor
    if (thumbnail.tagName === "A") {
      linkAnchor = thumbnail;
      foundIn = "thumbnail itself";
    }

    // Strategy 2: Look for a#thumbnail inside thumbnail
    if (!linkAnchor) {
      linkAnchor = thumbnail.querySelector("a#thumbnail");
      if (linkAnchor) foundIn = "a#thumbnail inside";
    }

    // Strategy 3: Look for any anchor with video URL inside thumbnail
    if (!linkAnchor) {
      linkAnchor = thumbnail.querySelector('a[href*="/watch"], a[href*="/shorts/"]');
      if (linkAnchor) foundIn = "video link inside thumbnail";
    }

    // Strategy 4: Look in parent containers (YouTube首页结构)
    if (!linkAnchor) {
      const parents = [
        "ytd-rich-item-renderer",
        "ytd-rich-grid-media",
        "ytd-video-renderer",
        "ytd-grid-video-renderer",
        "ytd-compact-video-renderer",
        "ytd-playlist-video-renderer",
        "ytd-reel-item-renderer",
      ];

      for (const parentSelector of parents) {
        const parent = thumbnail.closest(parentSelector);
        if (parent) {
          if (debug) console.log("[PageOn] Found parent:", parentSelector);

          // First try a#thumbnail
          linkAnchor = parent.querySelector("a#thumbnail");
          if (linkAnchor) {
            foundIn = `a#thumbnail in ${parentSelector}`;
            break;
          }

          // Then try any video link
          linkAnchor = parent.querySelector('a[href*="/watch"], a[href*="/shorts/"]');
          if (linkAnchor) {
            foundIn = `video link in ${parentSelector}`;
            break;
          }
        }
      }
    }

    // Strategy 5: Look for sibling elements
    if (!linkAnchor && thumbnail.parentElement) {
      linkAnchor = thumbnail.parentElement.querySelector('a[href*="/watch"], a[href*="/shorts/"]');
      if (linkAnchor) foundIn = "sibling element";
    }

    // Strategy 6: Look in the entire document for links near this thumbnail
    if (!linkAnchor) {
      // Try to find the closest video container and look for any link
      const container = thumbnail.closest('[class*="video"], [class*="item"], [class*="renderer"]');
      if (container) {
        linkAnchor = container.querySelector('a[href*="/watch"], a[href*="/shorts/"]');
        if (linkAnchor) foundIn = "nearby container";
      }
    }

    if (!linkAnchor) {
      if (debug) {
        console.log("[PageOn] Debug - No link found. Thumbnail info:");
        console.log("[PageOn] - Tag:", thumbnail.tagName);
        console.log("[PageOn] - Classes:", thumbnail.className);
        console.log(
          "[PageOn] - Parent:",
          thumbnail.parentElement?.tagName,
          thumbnail.parentElement?.className,
        );
        console.log("[PageOn] - HTML (first 300):", thumbnail.outerHTML.substring(0, 300));
      }
      return null;
    }

    const href = linkAnchor.href || linkAnchor.getAttribute("href");
    if (!href) {
      if (debug) console.log("[PageOn] Link found but no href");
      return null;
    }

    // Handle different YouTube URL formats
    if (href.includes("/watch") || href.includes("/shorts/")) {
      if (debug) console.log("[PageOn] ✅ Found video URL in:", foundIn, "-", href);
      // Ensure full URL
      if (href.startsWith("/")) {
        return "https://www.youtube.com" + href;
      }
      return href;
    }

    if (debug) console.log("[PageOn] Link found but not a video URL:", href);
    return null;
  }

  // Check if thumbnail is for a valid video (not a channel, playlist header, etc.)
  function isValidVideoThumbnail(thumbnail) {
    // Skip if already processed
    if (thumbnail.hasAttribute("data-pageon-injected")) {
      return false;
    }

    // Skip channel avatars and non-video thumbnails
    const parent = thumbnail.closest(
      "ytd-channel-renderer, ytd-guide-entry-renderer, ytd-playlist-header-renderer",
    );
    if (parent) {
      return false;
    }

    // Note: 不在这里检查 videoUrl，让 injectThumbnailButton 处理重试逻辑
    return true;
  }

  // Create and inject the analysis button into a thumbnail - 增加了重试逻辑
  async function injectThumbnailButton(thumbnail, debug = false) {
    // 1. 基础检查
    if (!isHomePage()) return false;

    if (!isValidVideoThumbnail(thumbnail)) {
      return false;
    }

    // 如果已经成功注入，直接退出
    if (thumbnail.hasAttribute("data-pageon-injected")) return false;

    // 获取当前重试次数
    let retryCount = parseInt(thumbnail.getAttribute("data-pageon-retry") || "0");
    const MAX_RETRIES = 5; // 最大重试5次（约覆盖 5-10秒的加载窗口）

    // 2. 提取视频 URL
    const videoUrl = extractVideoUrl(thumbnail, debug && retryCount === 0);

    // 如果连链接都没加载出来，且未达到最大重试次数，暂时忽略，等待下次观察
    if (!videoUrl) {
      if (retryCount < MAX_RETRIES) {
        thumbnail.setAttribute("data-pageon-retry", String(retryCount + 1));
      }
      return false;
    }

    // 3. 查找视频卡片容器
    const videoCard = thumbnail.closest(
      "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-reel-item-renderer",
    );

    // 关键优化：检查元数据是否已渲染
    // 如果元数据还没出来，我们无法判断是否有CC，所以视为"未就绪"，进入重试循环
    const metaBlock = videoCard
      ? videoCard.querySelector("#metadata-line, ytd-video-meta-block")
      : null;
    if (!metaBlock && retryCount < MAX_RETRIES) {
      if (debug) console.log("[PageOn] Metadata not ready yet, retrying later:", videoUrl);
      thumbnail.setAttribute("data-pageon-retry", String(retryCount + 1));
      return false;
    }

    // 4. 检查 CC 字幕
    const hasCC = await hasCCCaptions(videoCard || thumbnail, videoUrl); // 传入 URL 用于 API 检查

    if (!hasCC) {
      // 如果没找到 CC，但在重试次数内，不要标记为 Injected (永久忽略)
      // 而是增加重试计数，等待后续 MutationObserver 再次触发
      if (retryCount < MAX_RETRIES) {
        thumbnail.setAttribute("data-pageon-retry", String(retryCount + 1));
        return false;
      } else {
        // 超过重试次数确实没找到，标记为已处理（避免无限循环消耗性能）
        if (debug) console.log("[PageOn] Max retries reached, no CC found:", videoUrl);
        thumbnail.setAttribute("data-pageon-injected", "true"); // 标记为没有CC
        return false;
      }
    }

    // 5. 成功找到 CC，开始注入
    // 标记为已处理
    thumbnail.setAttribute("data-pageon-injected", "true");

    // 确保相对定位
    const computedStyle = window.getComputedStyle(thumbnail);
    if (computedStyle.position === "static") {
      thumbnail.style.position = "relative";
    }

    // 再次检查防止重复
    if (thumbnail.querySelector(".pageon-thumbnail-btn")) return false;

    // 创建按钮
    const btn = document.createElement("button");
    btn.className = "pageon-thumbnail-btn";
    btn.setAttribute("aria-label", "PageOn 视频分析");
    btn.innerHTML = `${createPageOnIcon()}`; // 保持简洁

    // 事件处理
    btn.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        e.preventDefault();
        e.stopImmediatePropagation();
        const analysisUrl = `${APP_URL}?video=${encodeURIComponent(videoUrl)}`;
        window.open(analysisUrl, "_blank");
      },
      true,
    );

    btn.addEventListener(
      "mousedown",
      (e) => {
        e.stopPropagation();
        e.preventDefault();
      },
      true,
    );

    try {
      thumbnail.appendChild(btn);
      if (debug) console.log("[PageOn] ✅ Button injected:", videoUrl);
      return true;
    } catch (error) {
      console.error("[PageOn] Error injecting:", error);
      return false;
    }
  }

  // Process all visible thumbnails
  async function processAllThumbnails() {
    // Only work on homepage
    if (!isHomePage()) {
      return;
    }

    // Select all thumbnail containers that haven't been processed or are retrying
    // 包括那些正在重试的缩略图（retry count < MAX_RETRIES）
    const selectors = [
      "ytd-thumbnail:not([data-pageon-injected]), ytd-thumbnail[data-pageon-retry]",
      "ytd-playlist-thumbnail:not([data-pageon-injected]), ytd-playlist-thumbnail[data-pageon-retry]",
    ];

    const thumbnails = document.querySelectorAll(selectors.join(", "));

    // Filter out those that have been injected (but keep retrying ones)
    const thumbnailsToProcess = Array.from(thumbnails).filter((thumb) => {
      const retryCount = parseInt(thumb.getAttribute("data-pageon-retry") || "0");
      const isInjected = thumb.hasAttribute("data-pageon-injected");
      // Process if not injected, or if retrying (retry count > 0 and < MAX_RETRIES)
      return !isInjected || (retryCount > 0 && retryCount < 5);
    });

    if (thumbnailsToProcess.length === 0) {
      // Try alternative approach if no thumbnails found
      await processVideoCards();
      return;
    }

    let injectedCount = 0;
    let skippedCount = 0;

    // Process thumbnails sequentially to check CC captions
    for (let index = 0; index < thumbnailsToProcess.length; index++) {
      const thumbnail = thumbnailsToProcess[index];
      const result = await injectThumbnailButton(thumbnail, index < 2); // Debug first 2
      if (result) {
        injectedCount++;
      } else {
        skippedCount++;
      }
    }

    if (injectedCount > 0) {
      console.log(
        `[PageOn] ✅ Successfully injected buttons into ${injectedCount} thumbnails with CC (skipped: ${skippedCount})`,
      );
    } else if (thumbnailsToProcess.length > 0) {
      // Don't log warning if we're still retrying
      const stillRetrying = thumbnailsToProcess.some((thumb) => {
        const retryCount = parseInt(thumb.getAttribute("data-pageon-retry") || "0");
        return retryCount > 0 && retryCount < 5;
      });
      if (!stillRetrying) {
        console.log(
          `[PageOn] ⚠️ Found ${thumbnailsToProcess.length} thumbnails but none had CC captions, trying alternative...`,
        );
        await processVideoCards();
      }
    }
  }

  // Alternative approach: Process video cards directly on YouTube homepage
  async function processVideoCards() {
    // Only work on homepage
    if (!isHomePage()) {
      return;
    }

    // YouTube 首页视频卡片选择器
    const cardSelectors = [
      "ytd-rich-item-renderer",
      "ytd-video-renderer",
      "ytd-grid-video-renderer",
      "ytd-compact-video-renderer",
    ];

    // 包括那些正在重试的卡片
    const cards = Array.from(document.querySelectorAll(cardSelectors.join(", "))).filter((card) => {
      const retryCount = parseInt(card.getAttribute("data-pageon-retry") || "0");
      const isInjected = card.hasAttribute("data-pageon-injected");
      return !isInjected || (retryCount > 0 && retryCount < 5);
    });

    if (cards.length === 0) return;

    console.log(`[PageOn] Found ${cards.length} video cards to process`);

    let injectedCount = 0;
    let skippedNoCC = 0;

    // Process cards sequentially to check CC captions
    for (let index = 0; index < cards.length; index++) {
      const card = cards[index];

      // 找到这个卡片中的视频链接
      const videoLink = card.querySelector('a[href*="/watch"], a[href*="/shorts/"]');
      if (!videoLink) {
        card.setAttribute("data-pageon-injected", "true");
        continue;
      }

      const href = videoLink.href;
      if (!href || (!href.includes("/watch") && !href.includes("/shorts/"))) {
        card.setAttribute("data-pageon-injected", "true");
        continue;
      }

      // 获取重试次数
      let retryCount = parseInt(card.getAttribute("data-pageon-retry") || "0");
      const MAX_RETRIES = 5;

      // 检查元数据是否已渲染
      const metaBlock = card.querySelector("#metadata-line, ytd-video-meta-block");
      if (!metaBlock && retryCount < MAX_RETRIES) {
        card.setAttribute("data-pageon-retry", String(retryCount + 1));
        continue;
      }

      // Check if video has CC captions
      const hasCC = await hasCCCaptions(card, href);
      if (!hasCC) {
        if (retryCount < MAX_RETRIES) {
          card.setAttribute("data-pageon-retry", String(retryCount + 1));
          continue;
        } else {
          card.setAttribute("data-pageon-injected", "true");
          skippedNoCC++;
          continue;
        }
      }

      // 找到缩略图容器或创建按钮容器
      let thumbnailContainer = card.querySelector("ytd-thumbnail, #thumbnail");
      if (!thumbnailContainer) {
        thumbnailContainer = card.querySelector("a#thumbnail, .ytd-thumbnail");
      }

      if (!thumbnailContainer) {
        thumbnailContainer = card;
      }

      // 标记为已处理
      card.setAttribute("data-pageon-injected", "true");

      // 确保容器有相对定位
      const computedStyle = window.getComputedStyle(thumbnailContainer);
      if (computedStyle.position === "static") {
        thumbnailContainer.style.position = "relative";
      }

      // 检查是否已有按钮
      if (thumbnailContainer.querySelector(".pageon-thumbnail-btn")) {
        continue;
      }

      // 创建按钮
      const btn = document.createElement("button");
      btn.className = "pageon-thumbnail-btn";
      btn.setAttribute("aria-label", "PageOn 视频分析");
      btn.innerHTML = `${createPageOnIcon()}<span class="pageon-btn-text">PageOn</span>`;

      btn.addEventListener(
        "click",
        (e) => {
          e.stopPropagation();
          e.preventDefault();
          e.stopImmediatePropagation();
          console.log("[PageOn] Button clicked:", href);
          window.open(`${APP_URL}?video=${encodeURIComponent(href)}`, "_blank");
        },
        true,
      );

      btn.addEventListener(
        "mousedown",
        (e) => {
          e.stopPropagation();
          e.preventDefault();
        },
        true,
      );

      thumbnailContainer.appendChild(btn);
      injectedCount++;

      if (index < 2) {
        console.log("[PageOn] ✅ Injected button into card with CC:", href.substring(0, 60));
      }
    }

    if (injectedCount > 0) {
      console.log(
        `[PageOn] ✅ Successfully injected ${injectedCount} buttons via card approach (skipped ${skippedNoCC} without CC)`,
      );
    }
  }

  // Debounce function for performance optimization
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // 优化 Observer 逻辑：更频繁地去抖动
  function setupThumbnailObserver() {
    console.log("[PageOn] setupThumbnailObserver() called");

    if (thumbnailObserver) {
      thumbnailObserver.disconnect();
      console.log("[PageOn] Disconnected existing observer");
    }

    const debouncedProcess = debounce(() => {
      // 使用 requestAnimationFrame 保证不卡顿 UI
      requestAnimationFrame(() => {
        processAllThumbnails().catch((err) => {
          console.error("[PageOn] Error in debounced process:", err);
        });
      });
    }, 500); // 稍微放宽去抖动时间，让 DOM 有时间渲染

    thumbnailObserver = new MutationObserver((mutations) => {
      // 只有当有节点增加时才触发，避免属性变化导致无限循环
      let shouldTrigger = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldTrigger = true;
          break;
        }
        // 或者特定元素的属性变化 (如 loading 状态结束)
      }
      if (shouldTrigger) debouncedProcess();
    });

    // Observe the entire body for changes (YouTube is a SPA)
    if (document.body) {
      thumbnailObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
      console.log("[PageOn] ✅ Thumbnail observer attached to body");
    } else {
      console.log("[PageOn] ⚠️ document.body not available, waiting...");
      // Wait for body to be available
      const bodyWaiter = setInterval(() => {
        if (document.body) {
          clearInterval(bodyWaiter);
          thumbnailObserver.observe(document.body, {
            childList: true,
            subtree: true,
          });
          console.log("[PageOn] ✅ Thumbnail observer attached to body (delayed)");
          processAllThumbnails().catch((err) => console.error("[PageOn] Error:", err));
        }
      }, 100);
    }

    console.log("[PageOn] Thumbnail observer setup complete");

    // 初始化运行
    processAllThumbnails().catch((err) => console.error("[PageOn] Error:", err));

    // 增加一个定时轮询作为保底 (每2秒检查一次未处理的)
    setInterval(() => {
      processAllThumbnails().catch((err) => console.error("[PageOn] Error:", err));
    }, 2000);

    // Also process on scroll (for infinite scroll pages)
    let scrollTimeout;
    window.addEventListener(
      "scroll",
      () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          processAllThumbnails().catch((err) => console.error("[PageOn] Error:", err));
        }, 500);
      },
      { passive: true },
    );
  }

  // ========== End Thumbnail Overlay Feature ==========

  // Check if current page is YouTube homepage (not video watch page)
  function isHomePage() {
    const url = window.location.href;
    // Not a watch page (no /watch in URL)
    return !url.includes("/watch") && !url.includes("/shorts/");
  }

  // 优化 CC 检测逻辑
  async function hasCCCaptions(videoCard, videoUrl) {
    try {
      if (!videoCard) return false;

      // 提取 Video ID
      let videoId = null;
      if (videoUrl) {
        const match = videoUrl.match(/(?:watch\?v=|shorts\/)([a-zA-Z0-9_-]{11})/);
        if (match) videoId = match[1];
      }

      // [Method 1: DOM Badge] 最快、最常用
      // 优化选择器：涵盖更多可能的 Aria Label
      const ccBadge = videoCard.querySelector(
        'ytd-badge-supported-renderer [aria-label*="CC"], ' +
          'ytd-badge-supported-renderer [aria-label*="Captions"], ' +
          'ytd-badge-supported-renderer [aria-label*="字幕"], ' +
          '.badge-style-type-simple[aria-label*="CC"]',
      );

      // 检查文本内容是否包含 CC (有些时候 aria-label 不准，但 innerText 是 "CC")
      if (ccBadge) return true;

      const allBadges = videoCard.querySelectorAll("ytd-badge-supported-renderer");
      for (const badge of allBadges) {
        if (badge.innerText && badge.innerText.trim() === "CC") return true;
      }

      // [Method 2: Metadata Icon] 有些视频 CC 图标在 meta block 里
      const metaIcons = videoCard.querySelectorAll(
        "#metadata-line yt-icon, ytd-video-meta-block yt-icon",
      );
      // 这里很难通过 class 判断，通常这种图标会有 title 或 aria-label
      // 可以暂时略过，因为 Method 1 通常能覆盖 UI 显示

      // [Method 3: API Check] 最可靠的后备方案
      // 如果 DOM 没显示，可能是 UI 隐藏了，但视频其实有字幕
      if (videoId) {
        // 使用一个简单的缓存机制避免对同一个 ID 重复请求
        if (!window._pageOnCcCache) window._pageOnCcCache = {};
        if (window._pageOnCcCache[videoId] !== undefined) {
          return window._pageOnCcCache[videoId];
        }

        // 只有在重试了 2 次以上还找不到 DOM 标记时，才调用 API，减轻服务器压力
        // 这里需要配合 injectThumbnailButton 里的 retryCount 逻辑
        // 或者简单地：总是检查 API (如果不想错过任何一个)

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒超时

          const response = await fetch(
            `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`,
            {
              method: "GET",
              credentials: "omit", // 不需要 cookie
              signal: controller.signal,
            },
          );
          clearTimeout(timeoutId);

          if (response.ok) {
            const text = await response.text();
            // 如果返回了 xml 且包含 track，说明有字幕
            const hasTracks = text.includes("<track") || text.includes("<transcript_list>");

            // 简单的缓存
            window._pageOnCcCache[videoId] = hasTracks;

            if (hasTracks) {
              // console.log('[PageOn] Found CC via API for:', videoId);
              return true;
            }
          }
        } catch (e) {
          // API 失败或超时，忽略
          window._pageOnCcCache[videoId] = false;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  // Helper function to find video in ytInitialData
  function findVideoInInitialData(videoId, data) {
    if (!data) return null;

    const searchInContents = (contents) => {
      if (!contents || !Array.isArray(contents)) return null;

      for (const item of contents) {
        if (!item) continue;

        // Check various renderer types
        if (item.richItemRenderer?.content?.videoRenderer?.videoId === videoId) {
          return item.richItemRenderer.content.videoRenderer;
        }
        if (item.videoRenderer?.videoId === videoId) {
          return item.videoRenderer;
        }
        if (item.richItemRenderer?.content?.reelItemRenderer?.videoId === videoId) {
          return item.richItemRenderer.content.reelItemRenderer;
        }
        if (item.reelItemRenderer?.videoId === videoId) {
          return item.reelItemRenderer;
        }
        if (item.gridVideoRenderer?.videoId === videoId) {
          return item.gridVideoRenderer;
        }
        if (item.compactVideoRenderer?.videoId === videoId) {
          return item.compactVideoRenderer;
        }

        // Recursively search nested contents
        if (item.contents) {
          const found = searchInContents(item.contents);
          if (found) return found;
        }
        if (item.items) {
          const found = searchInContents(item.items);
          if (found) return found;
        }
      }
      return null;
    };

    // Try multiple paths in ytInitialData
    const paths = [
      data.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
        ?.richGridRenderer?.contents,
      data.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
        ?.richGridRenderer?.contents,
      data.contents?.sectionListRenderer?.contents,
      data.contents,
    ];

    for (const path of paths) {
      const found = searchInContents(path);
      if (found) return found;
    }

    return null;
  }

  // Initialize
  function init() {
    console.log("[PageOn] ========== Content script initializing ==========");
    console.log("[PageOn] Current URL:", window.location.href);
    console.log("[PageOn] Document ready state:", document.readyState);

    currentVideoId = getVideoId();

    // Only setup video monitor on watch pages (but don't show notification)
    if (currentVideoId) {
      console.log("[PageOn] YouTube video page detected, Video ID:", currentVideoId);
      // Don't setup video monitor for notifications - we only want thumbnails on homepage
      // setupVideoMonitor(); // Disabled - no notifications on watch page
    } else {
      console.log("[PageOn] Not a video page (homepage or other)");
    }

    // Don't setup navigation monitor - we don't need it for homepage-only feature
    // setupNavigationMonitor(); // Disabled

    // Initialize thumbnail overlay buttons ONLY on homepage
    if (isHomePage()) {
      try {
        console.log("[PageOn] Homepage detected, setting up thumbnail observer...");
        setupThumbnailObserver();
      } catch (error) {
        console.error("[PageOn] Error setting up thumbnail observer:", error);
      }
    } else {
      console.log("[PageOn] Not homepage, skipping thumbnail observer");
    }

    // Notify background that content script is ready
    sendVideoStatus("content_script_ready", { url: window.location.href });

    console.log("[PageOn] ========== Content script initialized ==========");
  }

  // Wait for page to be ready
  console.log("[PageOn] Content script loaded, waiting for page ready...");
  console.log("[PageOn] Document ready state:", document.readyState);

  if (document.readyState === "complete") {
    console.log("[PageOn] Page already complete, initializing now...");
    init();
  } else {
    console.log("[PageOn] Page not ready, waiting for load event...");
    window.addEventListener("load", () => {
      console.log("[PageOn] Load event fired, initializing...");
      init();
    });
    // Also try on DOMContentLoaded
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        console.log("[PageOn] DOMContentLoaded event fired");
      });
    }
  }
})();
