import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">NexOS</h1>
        <p className="mt-4 text-muted-foreground">Sistema de Gestão Empresarial</p>
      </div>
    </div>
  ),
});
