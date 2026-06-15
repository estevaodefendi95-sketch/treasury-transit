import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useSuperAdmin } from "@/lib/master";

export const Route = createFileRoute("/_authenticated/master")({
  ssr: false,
  component: MasterLayout,
});

function MasterLayout() {
  const { isSuperAdmin, isLoading } = useSuperAdmin();

  if (isLoading) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground">
        Verificando acesso…
      </div>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;

  return <Outlet />;
}
