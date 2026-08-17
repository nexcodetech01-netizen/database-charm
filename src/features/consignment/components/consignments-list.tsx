import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { 
  Package, 
  Plus, 
  Search, 
  User, 
  Calendar, 
  ChevronRight, 
  MoreHorizontal,
  FileText,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { ConsignmentService } from '@/features/consignment/services/consignment.service';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CreateConsignmentDialog } from './create-consignment-dialog';
import { generateConsignmentPDF } from '../lib/pdf-generator';
import { ConsignmentItem } from '../types';
import { toast } from 'sonner';

export function ConsignmentsList() {
  const { companyId, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: consignments = [], isLoading } = useQuery({
    queryKey: ['consignments', companyId],
    queryFn: () => ConsignmentService.listConsignments(companyId!),
    enabled: !!companyId,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => ConsignmentService.updateConsignmentStatus(id, 'cancelada'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consignments'] });
      toast.success('Consignação cancelada com sucesso');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao cancelar consignação');
    }
  });

  const handleGeneratePdf = async (id: string) => {
    setGeneratingPdfId(id);
    try {
      const { consignment, items } = await ConsignmentService.getConsignment(id);
      const blob = await generateConsignmentPDF(consignment, items, "Empresa NexOS");
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contrato-consignacao-${id.split('-')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Contrato gerado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const handleCancel = (id: string) => {
    if (window.confirm('Tem certeza que deseja cancelar esta consignação? Esta ação não pode ser desfeita.')) {
      cancelMutation.mutate(id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ativa':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Ativa</Badge>;
      case 'fechada':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Fechada</Badge>;
      case 'cancelada':
        return <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredConsignments = consignments.filter(c => 
    c.reseller?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading) return null;

  if (!companyId) {
    return (
      <div className="p-8 text-center text-slate-500">
        Empresa não identificada. Tente recarregar a página.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar por revendedor..." 
            className="pl-10 bg-slate-900/50 border-slate-800"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Button className="bg-primary hover:bg-primary/90" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Consignação
        </Button>
      </div>

      <CreateConsignmentDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
        companyId={companyId} 
      />

      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 w-full rounded bg-slate-800/50 animate-pulse" />
            ))}
          </div>
        ) : filteredConsignments.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Nenhuma consignação encontrada.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Revendedor</TableHead>
                <TableHead className="text-slate-400">Data Envio</TableHead>
                <TableHead className="text-slate-400">Total Consignado</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-right text-slate-400">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConsignments.map((c) => (
                <TableRow key={c.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <TableCell className="font-medium text-white">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-500" />
                      {c.reseller?.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      {format(new Date(c.sent_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300">
                    -
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(c.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-800">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-slate-950 border-slate-800">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          onSelect={() => {
                            console.log('Ver Detalhes clicado', c.id);
                            navigate({ to: `/consignacoes/${c.id}` });
                          }}
                        >
                          <ChevronRight className="h-4 w-4 mr-2" /> Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer" 
                          disabled={generatingPdfId === c.id}
                          onSelect={() => handleGeneratePdf(c.id)}
                        >
                          {generatingPdfId === c.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4 mr-2" />
                          )}
                          Gerar Contrato
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-800" />
                        <DropdownMenuItem 
                          className="cursor-pointer text-destructive focus:text-destructive"
                          onSelect={() => handleCancel(c.id)}
                          disabled={c.status === 'cancelada' || cancelMutation.isPending}
                        >
                          <AlertCircle className="h-4 w-4 mr-2" /> Cancelar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
