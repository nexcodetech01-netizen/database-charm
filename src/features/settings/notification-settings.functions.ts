import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getNotificationSettings, updateNotificationSettings } from "./notification-settings.server";
import { requireSupabaseAuth } from "@/features/auth/require-supabase-auth";

export const getNotificationSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return getNotificationSettings(context.supabase, context.userId);
  });

export const updateNotificationSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.record(z.any()).parse(data))
  .handler(async ({ data, context }) => {
    return updateNotificationSettings(context.supabase, context.userId, data);
  });
