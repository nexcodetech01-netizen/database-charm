import {
  FileText,
  FileSpreadsheet,
  FileCheck2,
  FileSignature,
  Receipt,
  ScrollText,
  Tag,
  BarChart3,
  FileCode2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { DocumentType } from "./types";

export const DOCUMENT_TYPE_ICON: Record<DocumentType, LucideIcon> = {
  order: FileText,
  quote: FileSpreadsheet,
  purchase: FileCheck2,
  receipt: Receipt,
  payment_receipt: Wallet,
  danfe: ScrollText,
  label: Tag,
  contract: FileSignature,
  report: BarChart3,
  xml: FileCode2,
};
