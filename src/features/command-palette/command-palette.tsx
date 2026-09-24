import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Package,
  Plus,
  Receipt,
  ShoppingCart,
  Truck,
  User,
  Users,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { customersService } from "@/features/customers";
import { formatCurrency } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const CMDK_HINT_SEEN_KEY = "nexos:cmdk-hint-seen";

type ResultItem = {
  id: string;
  title: string;
  subtitle?: string;
  onSelect: () => void;
};

const EVENT_OPEN = "nexos:command-palette:open";

export function CommandPalette({ companyId }: { companyId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [customers, setCustomers] = useState<ResultItem[]>([]);
  const [products, setProducts] = useState<ResultItem[]>([]);
  const [sales, setSales] = useState<ResultItem[]>([]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }

    function onExternalOpen() {
      setOpen(true);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(EVENT_OPEN, onExternalOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(EVENT_OPEN, onExternalOpen);
    };
  }, []);

  // Aviso único (por navegador) pra quem nunca viu a busca rápida —
  // sem isso, nada na tela avisa que o atalho existe.
  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(CMDK_HINT_SEEN_KEY) === "1";
    } catch {
      // localStorage indisponível (modo privado etc.) — não trava nada.
    }
    if (seen) return;

    const timer = setTimeout(() => {
      toast("Busca rápida disponível", {
        description:
          "Aperte Ctrl+K (ou Cmd+K no Mac) a qualquer momento, ou clique na busca no topo da tela.",
        duration: 8000,
      });
      try {
        window.localStorage.setItem(CMDK_HINT_SEEN_KEY, "1");
      } catch {
        // idem — só não repete o aviso se não conseguir salvar.
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCustomers([]);
      setProducts([]);
      setSales([]);
    }
  }, [open]);

  const go = (to: string, params?: Record<string, string>) => {
    setOpen(false);
    navigate({ to, params } as Parameters<typeof navigate>[0]);
  };

  useEffect(() => {
    const term = debouncedQuery.trim();
    if (!open || term.length < 2 || !companyId) {
      setCustomers([]);
      setProducts([]);
      setSales([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      const searchProducts = async () => {
        const result = await supabase.rpc("search_products_unaccent", {
          search_term: term,
          company_id_param: companyId,
          limit_param: 5,
        });
        return result.data ?? [];
      };

      const searchSales = async () => {
        if (!/\d/.test(term)) return [];
        const result = await supabase
          .from("sales")
          .select("id, number, status, grand_total")
          .eq("company_id", companyId)
          .ilike("number", `%${term}%`)
          .order("sale_date", { ascending: false })
          .limit(5);
        return result.data ?? [];
      };

      const [customersResult, productsResult, salesResult] = await Promise.all([
        customersService
          .list(companyId, {
            search: term,
            status: "",
            segment: "",
            state: "",
            sortBy: "name",
            sortDir: "asc",
            page: 1,
            pageSize: 5,
          })
          .catch(() => ({ rows: [] as { id: string; name: string; phone: string | null }[] })),
        searchProducts().catch(() => []),
        searchSales().catch(() => []),
      ]);

      if (cancelled) return;

      setCustomers(
        customersResult.rows.map((customer) => ({
          id: customer.id,
          title: customer.name,
          subtitle: customer.phone ?? undefined,
          onSelect: () => go("/clientes/$customerId", { customerId: customer.id }),
        })),
      );
      setProducts(
        productsResult.map((product) => ({
          id: product.id,
          title: product.name,
          subtitle: product.sku ?? undefined,
          onSelect: () => go("/produtos/$productId", { productId: product.id }),
        })),
      );
      setSales(
        salesResult.map((sale) => ({
          id: sale.id,
          title: `Pedido #${sale.number ?? sale.id.slice(0, 8)}`,
          subtitle: `${sale.status} · ${formatCurrency(sale.grand_total)}`,
          onSelect: () => go("/vendas/$saleId", { saleId: sale.id }),
        })),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open, companyId, navigate]);

  const quickActions = useMemo(
    () => [
      { id: "qa-pdv", icon: ShoppingCart, title: "Abrir PDV", to: "/pdv" },
      { id: "qa-nova-venda", icon: Plus, title: "Nova venda", to: "/vendas/novo" },
      { id: "qa-novo-produto", icon: Package, title: "Novo produto", to: "/produtos/novo" },
      { id: "qa-novo-cliente", icon: User, title: "Novo cliente", to: "/clientes/novo" },
      { id: "qa-nova-compra", icon: Truck, title: "Nova compra", to: "/compras/novo" },
      { id: "qa-clientes", icon: Users, title: "Ver clientes", to: "/clientes" },
      { id: "qa-vendas", icon: Receipt, title: "Ver vendas", to: "/vendas" },
    ],
    [],
  );

  const hasSearch = query.trim().length >= 2;
  const hasResults = customers.length > 0 || products.length > 0 || sales.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar cliente, produto, pedido... ou digite uma ação"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {hasSearch && !hasResults && <CommandEmpty>Nada encontrado.</CommandEmpty>}

        {!hasSearch && (
          <CommandGroup heading="Ações rápidas">
            {quickActions.map((action) => (
              <CommandItem key={action.id} onSelect={() => go(action.to)}>
                <action.icon className="h-4 w-4" />
                <span>{action.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {customers.length > 0 && (
          <CommandGroup heading="Clientes">
            {customers.map((item) => (
              <CommandItem key={item.id} onSelect={item.onSelect}>
                <User className="h-4 w-4" />
                <span>{item.title}</span>
                {item.subtitle && (
                  <span className="ml-auto text-xs text-muted-foreground">{item.subtitle}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {products.length > 0 && (
          <>
            {customers.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Produtos">
              {products.map((item) => (
                <CommandItem key={item.id} onSelect={item.onSelect}>
                  <Package className="h-4 w-4" />
                  <span>{item.title}</span>
                  {item.subtitle && (
                    <span className="ml-auto text-xs text-muted-foreground">{item.subtitle}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {sales.length > 0 && (
          <>
            {(customers.length > 0 || products.length > 0) && <CommandSeparator />}
            <CommandGroup heading="Pedidos">
              {sales.map((item) => (
                <CommandItem key={item.id} onSelect={item.onSelect}>
                  <Receipt className="h-4 w-4" />
                  <span>{item.title}</span>
                  {item.subtitle && (
                    <span className="ml-auto text-xs text-muted-foreground">{item.subtitle}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function openCommandPalette() {
  window.dispatchEvent(new Event(EVENT_OPEN));
}