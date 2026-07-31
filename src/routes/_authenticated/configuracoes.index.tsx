import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { z } from "zod";
import { SettingsWorkspace } from "@/features/settings";

const searchSchema = z.object({
  section: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/configuracoes/")({
  beforeLoad: requirePermission("settings.view"),
  component: SettingsWorkspace,
  validateSearch: (search) => searchSchema.parse(search),
});
