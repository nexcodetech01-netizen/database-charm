import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/providers/auth-provider";
import { LoadingSurface } from "@/components/design";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  useEffect(() => {
    if (!authLoading) {
      if (user) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        navigate({ to: "/auth", replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  return <LoadingSurface variant="page" />;
}