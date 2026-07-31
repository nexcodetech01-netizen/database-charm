import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { exportCSV, exportPDF, exportXLSX, type Row } from "../utils/export";

interface Props {
  filename: string;
  title: string;
  rows: Row[];
  disabled?: boolean;
}

export function ExportButtons({ filename, title, rows, disabled }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="mr-2 h-4 w-4" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => { void exportPDF(filename, title, rows).catch(() => toast.error("Falha ao gerar o PDF.")); }}>PDF</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { void exportXLSX(filename, rows).catch(() => toast.error("Falha ao gerar o Excel.")); }}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportCSV(filename, rows)}>CSV</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
