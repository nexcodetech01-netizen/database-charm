import { LabelData, PrintOptions, PrintResult } from "../types/printing.types";

export interface IPrintBridge {
  health(): Promise<{ status: string; [key: string]: any }>;
  print(label: LabelData, options: PrintOptions): Promise<PrintResult>;
}
