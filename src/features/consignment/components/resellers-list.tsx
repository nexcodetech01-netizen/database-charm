import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search, MapPin, Phone, FileText, Trash2, Edit } from 'lucide-react';
import { ConsignmentService } from '@/features/consignment/services/consignment.service';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

const resellerSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  document: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type ResellerFormValues = z.infer<typeof resellerSchema>;

export function ResellersList() {
  const { user, loading: authLoading } = useAuth();
  const companyId = (user as any)?.company_id;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  const form = useForm<ResellerFormValues>({
    resolver: zodResolver(resellerSchema),
    defaultValues: {
      name: '',
      document: '',
      phone: '',
      address: '',
    },
  });

  const { data: resellers = [], isLoading } = useQuery({
    queryKey: ['resellers', companyId],
    queryFn: () => ConsignmentService.listResellers(companyId!),
    enabled: !!companyId,
  });

  const createResellerMutation = useMutation({
    mutationFn: (values: ResellerFormValues) => {
      if (!companyId) throw new Error('Empresa não identificada. Tente recarregar a página.');
      return ConsignmentService.createReseller({
        ...values,
        company_id: companyId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resellers'] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast.success('Revendedor cadastrado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao cadastrar revendedor: ' + error.message);
    }
  });

  const filteredResellers = resellers.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.document?.includes(searchTerm)
  );

  function onSubmit(values: ResellerFormValues) {
    createResellerMutation.mutate(values);
  }

  if (authLoading) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar por nome ou CPF/CNPJ..." 
            className="pl-10 bg-slate-900/50 border-slate-800"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Novo Revendedor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] bg-slate-950 border-slate-800">
            <DialogHeader>
              <DialogTitle>Cadastrar Revendedor</DialogTitle>
              <DialogDescription>
                Adicione um novo revendedor para iniciar consignações.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: João da Silva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="document"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF/CNPJ</FormLabel>
                      <FormControl>
                        <Input placeholder="000.000.000-00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, Número, Bairro, Cidade - UF" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={createResellerMutation.isPending}>
                    {createResellerMutation.isPending ? 'Salvando...' : 'Salvar Cadastro'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-slate-900/50 animate-pulse border border-slate-800" />
          ))}
        </div>
      ) : filteredResellers.length === 0 ? (
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-12 text-center">
          <Users className="h-12 w-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white">Nenhum revendedor encontrado</h3>
          <p className="text-slate-500 mt-2">
            {searchTerm ? 'Tente ajustar sua busca.' : 'Comece cadastrando seu primeiro revendedor.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResellers.map((reseller) => (
            <Card key={reseller.id} className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors group">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-blue-500/10 p-3 rounded-xl">
                    <Users className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-white mb-1">{reseller.name}</h3>
                <div className="space-y-2 mt-4 text-sm text-slate-400">
                  {reseller.document && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span>{reseller.document}</span>
                    </div>
                  )}
                  {reseller.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{reseller.phone}</span>
                    </div>
                  )}
                  {reseller.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="truncate">{reseller.address}</span>
                    </div>
                  )}
                </div>
                
                <Button variant="outline" className="w-full mt-6 border-slate-800 hover:bg-slate-800 text-slate-300">
                  Nova Consignação
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
