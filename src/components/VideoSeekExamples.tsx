import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/contexts/AuthContext";
import { toggleVideoLike } from "@/services/likeService";

export interface Video {
  id: string;
  title: string;
  summary: string;
  thumbnail_url: string;
  created_at: string;
  source_count: number;
  source_icons: string[];
  like_count?: number; // 点赞数
  is_liked?: boolean; // 当前用户是否已点赞
}

// 后端 API 返回的视频数据格式
interface ApiVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  summary: string;
  createdAt: string;
}

// 导出 ref 类型
export interface VideoSeekExamplesHandle {
  refresh: () => void;
}

// 格式化时间（相对时间）
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}min ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}days ago`;
  return date.toLocaleDateString("zh-CN");
};

export const VideoSeekExamples = forwardRef<VideoSeekExamplesHandle>((props, ref) => {
  // 从 sessionStorage 恢复视频数据，避免每次回到页面都刷新
  const [allVideos, setAllVideos] = useState<Video[]>(() => {
    try {
      const cached = sessionStorage.getItem("videoSeekExamples");
      if (cached) {
        const parsed = JSON.parse(cached);
        console.log("[VideoSeekExamples] Restored", parsed.length, "videos from cache");
        return parsed;
      }
    } catch (e) {
      console.error("[VideoSeekExamples] Failed to parse cached videos:", e);
    }
    return [];
  });
  const [displayedCount, setDisplayedCount] = useState(5); // 当前显示的视频数量
  const [loading, setLoading] = useState(() => {
    // 如果有缓存数据，初始就不是 loading 状态
    return !sessionStorage.getItem("videoSeekExamples");
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likingVideoId, setLikingVideoId] = useState<string | null>(null); // 正在点赞的视频ID
  const navigate = useNavigate();
  const { user } = useAuth();

  // 获取视频数据的函数（可以被外部调用）
  const fetchVideos = useCallback(
    async (forceRefresh = false) => {
      try {
        setLoading(true);
        setError(null);

        // 从后端 API 获取视频列表（传递 user_id 以获取点赞状态）
        const url = user ? `/api/videos?user_id=${user.id}` : "/api/videos";
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`API 返回错误: ${response.status}`);
        }

        const apiVideos: ApiVideo[] = await response.json();

        if (apiVideos && apiVideos.length > 0) {
          // 转换数据格式：将后端格式转换为组件需要的格式
          const formattedVideos: Video[] = apiVideos.map((item) => ({
            id: item.videoId,
            title: item.title || "",
            summary: item.summary || item.description || "",
            thumbnail_url: item.thumbnail || "",
            created_at: item.createdAt,
            source_count: 0, // 后端暂未提供，使用默认值
            source_icons: [], // 后端暂未提供，使用默认值
            like_count: (item as ApiVideo & { like_count?: number }).like_count || 0, // 点赞数
            is_liked: (item as ApiVideo & { is_liked?: boolean }).is_liked || false, // 用户是否已点赞
          }));
          setAllVideos(formattedVideos);
          // 缓存到 sessionStorage
          sessionStorage.setItem("videoSeekExamples", JSON.stringify(formattedVideos));

          // 如果是强制刷新，重置显示数量
          if (forceRefresh) {
            setDisplayedCount(5);
          }

          console.log(
            `[VideoSeekExamples] ${forceRefresh ? "Refreshed" : "Loaded"} ${formattedVideos.length} videos from API`,
          );
        } else {
          setAllVideos([]);
        }
      } catch (err) {
        console.error("[VideoSeekExamples] Failed to fetch videos:", err);
        setError(err instanceof Error ? err.message : "获取视频失败");
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  // 手动刷新函数
  const handleRefresh = useCallback(() => {
    console.log("[VideoSeekExamples] Manual refresh triggered");
    sessionStorage.removeItem("videoSeekExamples"); // 清除缓存
    fetchVideos(true); // 强制刷新
  }, [fetchVideos]);

  // 暴露 refresh 方法给父组件
  useImperativeHandle(
    ref,
    () => ({
      refresh: handleRefresh,
    }),
    [handleRefresh],
  );

  // 处理视频卡片点击
  const handleVideoClick = (video: Video) => {
    // 构建 YouTube URL（video.id 就是 videoId）
    const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
    console.log("[VideoSeekExamples] User clicked video:", video.title);

    // 跳转到分析页面
    navigate("/result", {
      state: {
        streamingUrl: videoUrl,
        language: "en",
      },
    });
  };

  // 处理点赞/取消点赞
  const handleLikeToggle = async (video: Video, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发视频点击

    if (!user) {
      // 如果用户未登录，可以提示登录或直接返回
      console.log("[VideoSeekExamples] User not logged in, skipping like");
      return;
    }

    if (likingVideoId === video.id) {
      return; // 防止重复点击
    }

    try {
      setLikingVideoId(video.id);

      // 直接使用前端 likeService 操作数据库
      const result = await toggleVideoLike(video.id, user.id);

      // 更新本地状态
      setAllVideos((prevVideos) => {
        const updatedVideos = prevVideos.map((v) =>
          v.id === video.id
            ? {
                ...v,
                like_count: result.likeCount,
                is_liked: result.liked,
              }
            : v,
        );
        // 同步更新缓存
        sessionStorage.setItem("videoSeekExamples", JSON.stringify(updatedVideos));
        return updatedVideos;
      });
    } catch (err) {
      console.error("[VideoSeekExamples] Failed to toggle like:", err);
      // 可以显示错误提示，这里先静默失败
    } finally {
      setLikingVideoId(null);
    }
  };

  // 初始加载所有视频 - 只在没有缓存数据时获取
  useEffect(() => {
    // 如果已经有视频数据（从缓存恢复），跳过获取
    if (allVideos.length > 0) {
      console.log("[VideoSeekExamples] Already have", allVideos.length, "videos, skipping fetch");
      setLoading(false);
      return;
    }

    fetchVideos(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次，不再依赖 user 状态

  // 无限滚动：监听滚动事件（使用防抖优化）
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      // 清除之前的定时器
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // 防抖：200ms 后执行
      timeoutId = setTimeout(() => {
        // 检查是否滚动到底部（距离底部 200px 时触发）
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;

        // 如果接近底部且还有更多视频，且不在加载中
        if (
          scrollTop + windowHeight >= documentHeight - 200 &&
          displayedCount < allVideos.length &&
          !loadingMore &&
          !loading
        ) {
          setLoadingMore(true);
          // 延迟一下以显示加载状态
          setTimeout(() => {
            setDisplayedCount((prev) => Math.min(prev + 5, allVideos.length));
            setLoadingMore(false);
          }, 300);
        }
      }, 200);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [displayedCount, allVideos.length, loadingMore, loading]);

  // 计算当前要显示的视频
  const videos = allVideos.slice(0, displayedCount);
  const hasMore = displayedCount < allVideos.length;

  // Loading Skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Hero Card A Skeleton */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex flex-col md:flex-row">
            <div className="h-48 w-full animate-pulse bg-gray-200 md:h-64 md:w-96" />
            <div className="flex-1 space-y-3 p-6">
              <div className="h-6 w-3/4 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
              <div className="mt-4 flex items-center gap-2">
                <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          </div>
        </div>

        {/* Hero Card B Skeleton */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex flex-col-reverse md:flex-row">
            <div className="flex-1 space-y-3 p-6">
              <div className="h-6 w-3/4 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="h-48 w-full animate-pulse bg-gray-200 md:h-64 md:w-96" />
          </div>
        </div>

        {/* Grid Cards Skeleton */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="aspect-video animate-pulse bg-gray-200" />
              <div className="space-y-2 p-4">
                <div className="h-5 w-full animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  // Empty State
  if (videos.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">暂无视频示例</p>
      </div>
    );
  }

  // 渲染单个 Hero Card（左图右文）
  const renderHeroCardA = (video: Video) => (
    <article
      key={video.id}
      className="group cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex flex-col md:flex-row" onClick={() => handleVideoClick(video)}>
        {/* 左侧缩略图 */}
        <div className="relative h-48 w-full overflow-hidden md:h-64 md:w-96">
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://via.placeholder.com/400x225?text=No+Image";
            }}
          />
        </div>

        {/* 右侧内容 */}
        <div className="flex flex-1 flex-col justify-between p-6">
          <div>
            <h3 className="mb-2 line-clamp-2 text-xl font-semibold text-gray-900">{video.title}</h3>
            <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-gray-500">
              {video.summary}
            </p>
          </div>

          {/* Meta Info */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{formatTimeAgo(video.created_at)}</span>
              {video.source_count > 0 && (
                <span className="text-xs text-gray-400">{video.source_count} 来源</span>
              )}
              {video.source_icons.length > 0 && (
                <div className="flex -space-x-2">
                  {video.source_icons.slice(0, 3).map((icon, idx) => (
                    <img
                      key={idx}
                      src={icon}
                      alt={`Source ${idx + 1}`}
                      className="h-5 w-5 rounded-full border-2 border-white object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleLikeToggle(video, e)}
                disabled={likingVideoId === video.id || !user}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors ${
                  video.is_liked
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : "text-gray-400 hover:bg-gray-100 hover:text-red-500"
                } disabled:cursor-not-allowed disabled:opacity-50`}
                title={user ? (video.is_liked ? "取消点赞" : "点赞") : "请先登录"}
              >
                <svg
                  className={`h-5 w-5 ${video.is_liked ? "fill-current" : ""}`}
                  fill={video.is_liked ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                {video.like_count !== undefined && video.like_count > 0 && (
                  <span className="text-xs font-medium">{video.like_count}</span>
                )}
              </button>
              <button className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );

  // 渲染单个 Hero Card（左文右图）
  const renderHeroCardB = (video: Video) => (
    <article
      key={video.id}
      className="group cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex flex-col-reverse md:flex-row" onClick={() => handleVideoClick(video)}>
        {/* 左侧内容 */}
        <div className="flex flex-1 flex-col justify-between p-6">
          <div>
            <h3 className="mb-2 line-clamp-2 text-xl font-semibold text-gray-900">{video.title}</h3>
            <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-gray-500">
              {video.summary}
            </p>
          </div>

          {/* Meta Info */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{formatTimeAgo(video.created_at)}</span>
              {video.source_count > 0 && (
                <span className="text-xs text-gray-400">{video.source_count} sources</span>
              )}
              {video.source_icons.length > 0 && (
                <div className="flex -space-x-2">
                  {video.source_icons.slice(0, 3).map((icon, idx) => (
                    <img
                      key={idx}
                      src={icon}
                      alt={`Source ${idx + 1}`}
                      className="h-5 w-5 rounded-full border-2 border-white object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleLikeToggle(video, e)}
                disabled={likingVideoId === video.id || !user}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors ${
                  video.is_liked
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : "text-gray-400 hover:bg-gray-100 hover:text-red-500"
                } disabled:cursor-not-allowed disabled:opacity-50`}
                title={user ? (video.is_liked ? "Unlike" : "Like") : "Please login first"}
              >
                <svg
                  className={`h-5 w-5 ${video.is_liked ? "fill-current" : ""}`}
                  fill={video.is_liked ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                {video.like_count !== undefined && video.like_count > 0 && (
                  <span className="text-xs font-medium">{video.like_count}</span>
                )}
              </button>
              <button className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 右侧缩略图 */}
        <div className="relative h-48 w-full overflow-hidden md:h-64 md:w-96">
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://via.placeholder.com/400x225?text=No+Image";
            }}
          />
        </div>
      </div>
    </article>
  );

  // 渲染 Grid Card
  const renderGridCard = (video: Video) => (
    <article
      key={video.id}
      className="group cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
      onClick={() => handleVideoClick(video)}
    >
      {/* 上图 */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={video.thumbnail_url}
          alt={video.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://via.placeholder.com/400x225?text=No+Image";
          }}
        />
      </div>

      {/* 下文 */}
      <div className="p-4">
        <h3 className="mb-2 line-clamp-2 text-base font-semibold text-gray-900">{video.title}</h3>
        <p className="mb-3 line-clamp-2 text-sm text-gray-500">{video.summary}</p>

        {/* Meta Info */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{formatTimeAgo(video.created_at)}</span>
            {video.source_count > 0 && (
              <>
                <span className="text-xs text-gray-300">•</span>
                <span className="text-xs text-gray-400">{video.source_count} sources</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {video.source_icons.length > 0 && (
              <div className="flex -space-x-1">
                {video.source_icons.slice(0, 2).map((icon, idx) => (
                  <img
                    key={idx}
                    src={icon}
                    alt={`Source ${idx + 1}`}
                    className="h-4 w-4 rounded-full border border-white object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ))}
              </div>
            )}
            <button
              onClick={(e) => handleLikeToggle(video, e)}
              disabled={likingVideoId === video.id || !user}
              className={`ml-1 flex items-center gap-1 rounded-full px-2 py-1 transition-colors ${
                video.is_liked
                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                  : "text-gray-400 hover:bg-gray-100 hover:text-red-500"
              } disabled:cursor-not-allowed disabled:opacity-50`}
              title={user ? (video.is_liked ? "Unlike" : "Like") : "Please login first"}
            >
              <svg
                className={`h-4 w-4 ${video.is_liked ? "fill-current" : ""}`}
                fill={video.is_liked ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              {video.like_count !== undefined && video.like_count > 0 && (
                <span className="text-xs font-medium">{video.like_count}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  );

  // 将视频分组：每5个为一组，前2个用Hero Card，后3个用Grid
  const renderVideoGroups = () => {
    const groups: React.ReactNode[] = [];

    for (let i = 0; i < videos.length; i += 5) {
      const group = videos.slice(i, i + 5);
      const [first, second, ...gridVideos] = group;

      groups.push(
        <div key={`group-${i}`} className="space-y-6">
          {/* Hero Card A - 左图右文（每组第1个） */}
          {first && renderHeroCardA(first)}

          {/* Hero Card B - 左文右图（每组第2个） */}
          {second && renderHeroCardB(second)}

          {/* Grid Cards - 三列布局（每组第3、4、5个） */}
          {gridVideos.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {gridVideos.map((video) => renderGridCard(video))}
            </div>
          )}
        </div>,
      );
    }

    return groups;
  };

  return (
    <div className="space-y-6">
      {renderVideoGroups()}

      {/* 加载更多指示器 */}
      {loadingMore && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg
              className="h-5 w-5 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>Loading more videos...</span>
          </div>
        </div>
      )}

      {/* 没有更多视频提示 */}
      {!hasMore && allVideos.length > 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-400">All videos have been displayed</p>
        </div>
      )}
    </div>
  );
});
