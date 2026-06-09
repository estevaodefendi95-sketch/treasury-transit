import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
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
  const { needsOnboarding, isLoading } = useCurrentCompany();
  const navigate = useNavigate();
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    if (!isLoading && initialized && needsOnboarding) {
      navigate({ to: "/onboarding" });
    }
  }, [isLoading, initialized, needsOnboarding, navigate]);

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
