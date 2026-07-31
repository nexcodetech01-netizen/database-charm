import type { LucideIcon } from "lucide-react";
import {
  FileCode2,
  FileSpreadsheet,
  FileText,
  Landmark,
  Package,
  ReceiptText,
  Truck,
  Users,
  BookOpen,
} from "lucide-react";
import type { ImportSourceId } from "./types";

export const IMPORT_SOURCE_ICON: Record<ImportSourceId, LucideIcon> = {
  xml_nfe: FileCode2,
  excel: FileSpreadsheet,
  csv: FileText,
  supplier_catalog: BookOpen,
  ofx: Landmark,
  cnab: ReceiptText,
  products: Package,
  customers: Users,
  suppliers: Truck,
};
