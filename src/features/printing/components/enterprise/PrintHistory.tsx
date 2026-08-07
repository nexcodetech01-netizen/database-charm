import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PrintJob } from "../../types/printing.types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PrintHistoryProps {
  jobs: PrintJob[];
  onReprint?: (job: PrintJob) => void;
}

export function PrintHistory({ jobs, onReprint }: PrintHistoryProps) {
  const getStatusIcon = (status: PrintJob['status']) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'FAILED': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'PROCESSING': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'PENDING': return <Clock className="h-4 w-4 text-slate-400" />;
      default: return null;
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job ID</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Estratégia</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                Nenhum histórico de impressão disponível.
              </TableCell>
            </TableRow>
          ) : (
            jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-mono text-xs">{job.id}</TableCell>
                <TableCell className="text-xs">
                  {format(job.createdAt, "dd/MM HH:mm:ss", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {job.strategy}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(job.status)}
                    <span className="text-xs capitalize">{job.status.toLowerCase()}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => onReprint?.(job)}
                    disabled={job.status === 'PROCESSING'}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
