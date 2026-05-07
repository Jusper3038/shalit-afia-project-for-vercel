import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ALL_APP_PERMISSIONS, type AppPermission } from "@/lib/app-permissions";

const SENSITIVE_ACCESS_KEY = "sensitive_access_verified_at";
const SENSITIVE_ACCESS_WINDOW_MS = 15 * 60 * 1000;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Tables<"profiles"> | null;
  role: string | null;
  clinicOwnerId: string | null;
  allowedApps: AppPermission[];
  canAccessApp: (permission: AppPermission) => boolean;
  isPlatformOwner: boolean;
  isPlatformOwnerReady: boolean;
  loading: boolean;
  hasOwnerSecurityPin: boolean;
  claimPlatformOwnerAccess: () => Promise<{ error?: string }>;
  isSensitiveAccessVerified: () => boolean;
  getSensitiveAccessExpiresAt: () => number | null;
  verifySensitiveAccess: (pin: string) => Promise<{ error?: string }>;
  setOwnerSecurityPin: (pin: string, currentPin?: string) => Promise<{ error?: string }>;
  resetOwnerSecurityPin: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  role: null,
  clinicOwnerId: null,
  allowedApps: [],
  canAccessApp: () => false,
  isPlatformOwner: false,
  isPlatformOwnerReady: false,
  loading: true,
  hasOwnerSecurityPin: false,
  claimPlatformOwnerAccess: async () => ({ error: "Not implemented" }),
  isSensitiveAccessVerified: () => false,
  getSensitiveAccessExpiresAt: () => null,
  verifySensitiveAccess: async () => ({ error: "Not implemented" }),
  setOwnerSecurityPin: async () => ({ error: "Not implemented" }),
  resetOwnerSecurityPin: async () => ({ error: "Not implemented" }),
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [clinicOwnerId, setClinicOwnerId] = useState<string | null>(null);
  const [allowedApps, setAllowedApps] = useState<AppPermission[]>([]);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [isPlatformOwnerReady, setIsPlatformOwnerReady] = useState(false);
  const [hasOwnerSecurityPin, setHasOwnerSecurityPin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (data && !data.is_active) {
      sessionStorage.setItem("auth_blocked_message", "This account has been deactivated. Contact the system owner.");
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      setRole(null);
      setClinicOwnerId(null);
      setAllowedApps([]);
      setIsPlatformOwner(false);
      setIsPlatformOwnerReady(false);
      setHasOwnerSecurityPin(false);
      return;
    }

    setProfile(data);
    setClinicOwnerId(data?.owner_user_id ?? userId);
    setAllowedApps((data?.allowed_apps as AppPermission[] | null) ?? ALL_APP_PERMISSIONS);
  };

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
    setRole(data?.role ?? null);
  };

  const fetchOwnerSecurityPinStatus = async () => {
    const { data, error } = await supabase.rpc("has_owner_security_pin");
    if (!error) {
      setHasOwnerSecurityPin(Boolean(data));
    }
  };

  const fetchPlatformOwnerStatus = async (userId: string) => {
    setIsPlatformOwnerReady(false);
    const { data, error } = await supabase.rpc("is_platform_owner", {
      _user_id: userId,
    });

    if (!error) {
      setIsPlatformOwner(Boolean(data));
    }

    setIsPlatformOwnerReady(true);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
            fetchRole(session.user.id);
            fetchPlatformOwnerStatus(session.user.id);
            fetchOwnerSecurityPinStatus();
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setClinicOwnerId(null);
          setAllowedApps([]);
          setIsPlatformOwner(false);
          setIsPlatformOwnerReady(false);
          setHasOwnerSecurityPin(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchRole(session.user.id);
        fetchPlatformOwnerStatus(session.user.id);
        fetchOwnerSecurityPinStatus();
      } else {
        setIsPlatformOwnerReady(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isSensitiveAccessVerified = () => {
    const verifiedAt = sessionStorage.getItem(SENSITIVE_ACCESS_KEY);
    if (!verifiedAt) return false;
    return Date.now() - Number(verifiedAt) < SENSITIVE_ACCESS_WINDOW_MS;
  };

  const getSensitiveAccessExpiresAt = () => {
    const verifiedAt = sessionStorage.getItem(SENSITIVE_ACCESS_KEY);
    if (!verifiedAt) return null;
    const expiresAt = Number(verifiedAt) + SENSITIVE_ACCESS_WINDOW_MS;
    return Number.isNaN(expiresAt) ? null : expiresAt;
  };

  const verifySensitiveAccess = async (pin: string) => {
    const { data, error } = await supabase.rpc("verify_owner_security_pin", {
      p_pin: pin,
    });

    if (error) {
      return { error: error.message };
    }

    if (!data) {
      return { error: "Incorrect security PIN." };
    }

    sessionStorage.setItem(SENSITIVE_ACCESS_KEY, String(Date.now()));
    return {};
  };

  const setOwnerSecurityPin = async (pin: string, currentPin?: string) => {
    const { error } = await supabase.rpc("set_owner_security_pin", {
      p_current_pin: currentPin ?? null,
      p_pin: pin,
    });

    if (error) {
      return { error: error.message };
    }

    setHasOwnerSecurityPin(true);
    sessionStorage.setItem(SENSITIVE_ACCESS_KEY, String(Date.now()));
    return {};
  };

  const resetOwnerSecurityPin = async () => {
    const { error: clearError } = await supabase.rpc("clear_owner_security_pin");
    if (clearError) {
      return { error: clearError.message };
    }

    if (!user?.email) {
      return { error: "Owner email not found for password reset." };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (error) {
      return { error: error.message };
    }

    setHasOwnerSecurityPin(false);
    sessionStorage.removeItem(SENSITIVE_ACCESS_KEY);
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem(SENSITIVE_ACCESS_KEY);
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole(null);
    setClinicOwnerId(null);
    setAllowedApps([]);
    setIsPlatformOwner(false);
    setIsPlatformOwnerReady(false);
    setHasOwnerSecurityPin(false);
  };

  const claimPlatformOwnerAccess = async () => {
    const { data, error } = await supabase.rpc("claim_platform_owner_access");

    if (error) {
      return { error: error.message };
    }

    setIsPlatformOwner(Boolean(data));
    return {};
  };

  const canAccessApp = (permission: AppPermission) => {
    if (role === "admin") return true;
    return allowedApps.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role,
        clinicOwnerId,
        allowedApps,
        canAccessApp,
        isPlatformOwner,
        isPlatformOwnerReady,
        loading,
        hasOwnerSecurityPin,
        claimPlatformOwnerAccess,
        isSensitiveAccessVerified,
        getSensitiveAccessExpiresAt,
        verifySensitiveAccess,
        setOwnerSecurityPin,
        resetOwnerSecurityPin,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
