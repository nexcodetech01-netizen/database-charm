import {
  Bell,
  Bot,
  DownloadCloud,
  Store,
  UploadCloud,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { ProcessCategory } from "./types";

export const PROCESS_CATEGORY_ICON: Record<ProcessCategory, LucideIcon> = {
  import: DownloadCloud,
  export: UploadCloud,
  integration: Workflow,
  finance: Wallet,
  marketplace: Store,
  ai: Bot,
  notification: Bell,
};
