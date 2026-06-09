import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/centros-de-custo")({
  component: () => <Outlet />,
});
