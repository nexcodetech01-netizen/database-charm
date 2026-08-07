import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PrintJob } from "../../types/printing.types";
import { Loader2, ArrowRight } from "lucide-react";

interface PrintQueueProps {
  queue: PrintJob[];
}

export function PrintQueue({ queue }: PrintQueueProps) {
  if (queue.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2 px-1">
        Fila de Impressão
        <Badge variant="secondary" className="rounded-full px-2 py-0 h-5">
          {queue.length}
        </Badge>
      </h3>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {queue.map((job) => (
          <Card key={job.id} className="border-l-4 border-l-blue-500 overflow-hidden shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      Processando Job #{job.id}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Prioridade: {job.options.priority || 'MEDIUM'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span>Aguardando Hardware</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
