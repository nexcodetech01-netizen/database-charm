import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrinterCard } from "./PrinterCard";
import { PrintHistory } from "./PrintHistory";
import { PrintQueue } from "./PrintQueue";
import { useQuery } from "@tanstack/react-query";
import { printManager } from "../../services/print.service";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Printer as PrinterIcon, History, LayoutList, Settings } from "lucide-react";

export function PrintManager() {
  const { data: printers = [] } = useQuery({
    queryKey: ['printers'],
    queryFn: () => printManager.getPrinters()
  });

  const history = printManager.getHistory();
  const queue = printManager.getQueue();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Tabs defaultValue="printers" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="printers" className="flex items-center gap-2">
                <PrinterIcon className="h-4 w-4" /> Impressoras
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" /> Histórico
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" /> Configurações
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="printers" className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {printers.map(printer => (
                    <PrinterCard key={printer.id} printer={printer} />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <PrintHistory jobs={history} />
            </TabsContent>
            
            <TabsContent value="settings" className="mt-4 text-center py-12 border rounded-lg bg-slate-50/50">
              <p className="text-sm text-muted-foreground">Configurações globais de impressão Enterprise</p>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <PrintQueue queue={queue} />
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Status do Hub</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Conexão Local:</span>
                <span className="text-emerald-500 font-bold">Conectado</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-2">
                <span className="text-muted-foreground">Última Sincronização:</span>
                <span>Há 2 min</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
