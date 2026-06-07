import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOficina } from "@/contexts/OficinaContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { oficinas, loading: oficinaLoading, initialized } = useOficina();

  // Guard: if a recovery link landed on a protected route by mistake,
  // forward straight to /reset-password before doing anything else.
  if (typeof window !== "undefined") {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.substring(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);
    const type = hashParams.get("type") || queryParams.get("type");
    const hasToken =
      hashParams.get("access_token") ||
      queryParams.get("access_token") ||
      queryParams.get("code");

    if (type === "recovery" && hasToken) {
      return (
        <Navigate
          to={`/reset-password${window.location.search}${window.location.hash}`}
          replace
        />
      );
    }
  }

  // Show loading while checking auth or oficinas not yet initialized
  if (authLoading || oficinaLoading || !initialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect to onboarding if no oficina
  if (oficinas.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

