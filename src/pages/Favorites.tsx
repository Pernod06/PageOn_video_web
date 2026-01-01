import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserFavoritesWithMetadata,
  type FavoriteVideo,
  removeFavorite,
} from "@/services/favoriteService";
import { Button } from "@/components";

export default function Favorites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingVideoId, setRemovingVideoId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const loadFavorites = async () => {
      setIsLoading(true);
      try {
        const data = await getUserFavoritesWithMetadata(user.id);
        setFavorites(data);
      } catch (error) {
        console.error("[Favorites] Error loading favorites:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFavorites();
  }, [user?.id]);

  const handleRemoveFavorite = async (videoId: string) => {
    if (!user?.id) return;

    setRemovingVideoId(videoId);
    try {
      const success = await removeFavorite(videoId, user.id);
      if (success) {
        // Remove from local state
        setFavorites((prev) => prev.filter((f) => f.video_id !== videoId));
      }
    } catch (error) {
      console.error("[Favorites] Error removing favorite:", error);
    } finally {
      setRemovingVideoId(null);
    }
  };

  const handleVideoClick = (videoId: string) => {
    navigate(`/result?v=${videoId}`);
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md space-y-4 rounded-lg border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg
              className="h-8 w-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Sign In Required</h2>
          <p className="text-gray-600">Please sign in to view your favorites</p>
          <Link to="/">
            <Button className="bg-blue-600 text-white hover:bg-blue-700">Go to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f5]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-[#faf9f5]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="font-medium">Back</span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">My Favorites</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-[1600px] px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <p className="text-gray-600">Loading favorites...</p>
            </div>
          </div>
        ) : favorites.length === 0 ? (
          <div className="rounded-lg border bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <svg
                className="h-8 w-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-gray-900">No Favorites Yet</h2>
            <p className="mb-6 text-gray-600">
              Start saving videos by clicking "Add to Space" on any video page
            </p>
            <Link to="/">
              <Button className="bg-blue-600 text-white hover:bg-blue-700">Browse Videos</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {favorites.length} {favorites.length === 1 ? "video" : "videos"} saved
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {favorites.map((favorite) => (
                <div
                  key={favorite.video_id}
                  className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:border-blue-400 hover:shadow-lg"
                  onClick={() => handleVideoClick(favorite.video_id)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-100">
                    <img
                      src={
                        favorite.video_thumbnail ||
                        `https://img.youtube.com/vi/${favorite.video_id}/maxresdefault.jpg`
                      }
                      alt={favorite.video_title || "Video thumbnail"}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          `https://img.youtube.com/vi/${favorite.video_id}/mqdefault.jpg`;
                      }}
                    />
                    {/* Play Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-lg transition-all group-hover:opacity-100">
                        <svg
                          className="h-5 w-5 text-gray-900"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    {/* Remove Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFavorite(favorite.video_id);
                      }}
                      disabled={removingVideoId === favorite.video_id}
                      className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/90 disabled:opacity-50"
                      title="Remove from favorites"
                    >
                      {removingVideoId === favorite.video_id ? (
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Info */}
                  <div className="cursor-pointer p-3">
                    <h4 className="mb-1 line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-blue-600">
                      {favorite.video_title || "Untitled Video"}
                    </h4>
                    <p className="text-xs text-gray-500">
                      Saved {new Date(favorite.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
