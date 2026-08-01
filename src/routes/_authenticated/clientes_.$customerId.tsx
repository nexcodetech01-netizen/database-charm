import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerInterestsPanel } from "@/features/interests";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { maskDocument, maskPhone, maskCEP } from "@/lib/masks";
import {
  Customer360Panel,
  CUSTOMER_SEGMENT_OPTIONS,
  CustomerForm,
  CustomerStatusBadge,
  InteractionForm,
  InteractionTimeline,
  useCustomer,
} from "@/features/customers";
import { CustomerCreditCard } from "@/features/credit";

export const Route = createFileRoute("/_authenticated/clientes_/$customerId")({
  beforeLoad: requirePermission("customers.view"),
  component: CustomerDetailPage,
});


function CustomerDetailPage() {
  const { customerId } = Route.useParams();
  const { company } = Route.useRouteContext();
  const { data: c, isLoading } = useCustomer(customerId);
  const [isEditOpen, setIsEditOpen] = useState(false);


  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }
  if (!c) {
    return (
      <div className="mx-auto max-w-6xl">
        <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
      </div>
    );
  }

  const segmentLabel = CUSTOMER_SEGMENT_OPTIONS.find((s) => s.value === c.segment)?.label ?? c.segment;
  const documentFmt = c.document ? maskDocument(c.document) : null;
  const phoneFmt = c.phone ? maskPhone(c.phone) : null;
  const whatsappFmt = c.whatsapp ? maskPhone(c.whatsapp) : null;
  const zipFmt = c.zip ? maskCEP(c.zip) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/clientes">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Clientes
        </Link>
      </Button>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
                <CustomerStatusBadge status={c.status} />
                {segmentLabel ? <Badge variant="secondary">{segmentLabel}</Badge> : null}
              </div>
              {documentFmt ? (
                <p className="mt-1 text-sm text-muted-foreground">{documentFmt}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {c.email ? (
                  <span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4" /> {c.email}</span>
                ) : null}
                {phoneFmt ? (
                  <span className="inline-flex items-center gap-1.5"><Phone className="h-4 w-4" /> {phoneFmt}</span>
                ) : null}
                {whatsappFmt ? (
                  <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> {whatsappFmt}</span>
                ) : null}
                {c.city ? (
                  <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {c.city}{c.state ? ` / ${c.state}` : ""}</span>
                ) : null}
              </div>
              {c.tags && c.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.tags.map((t) => (
                    <Badge key={t} variant="outline">{t}</Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {c.whatsapp ? (
              <Button asChild variant="outline" size="sm">
                <a
                  href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                </a>
              </Button>
            ) : null}
            {phoneFmt ? (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(phoneFmt);
                  toast.success("Telefone copiado");
                }}
              >
                <Copy className="mr-1.5 h-4 w-4" /> Telefone
              </Button>
            ) : null}
            {c.email ? (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(c.email ?? "");
                  toast.success("E-mail copiado");
                }}
              >
                <Copy className="mr-1.5 h-4 w-4" /> E-mail
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
            >
              <Pencil className="mr-1.5 h-4 w-4" /> Editar
            </Button>

            <Button asChild size="sm">
              <Link to="/vendas/novo">
                <Plus className="mr-1.5 h-4 w-4" /> Nova venda
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão 360°</TabsTrigger>
          <TabsTrigger value="data">Dados</TabsTrigger>
          <TabsTrigger value="timeline">Interações</TabsTrigger>
          <TabsTrigger value="interests">Interesses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="space-y-4">
            <CustomerCreditCard customerId={customerId} />
            <Customer360Panel customerId={customerId} />
          </div>
        </TabsContent>



        <TabsContent value="data" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <InfoCard title="Contato" items={[
              ["CPF/CNPJ", documentFmt],
              ["E-mail", c.email],
              ["Telefone", phoneFmt],
              ["WhatsApp", whatsappFmt],
              ["Nascimento", c.birth_date ? new Date(c.birth_date).toLocaleDateString("pt-BR") : null],
            ]} />
            <InfoCard title="Endereço" items={[
              ["Logradouro", [c.address, c.address_number].filter(Boolean).join(", ") || null],
              ["Complemento", c.address_complement],
              ["Bairro", c.neighborhood],
              ["Cidade / UF", c.city ? `${c.city}${c.state ? ` / ${c.state}` : ""}` : null],
              ["CEP", zipFmt],
            ]} />
            <InfoCard title="Comercial" items={[
              ["Segmento", segmentLabel ?? null],
              ["Status", c.status],
              ["Última interação", c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleString("pt-BR") : null],
              ["Cadastro", new Date(c.created_at).toLocaleDateString("pt-BR")],
            ]} />
            <InfoCard title="Observações" items={[["Notas", c.notes]]} />
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4 space-y-4">
          <InteractionForm companyId={company.id} customerId={customerId} />
          <InteractionTimeline customerId={customerId} />
        </TabsContent>

        <TabsContent value="interests" className="mt-4">
          <CustomerInterestsPanel
            companyId={company.id}
            customerId={customerId}
            customerName={c.name}
          />
        </TabsContent>
      </Tabs>

      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar cliente</SheetTitle>
            <SheetDescription>{c.name}</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <CustomerForm
              companyId={company.id}
              customer={c}
              onSaved={() => setIsEditOpen(false)}
              onCancel={() => setIsEditOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}


function InfoCard({ title, items }: { title: string; items: [string, string | null | undefined][] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <dl className="mt-3 space-y-2 text-sm">
        {items.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[140px_minmax(0,1fr)] gap-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
            <dd className="whitespace-pre-wrap text-foreground">{v ? v : <span className="text-muted-foreground">—</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
