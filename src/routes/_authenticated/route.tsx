import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/useStore";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { AppLayout } from "@/components/layout/AppLayout";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { needsOnboarding, isLoading, profile } = useCurrentCompany();
  const navigate = useNavigate();
  const initialized = useAuthStore((s) => s.initialized);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!isLoading && initialized && needsOnboarding) {
      navigate({ to: "/onboarding" });
    }
  }, [isLoading, initialized, needsOnboarding, navigate]);

  // Contador role: redirect to area do contador
  useEffect(() => {
    if (profile?.role === "contador" && !pathname.startsWith("/contador")) {
      navigate({ to: "/contador/dashboard" });
    }
  }, [profile?.role, pathname, navigate]);

  // Contador area uses its own chrome — render bare
  if (pathname.startsWith("/contador")) {
    return <Outlet />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
