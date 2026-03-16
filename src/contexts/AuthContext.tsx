import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/services/supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: (options?: { queryParams?: { [key: string]: string } }) => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const isConfigured = isSupabaseConfigured();
  // 如果未配置 Supabase，初始 loading 为 false；否则为 true
  const [loading, setLoading] = useState(() => isConfigured && !!supabase);

  useEffect(() => {
    if (!isConfigured || !supabase) {
      // 不需要 setLoading，初始状态已经是 false
      return;
    }

    // 处理 OAuth 回调
    const handleOAuthCallback = async () => {
      if (!supabase) return;

      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        console.log("[Auth] OAuth callback detected, setting session manually");
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("[Auth] Error setting session from URL:", error);
          } else {
            console.log("[Auth] Session set successfully:", data.user?.email);
            // 清理 URL hash
            const cleanUrl =
              window.location.origin + window.location.pathname + window.location.search;
            window.history.replaceState(null, "", cleanUrl);
            console.log("[Auth] Cleaned URL hash after setting session");
          }
        } catch (err) {
          console.error("[Auth] Exception setting session:", err);
        }
      }
    };

    // 监听认证状态变化 - 需要在 getSession 之前设置
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[Auth] Auth state changed:", event, session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 检查 URL 是否有 OAuth 回调参数，如果有则手动设置 session
    if (window.location.hash.includes("access_token")) {
      handleOAuthCallback();
    } else {
      // 获取初始 session
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) {
          console.error("[Auth] Error getting session:", error);
        }
        console.log("[Auth] Initial session:", session?.user?.email || "No session");
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });
    }

    return () => subscription.unsubscribe();
  }, [isConfigured]);

  // 获取当前 URL 作为 OAuth 回调后的重定向地址（不包含 hash fragment）
  const getCurrentUrl = () => {
    const url = new URL(window.location.href);
    // 清理 OAuth 失败后残留参数，避免下一次登录继续携带错误参数
    const authParams = [
      "error",
      "error_code",
      "error_description",
      "code",
      "sb",
      "state",
      "provider_token",
      "provider_refresh_token",
    ];
    authParams.forEach((key) => url.searchParams.delete(key));
    url.hash = "";
    return `${url.origin}${url.pathname}${url.search}`;
  };

  const signInWithGoogle = async (options?: { queryParams?: { [key: string]: string } }) => {
    if (!supabase) {
      console.error("[Auth] Supabase not configured");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getCurrentUrl(),
        queryParams: options?.queryParams,
      },
    });

    if (error) {
      console.error("[Auth] Google sign in error:", error.message);
      throw error;
    }
  };

  const signInWithGitHub = async () => {
    if (!supabase) {
      console.error("[Auth] Supabase not configured");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: getCurrentUrl(),
      },
    });

    if (error) {
      console.error("[Auth] GitHub sign in error:", error.message);
      throw error;
    }
  };

  const signOut = async () => {
    if (!supabase) {
      console.error("[Auth] Supabase not configured");
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[Auth] Sign out error:", error.message);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithGoogle,
        signInWithGitHub,
        signOut,
        isConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
