import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function UserMenu() {
  const { user, loading, signInWithGoogle, signInWithGitHub, signOut, isConfigured } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState<"google" | "github" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignInWithGoogle = async () => {
    setIsSigningIn("google");
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Google sign in failed:", error);
    } finally {
      setIsSigningIn(null);
    }
  };

  const handleSignInWithGitHub = async () => {
    setIsSigningIn("github");
    try {
      await signInWithGitHub();
    } catch (error) {
      console.error("GitHub sign in failed:", error);
    } finally {
      setIsSigningIn(null);
    }
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  // 未配置 Supabase 时不显示
  if (!isConfigured) {
    return null;
  }

  // 加载中
  if (loading) {
    return <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />;
  }

  // 未登录 - 显示登录按钮下拉菜单
  if (!user) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={!!isSigningIn}
          className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSigningIn ? (
            <>
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
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
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <svg
                className="h-5 w-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span>Sign in</span>
              <svg
                className="h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </>
          )}
        </button>

        {/* Login Options Dropdown */}
        {isOpen && !isSigningIn && (
          <div className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-xl border border-gray-200 bg-white py-2 shadow-lg">
            <div className="px-4 py-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
              Sign in with
            </div>

            {/* Google Login */}
            <button
              onClick={handleSignInWithGoogle}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Google</span>
            </button>

            {/* GitHub Login */}
            <button
              onClick={handleSignInWithGitHub}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span>GitHub</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // 已登录 - 显示用户头像和下拉菜单
  const avatarUrl = user.user_metadata?.avatar_url;
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full p-1 transition-all hover:bg-gray-100"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-10 w-10 rounded-full border-2 border-white shadow-sm"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-medium text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-xl border border-gray-200 bg-white py-2 shadow-lg">
          {/* User Info */}
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-10 w-10 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-medium text-white">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
                <p className="truncate text-xs text-gray-500">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
