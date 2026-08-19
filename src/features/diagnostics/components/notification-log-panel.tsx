import React, { useState } from 'react';
import { useLogStore } from '../hooks/use-log-store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export function NotificationLogPanel() {
  const { logs, clearLogs } = useLogStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50 gap-2 bg-background/95 backdrop-blur shadow-lg border-primary/20 hover:border-primary/50"
        onClick={() => setIsOpen(true)}
      >
        <Terminal className="h-4 w-4 text-primary" />
        <span>Debug Logs</span>
        {logs.length > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
            {logs.length}
          </span>
        )}
      </Button>
    );
  }

  return (
    <div 
      className={cn(
        "fixed bottom-4 right-4 z-50 flex flex-col bg-background/95 backdrop-blur shadow-2xl border border-border rounded-lg overflow-hidden transition-all duration-200",
        isMinimized ? "h-12 w-64" : "h-[400px] w-[500px] max-w-[90vw]"
      )}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-wider">Notif Diagnostic</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearLogs} title="Limpar logs">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <ScrollArea className="flex-1 p-2 font-mono text-[11px]">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground italic">
              Aguardando eventos...
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="group border-b border-border/50 pb-1 last:border-0">
                  <span className="text-muted-foreground mr-2">
                    [{format(log.timestamp, "HH:mm:ss")}]
                  </span>
                  <span className={cn(
                    "font-bold mr-2",
                    log.prefix === '[EXT-NOTIF]' ? "text-blue-500" : "text-purple-500"
                  )}>
                    {log.prefix}
                  </span>
                  <span className="text-foreground break-all whitespace-pre-wrap">
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}
