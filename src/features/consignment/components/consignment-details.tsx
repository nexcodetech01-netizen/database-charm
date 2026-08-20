import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useServerFn } from "@tanstack/react-start";
import { 
  ArrowLeft, 
  FileText, 
  History, 
  Package, 
  User, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Loader2,
  Edit2,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConsignmentService } from '../services/consignment.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/format';
import { generateConsignmentPDF } from '../lib/pdf.functions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RegisterSettlementDialog } from './register-settlement-dialog';
import { EditConsignmentItemsDialog } from './edit-consignment-items-dialog';
import { useAuth } from '@/providers/auth-provider';

export function ConsignmentDetails() {
  const generateConsignmentPDFFn = useServerFn(generateConsignmentPDF);
  const { id } = useParams({ from: '/_authenticated/consignacoes/$id' });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [isEditItemsOpen, setIsEditItemsOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const { companyId } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['consignment', id],
    queryFn: () => ConsignmentService.getConsignment(id),
  });

  const settlements = data?.settlements || [];
  const isLoadingSettlements = isLoading;

  const updateSettlementStatusMutation = useMutation({
    mutationFn: ({ settlementId, status }: { settlementId: string, status: 'pendente' | 'pago' }) => 
      ConsignmentService.updateSettlementStatus(settlementId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consignment', id] });
      toast.success('Status do pagamento atualizado!');
    },
    onError: (err: any) => {
      toast.error('Erro ao atualizar status: ' + err.message);
    }
  });

  const handleGeneratePdf = async () => {
    if (!data) return;
    setGeneratingPdf(true);
    try {
      // Buscar dados da empresa para o PDF
      const { data: company } = await supabase
        .from('companies')
        .select('name, cnpj, address, city, state')
        .eq('id', data.consignment.company_id)
        .single();

      const result = await generateConsignmentPDFFn({
        data: {
          consignmentId: id,
          companyId: data.consignment.company_id
        }
      });

      if (result.url) {
        const link = document.createElement('a');
        link.href = result.url;
        link.target = "_blank";
        link.download = `contrato-consignacao-${id.split('-')[0]}.pdf`;
        link.click();
        toast.success('Contrato gerado!');
      } else {
        toast.info(result.message || 'Geração de PDF em processamento.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-slate-500">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p>Consignação não encontrada.</p>
        <Button variant="link" onClick={() => navigate({ to: '/consignacoes' })}>
          Voltar para a lista
        </Button>
      </div>
    );
  }

  const { consignment, items } = data;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ativa': return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Ativa</Badge>;
      case 'fechada': return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Fechada</Badge>;
      case 'cancelada': return <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20">Cancelada</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/consignacoes' })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Detalhes da Consignação</h1>
          <p className="text-slate-400 text-sm">Ref: {id.split('-')[0].toUpperCase()}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button 
            variant="outline" 
            className="border-slate-800 bg-slate-900/50"
            onClick={handleGeneratePdf}
            disabled={generatingPdf}
          >
            {generatingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Contrato PDF
          </Button>
          <Button 
            className="bg-primary hover:bg-primary/90"
            onClick={() => setIsSettlementOpen(true)}
            disabled={consignment.status === 'cancelada'}
          >
            <Plus className="h-4 w-4 mr-2" />
            Registrar Fechamento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900/50 border-slate-800 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Informações do Revendedor
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Nome</p>
              <p className="text-white font-medium">{consignment.reseller?.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Data de Envio</p>
              <p className="text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                {formatDate(consignment.sent_at)}
              </p>
            </div>
            {consignment.reseller?.document && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Documento</p>
                <p className="text-white">{consignment.reseller.document}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Status</p>
              <div className="mt-1">{getStatusBadge(consignment.status)}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Notas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 text-sm italic">
              {consignment.notes || "Sem observações registradas."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Produtos Consignados
            </CardTitle>
            <CardDescription>Resumo de movimentações e saldo em posse do revendedor.</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white"
            onClick={() => setIsEditItemsOpen(true)}
            disabled={consignment.status === 'fechada' || consignment.status === 'cancelada'}
          >
            <Edit2 className="h-3.5 w-3.5 mr-2" />
            Editar Itens
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 pl-6">Produto</TableHead>
                <TableHead className="text-slate-400 text-center">Enviado</TableHead>
                <TableHead className="text-slate-400 text-center">Vendido</TableHead>
                <TableHead className="text-slate-400 text-center">Devolvido</TableHead>
                <TableHead className="text-slate-400 text-center">Extraviado</TableHead>
                <TableHead className="text-slate-400 text-center font-bold">Saldo</TableHead>
                <TableHead className="text-slate-400 text-right pr-6">Custo Un.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const balance = item.sent_quantity - (item.sold_quantity + item.returned_quantity + item.quantidade_extraviada);
                return (
                  <TableRow key={item.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <TableCell className="pl-6 font-medium text-white">
                      <div>
                        {item.product?.name}
                        <div className="text-xs text-slate-500 font-normal">{item.product?.sku || 'Sem SKU'}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-slate-300">{item.sent_quantity}</TableCell>
                    <TableCell className="text-center text-emerald-400">{item.sold_quantity}</TableCell>
                    <TableCell className="text-center text-blue-400">{item.returned_quantity}</TableCell>
                    <TableCell className="text-center text-red-400">{item.quantidade_extraviada}</TableCell>
                    <TableCell className="text-center font-bold text-white">{balance}</TableCell>
                    <TableCell className="text-right pr-6 text-slate-300">{formatCurrency(item.cost_price)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Fechamentos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingSettlements ? (
            <div className="p-8 text-center text-slate-500">Carregando histórico...</div>
          ) : settlements.length === 0 ? (
            <div className="p-12 text-center text-slate-500 italic">
              Nenhum fechamento registrado até o momento.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400 pl-6">Data Fechamento</TableHead>
                  <TableHead className="text-slate-400 text-right">Valor a Receber</TableHead>
                  <TableHead className="text-slate-400 text-center">Status Pagamento</TableHead>
                  <TableHead className="text-slate-400 text-center">Data Pagamento</TableHead>
                  <TableHead className="text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.map((s) => (
                  <TableRow key={s.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <TableCell className="pl-6 text-white font-medium">
                      {formatDate(s.settled_at)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-400 font-bold">
                      {formatCurrency(s.net_receivable)}
                    </TableCell>
                    <TableCell className="text-center">
                      {s.payment_status === 'pago' ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Pago
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1">
                          <Clock className="h-3 w-3" /> Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-slate-400 text-sm">
                      {s.paid_at ? formatDate(s.paid_at) : '-'}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {s.payment_status === 'pendente' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => updateSettlementStatusMutation.mutate({ settlementId: s.id, status: 'pago' })}
                          disabled={updateSettlementStatusMutation.isPending}
                        >
                          Marcar como Pago
                        </Button>
                      )}
                      {s.payment_status === 'pago' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-slate-500"
                          onClick={() => updateSettlementStatusMutation.mutate({ settlementId: s.id, status: 'pendente' })}
                          disabled={updateSettlementStatusMutation.isPending}
                        >
                          Estornar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RegisterSettlementDialog 
        open={isSettlementOpen}
        onOpenChange={setIsSettlementOpen}
        consignmentId={id}
        items={items}
      />

      <EditConsignmentItemsDialog
        open={isEditItemsOpen}
        onOpenChange={setIsEditItemsOpen}
        consignmentId={id}
        companyId={companyId || consignment.company_id}
        initialItems={items}
      />
    </div>
  );
}
