import React, { useState, useCallback } from 'react';
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
  Loader2,
  Trash2
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
import { supabase } from '@/integrations/supabase/client';
import { ConsignmentItem } from '../types';
import { toast } from 'sonner';

export function ConsignmentsList() {
  const { companyId, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pathname } = window.location;
  const isListView = pathname === '/consignacoes' || pathname === '/consignacoes/';

  if (!isListView) return null;

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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ConsignmentService.deleteConsignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consignments'] });
      toast.success('Consignação excluída permanentemente');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao excluir consignação');
    }
  });

  const handleGeneratePdf = async (id: string) => {
    setGeneratingPdfId(id);
    try {
      const { consignment, items } = await ConsignmentService.getConsignment(id);
      
      // Buscar dados da empresa para o PDF
      const { data: company } = await supabase
        .from('companies')
        .select('name, cnpj, address, city, state')
        .eq('id', companyId!)
        .single();

      const blob = await generateConsignmentPDF(consignment, items, company || { name: "NexOS ERP" });
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
    setMenuOpenId(null);
    if (window.confirm('Tem certeza que deseja cancelar esta consignação? Esta ação não pode ser desfeita.')) {
      cancelMutation.mutate(id);
    }
  };

  const handleDelete = (id: string) => {
    setMenuOpenId(null);
    if (window.confirm('Tem certeza que deseja excluir permanentemente esta consignação? Essa ação não pode ser desfeita.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleNavigateToDetails = useCallback((id: string) => {
    setMenuOpenId(null);
    // Pequeno atraso para garantir que o estado do menu seja processado antes da navegação
    setTimeout(() => {
      navigate({ to: `/consignacoes/${id}` });
    }, 50);
  }, [navigate]);

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

  if (authLoading || (isLoading && consignments.length === 0)) {
    return (
      <div className="p-20 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-slate-500 animate-pulse">Carregando consignações...</p>
      </div>
    );
  }

  if (!companyId && !authLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p>Sessão da empresa não identificada. Tente recarregar a página.</p>
        <Button variant="link" onClick={() => window.location.reload()}>
          Recarregar
        </Button>
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
        companyId={companyId!} 
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
                <TableRow 
                  key={c.id} 
                  className="border-slate-800 hover:bg-slate-800/30 transition-colors cursor-pointer"
                  onClick={() => {
                    setTimeout(() => {
                      navigate({ to: `/consignacoes/${c.id}` });
                    }, 0);
                  }}
                >
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
                    <DropdownMenu 
                      open={menuOpenId === c.id} 
                      onOpenChange={(open) => setMenuOpenId(open ? c.id : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 hover:bg-slate-800"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-slate-950 border-slate-800">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem 
                          onClick={(e) => e.stopPropagation()}
                          className="cursor-pointer"
                          onSelect={(e) => {
                            e.preventDefault();
                            handleNavigateToDetails(c.id);
                          }}
                        >
                          <ChevronRight className="h-4 w-4 mr-2" /> Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => e.stopPropagation()}
                          className="cursor-pointer" 

                          disabled={generatingPdfId === c.id}
                          onSelect={() => {
                            setMenuOpenId(null);
                            handleGeneratePdf(c.id);
                          }}
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
                          onClick={(e) => e.stopPropagation()}
                          className="cursor-pointer text-destructive focus:text-destructive"

                          onSelect={() => handleCancel(c.id)}
                          disabled={c.status === 'cancelada' || cancelMutation.isPending}
                        >
                          <AlertCircle className="h-4 w-4 mr-2" /> Cancelar
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem 
                          onClick={(e) => e.stopPropagation()}
                          className="cursor-pointer text-destructive focus:text-destructive"
                          onSelect={() => handleDelete(c.id)}
                          disabled={c.status !== 'cancelada' || deleteMutation.isPending}
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Excluir
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
