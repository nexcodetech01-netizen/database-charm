import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  XCircle,
  Activity,
  Server,
  Database,
  Terminal,
  Clock
} from "lucide-react";
import { getPrintBridge } from "../../services/print-bridge.registry";
import { toast } from "sonner";

export function PrintBridgeStatus() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);

  const checkConnection = async () => {
    setLoading(true);
    try {
      const bridge = await getPrintBridge();
      const data = await bridge.health();
      setHealth(data);
      if (data.status === 'online') {
        setLastHeartbeat(new Date());
      }
    } catch (error) {
      setHealth({ status: 'offline' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenBridge = () => {
    // Tenta abrir via protocolo customizado ou apenas informa
    window.location.href = "nexos-bridge://open";
    toast.info("Tentando abrir o NexOS Print Bridge local...");
  };

  const isOnline = health?.status === 'online';

  return (
    <Card className="border-blue-100 bg-blue-50/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-600" />
              NexOS Print Bridge
            </CardTitle>
          </div>
          <Badge variant={isOnline ? "outline" : "destructive"} className={isOnline ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}>
            {isOnline ? `v${health.version || '1.3.0'}` : 'Desconectado'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isOnline ? (
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex flex-col gap-1 p-2 rounded bg-white border">
              <span className="text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3" /> Fila
              </span>
              <span className="font-bold">{health.queue || 0} pendentes</span>
            </div>
            <div className="flex flex-col gap-1 p-2 rounded bg-white border">
              <span className="text-muted-foreground flex items-center gap-1">
                <Database className="h-3 w-3" /> Jobs
              </span>
              <span className="font-bold">{health.jobs || 0} total</span>
            </div>
            <div className="flex flex-col gap-1 p-2 rounded bg-white border">
              <span className="text-muted-foreground flex items-center gap-1">
                <Printer className="h-3 w-3" /> Hardware
              </span>
              <span className="font-bold">{health.printers || 0} disp.</span>
            </div>
            <div className="flex flex-col gap-1 p-2 rounded bg-white border">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Uptime
              </span>
              <span className="font-bold">{Math.floor((health.uptime || 0) / 60)} min</span>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center space-y-4">
            <div className="flex flex-col items-center gap-2 text-red-600">
              <XCircle className="h-10 w-10 opacity-20" />
              <span className="text-sm font-semibold">Bridge desconectado</span>
            </div>
            <p className="text-xs text-muted-foreground px-4">
              O serviço local não foi detectado. Certifique-se de que o <strong>NexOS Print Bridge</strong> está rodando no seu computador.
            </p>
            <Button 
              variant="destructive" 
              size="sm" 
              className="w-full max-w-[200px]"
              onClick={checkConnection}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Reconectar
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs flex-1" 
            onClick={checkConnection}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Testar conexão
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs flex-1"
            onClick={handleOpenBridge}
          >
            <ExternalLink className="mr-2 h-3 w-3" />
            Abrir Bridge
          </Button>
        </div>

        {lastHeartbeat && (
          <div className="text-[10px] text-muted-foreground text-center">
            Último heartbeat: {lastHeartbeat.toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
