import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Banknote,
  BarChart3,
  Boxes,
  Calendar,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileText,
  Gift,
  HandCoins,
  Link as LinkIcon,
  ListChecks,
  Package,
  PackageX,
  PieChart,
  BookOpen,
  Receipt,
  Repeat,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  TrendingUp,
  Truck,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/format";
import { reportsService } from "../services/reports.service";
import { rangeToTimestamp } from "../utils/date-range";
import type {
  ReportCategory,
  ReportCategoryId,
  ReportContext,
  ReportDefinition,
  ReportResult,
} from "./types";

const num = (v: unknown) => (typeof v === "number" ? v : v == null ? 0 : Number(v) || 0);
const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";
const fmtDateTime = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("pt-BR") : "—";

export const REPORT_CATEGORIES: ReportCategory[] = [
  { id: "comercial", label: "Comercial", icon: ShoppingCart, description: "Vendas, ranking e produtos" },
  { id: "financeiro", label: "Financeiro", icon: Banknote, description: "Contas, fluxo e resultados" },
  { id: "estoque", label: "Estoque", icon: Boxes, description: "Posição, giro e alertas" },
  { id: "produtos", label: "Produtos", icon: Package, description: "Cadastro, margens e curva" },
  { id: "catalogos", label: "Catálogos", icon: BookOpen, description: "Catálogos, etiquetas e tabelas de preço" },
  { id: "clientes", label: "Clientes", icon: Users, description: "Base, VIPs e recorrência" },
  { id: "compras", label: "Compras", icon: ShoppingBag, description: "Fornecedores e pedidos" },
  { id: "caixa", label: "Caixa", icon: Wallet, description: "Sessões e movimentos" },
  { id: "bella_pay", label: "Bella Pay", icon: CreditCard, description: "Cobranças e recebimentos" },
  { id: "crediario", label: "Crediário", icon: HandCoins, description: "Contas em aberto, atrasos e recebimentos" },
];

/* ---------------- helpers ---------------- */

async function paidSalesInRange(companyId: string, range: { from: string; to: string }) {
  const { data, error } = await supabase
    .from("sales")
    .select("id, number, sale_date, status, payment_method, grand_total, customer_id, created_by, paid_at")
    .eq("company_id", companyId)
    .eq("status", "paid")
    .gte("sale_date", range.from)
    .lte("sale_date", range.to);
  if (error) throw error;
  return data ?? [];
}

/* ---------------- loaders ---------------- */

async function loadVendasPeriodo(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("sales")
    .select("id, number, sale_date, status, payment_method, grand_total, customer_id, paid_at")
    .eq("company_id", ctx.companyId)
    .gte("sale_date", ctx.range.from)
    .lte("sale_date", ctx.range.to)
    .order("sale_date", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];

  const custIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean) as string[]));
  const custMap = new Map<string, string>();
  if (custIds.length) {
    const { data: cs } = await supabase.from("customers").select("id, name").in("id", custIds);
    for (const c of cs ?? []) custMap.set(c.id, c.name);
  }

  const paid = rows.filter((r) => r.status === "paid");
  const revenue = paid.reduce((s, r) => s + num(r.grand_total), 0);
  const avg = paid.length ? revenue / paid.length : 0;

  return {
    kpis: [
      { label: "Vendas", value: formatNumber(rows.length) },
      { label: "Pagas", value: formatNumber(paid.length) },
      { label: "Receita", value: formatCurrency(revenue) },
      { label: "Ticket médio", value: formatCurrency(avg) },
    ],
    columns: [
      { key: "number", label: "Nº" },
      { key: "sale_date", label: "Data", render: (r) => fmtDate(r.sale_date as string) },
      {
        key: "customer",
        label: "Cliente",
        value: (r) =>
          r.customer_id ? (custMap.get(r.customer_id as string) ?? "—") : "Consumidor",
      },
      { key: "status", label: "Status" },
      { key: "payment_method", label: "Pagamento" },
      {
        key: "grand_total",
        label: "Total",
        align: "right",
        render: (r) => formatCurrency(num(r.grand_total)),
        value: (r) => num(r.grand_total),
      },
    ],
    rows,
  };
}

async function loadProdutosVendidos(ctx: ReportContext): Promise<ReportResult> {
  const rep = await reportsService.products(ctx.companyId, ctx.range);
  const rows = rep.bestSellers.concat(rep.worstSellers.filter((w) => !rep.bestSellers.some((b) => b.id === w.id)));
  const total = rows.reduce((s, r) => s + r.quantity, 0);
  return {
    kpis: [
      { label: "Itens únicos", value: formatNumber(rows.length) },
      { label: "Unidades vendidas", value: formatNumber(total) },
    ],
    columns: [
      { key: "name", label: "Produto" },
      { key: "sku", label: "SKU" },
      { key: "quantity", label: "Qtd", align: "right", render: (r) => formatNumber(num(r.quantity)) },
      { key: "revenue", label: "Receita", align: "right", render: (r) => formatCurrency(num(r.revenue)) },
    ],
    rows,
  };
}

async function loadTicketMedio(ctx: ReportContext): Promise<ReportResult> {
  const sales = await paidSalesInRange(ctx.companyId, ctx.range);
  const byDay = new Map<string, { count: number; total: number }>();
  for (const s of sales) {
    const k = String(s.sale_date);
    const b = byDay.get(k) ?? { count: 0, total: 0 };
    b.count += 1;
    b.total += num(s.grand_total);
    byDay.set(k, b);
  }
  const rows = Array.from(byDay, ([date, v]) => ({
    date,
    count: v.count,
    total: v.total,
    ticket: v.count > 0 ? v.total / v.count : 0,
  })).sort((a, b) => a.date.localeCompare(b.date));
  const totalRev = sales.reduce((s, r) => s + num(r.grand_total), 0);
  return {
    kpis: [
      { label: "Vendas", value: formatNumber(sales.length) },
      { label: "Receita", value: formatCurrency(totalRev) },
      { label: "Ticket médio", value: formatCurrency(sales.length ? totalRev / sales.length : 0) },
    ],
    columns: [
      { key: "date", label: "Data", render: (r) => fmtDate(r.date as string) },
      { key: "count", label: "Vendas", align: "right", render: (r) => formatNumber(r.count as number) },
      { key: "total", label: "Total", align: "right", render: (r) => formatCurrency(r.total as number) },
      { key: "ticket", label: "Ticket médio", align: "right", render: (r) => formatCurrency(r.ticket as number) },
    ],
    rows,
  };
}

async function loadRankingProdutos(ctx: ReportContext): Promise<ReportResult> {
  const rep = await reportsService.products(ctx.companyId, ctx.range);
  const rows = rep.bestSellers.map((r, i) => ({ rank: i + 1, ...r }));
  return {
    kpis: [{ label: "Top produtos", value: formatNumber(rows.length) }],
    columns: [
      { key: "rank", label: "#", align: "center" },
      { key: "name", label: "Produto" },
      { key: "sku", label: "SKU" },
      { key: "quantity", label: "Qtd", align: "right", render: (r) => formatNumber(r.quantity as number) },
      { key: "revenue", label: "Receita", align: "right", render: (r) => formatCurrency(r.revenue as number) },
    ],
    rows,
  };
}

async function loadRankingClientes(ctx: ReportContext): Promise<ReportResult> {
  const rep = await reportsService.customers(ctx.companyId, ctx.range);
  const rows = rep.topCustomers.map((r, i) => ({ rank: i + 1, ...r }));
  return {
    kpis: [{ label: "Clientes no ranking", value: formatNumber(rows.length) }],
    columns: [
      { key: "rank", label: "#", align: "center" },
      { key: "name", label: "Cliente" },
      { key: "purchases", label: "Compras", align: "right", render: (r) => formatNumber(r.purchases as number) },
      { key: "revenue", label: "Receita", align: "right", render: (r) => formatCurrency(r.revenue as number) },
    ],
    rows,
  };
}

async function loadRankingVendedores(ctx: ReportContext): Promise<ReportResult> {
  const sales = await paidSalesInRange(ctx.companyId, ctx.range);
  const agg = new Map<string, { sales: number; revenue: number }>();
  for (const s of sales) {
    const k = s.created_by ?? "—";
    const b = agg.get(k) ?? { sales: 0, revenue: 0 };
    b.sales += 1;
    b.revenue += num(s.grand_total);
    agg.set(k, b);
  }
  const ids = Array.from(agg.keys()).filter((v) => v !== "—");
  const nameMap = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    for (const p of data ?? []) nameMap.set(p.id, p.full_name ?? "—");
  }
  const rows = Array.from(agg, ([id, v]) => ({
    id,
    name: id === "—" ? "Sem vendedor" : (nameMap.get(id) ?? id.slice(0, 8)),
    sales: v.sales,
    revenue: v.revenue,
    ticket: v.sales ? v.revenue / v.sales : 0,
  }))
    .sort((a, b) => b.revenue - a.revenue)
    .map((r, i) => ({ rank: i + 1, ...r }));

  return {
    kpis: [{ label: "Vendedores", value: formatNumber(rows.length) }],
    columns: [
      { key: "rank", label: "#", align: "center" },
      { key: "name", label: "Vendedor" },
      { key: "sales", label: "Vendas", align: "right", render: (r) => formatNumber(r.sales as number) },
      { key: "revenue", label: "Receita", align: "right", render: (r) => formatCurrency(r.revenue as number) },
      { key: "ticket", label: "Ticket médio", align: "right", render: (r) => formatCurrency(r.ticket as number) },
    ],
    rows,
  };
}

async function loadProdutosSemVenda(ctx: ReportContext): Promise<ReportResult> {
  const rep = await reportsService.products(ctx.companyId, ctx.range);
  return {
    kpis: [{ label: "Sem venda no período", value: formatNumber(rep.noMovement.length) }],
    columns: [
      { key: "name", label: "Produto" },
      { key: "sku", label: "SKU" },
      { key: "stock", label: "Estoque", align: "right", render: (r) => formatNumber(r.stock as number) },
    ],
    rows: rep.noMovement,
  };
}

/* ---------------- Financeiro ---------------- */

async function loadContasReceber(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("id, description, amount, due_date, status, transaction_date, category_id")
    .eq("company_id", ctx.companyId)
    .eq("type", "income")
    .in("status", ["pending", "overdue"])
    .order("due_date", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + num(r.amount), 0);
  return {
    kpis: [
      { label: "Títulos", value: formatNumber(rows.length) },
      { label: "Total a receber", value: formatCurrency(total) },
    ],
    columns: [
      { key: "description", label: "Descrição" },
      { key: "due_date", label: "Vencimento", render: (r) => fmtDate(r.due_date as string) },
      { key: "status", label: "Status" },
      {
        key: "amount",
        label: "Valor",
        align: "right",
        render: (r) => formatCurrency(num(r.amount)),
        value: (r) => num(r.amount),
      },
    ],
    rows,
  };
}

async function loadContasPagar(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("id, description, amount, due_date, status, transaction_date")
    .eq("company_id", ctx.companyId)
    .eq("type", "expense")
    .in("status", ["pending", "overdue"])
    .order("due_date", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + num(r.amount), 0);
  return {
    kpis: [
      { label: "Títulos", value: formatNumber(rows.length) },
      { label: "Total a pagar", value: formatCurrency(total) },
    ],
    columns: [
      { key: "description", label: "Descrição" },
      { key: "due_date", label: "Vencimento", render: (r) => fmtDate(r.due_date as string) },
      { key: "status", label: "Status" },
      {
        key: "amount",
        label: "Valor",
        align: "right",
        render: (r) => formatCurrency(num(r.amount)),
        value: (r) => num(r.amount),
      },
    ],
    rows,
  };
}

async function loadFluxoCaixa(ctx: ReportContext): Promise<ReportResult> {
  const rep = await reportsService.finance(ctx.companyId, ctx.range);
  return {
    kpis: [
      { label: "Receitas", value: formatCurrency(rep.metrics.income) },
      { label: "Despesas", value: formatCurrency(rep.metrics.expense) },
      { label: "Saldo", value: formatCurrency(rep.metrics.balance) },
    ],
    columns: [
      { key: "date", label: "Data", render: (r) => fmtDate(r.date as string) },
      { key: "income", label: "Receitas", align: "right", render: (r) => formatCurrency(r.income as number) },
      { key: "expense", label: "Despesas", align: "right", render: (r) => formatCurrency(r.expense as number) },
      { key: "balance", label: "Saldo acumulado", align: "right", render: (r) => formatCurrency(r.balance as number) },
    ],
    rows: rep.daily,
  };
}

async function loadRecebimentos(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("id, description, amount, transaction_date, paid_at, account_id")
    .eq("company_id", ctx.companyId)
    .eq("type", "income")
    .eq("status", "paid")
    .gte("transaction_date", ctx.range.from)
    .lte("transaction_date", ctx.range.to)
    .order("transaction_date", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + num(r.amount), 0);
  return {
    kpis: [
      { label: "Recebimentos", value: formatNumber(rows.length) },
      { label: "Total recebido", value: formatCurrency(total) },
    ],
    columns: [
      { key: "transaction_date", label: "Data", render: (r) => fmtDate(r.transaction_date as string) },
      { key: "description", label: "Descrição" },
      {
        key: "amount",
        label: "Valor",
        align: "right",
        render: (r) => formatCurrency(num(r.amount)),
        value: (r) => num(r.amount),
      },
    ],
    rows,
  };
}

async function loadPagamentos(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("id, description, amount, transaction_date, paid_at, account_id")
    .eq("company_id", ctx.companyId)
    .eq("type", "expense")
    .eq("status", "paid")
    .gte("transaction_date", ctx.range.from)
    .lte("transaction_date", ctx.range.to)
    .order("transaction_date", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + num(r.amount), 0);
  return {
    kpis: [
      { label: "Pagamentos", value: formatNumber(rows.length) },
      { label: "Total pago", value: formatCurrency(total) },
    ],
    columns: [
      { key: "transaction_date", label: "Data", render: (r) => fmtDate(r.transaction_date as string) },
      { key: "description", label: "Descrição" },
      {
        key: "amount",
        label: "Valor",
        align: "right",
        render: (r) => formatCurrency(num(r.amount)),
        value: (r) => num(r.amount),
      },
    ],
    rows,
  };
}

async function loadResultadoPeriodo(ctx: ReportContext): Promise<ReportResult> {
  const rep = await reportsService.finance(ctx.companyId, ctx.range);
  const rows = rep.byCategory.map((c) => ({
    ...c,
    balance: c.income - c.expense,
  }));
  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0);
  return {
    kpis: [
      { label: "Receitas", value: formatCurrency(totalIncome) },
      { label: "Despesas", value: formatCurrency(totalExpense) },
      { label: "Resultado", value: formatCurrency(totalIncome - totalExpense) },
    ],
    columns: [
      { key: "name", label: "Categoria" },
      { key: "income", label: "Receitas", align: "right", render: (r) => formatCurrency(r.income as number) },
      { key: "expense", label: "Despesas", align: "right", render: (r) => formatCurrency(r.expense as number) },
      { key: "balance", label: "Saldo", align: "right", render: (r) => formatCurrency(r.balance as number) },
    ],
    rows,
  };
}

/* ---------------- Estoque ---------------- */

async function loadEstoqueAtual(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, stock, min_stock, cost, price, status")
    .eq("company_id", ctx.companyId)
    .neq("status", "inactive")
    .order("name");
  if (error) throw error;
  const rows = (data ?? []).map((p) => ({
    ...p,
    value: num(p.stock) * num(p.cost),
  }));
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalUnits = rows.reduce((s, r) => s + num(r.stock), 0);
  return {
    kpis: [
      { label: "Itens", value: formatNumber(rows.length) },
      { label: "Unidades", value: formatNumber(totalUnits) },
      { label: "Valor total", value: formatCurrency(totalValue) },
    ],
    columns: [
      { key: "name", label: "Produto" },
      { key: "sku", label: "SKU" },
      { key: "stock", label: "Estoque", align: "right", render: (r) => formatNumber(num(r.stock)) },
      { key: "min_stock", label: "Mínimo", align: "right", render: (r) => formatNumber(num(r.min_stock)) },
      { key: "cost", label: "Custo", align: "right", render: (r) => formatCurrency(num(r.cost)) },
      { key: "value", label: "Valor total", align: "right", render: (r) => formatCurrency(r.value as number) },
    ],
    rows,
  };
}

async function loadEstoqueCritico(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, stock, min_stock, status")
    .eq("company_id", ctx.companyId)
    .neq("status", "inactive");
  if (error) throw error;
  const rows = (data ?? []).filter(
    (p) => num(p.min_stock) > 0 && num(p.stock) <= num(p.min_stock),
  );
  return {
    kpis: [{ label: "Produtos críticos", value: formatNumber(rows.length) }],
    columns: [
      { key: "name", label: "Produto" },
      { key: "sku", label: "SKU" },
      { key: "stock", label: "Estoque", align: "right", render: (r) => formatNumber(num(r.stock)) },
      { key: "min_stock", label: "Mínimo", align: "right", render: (r) => formatNumber(num(r.min_stock)) },
    ],
    rows,
  };
}

async function loadGiroEstoque(ctx: ReportContext): Promise<ReportResult> {
  const rep = await reportsService.inventory(ctx.companyId, ctx.range);
  const rows = rep.topMoved;
  return {
    kpis: [
      { label: "Giro médio", value: `${(rep.metrics.turnover * 100).toFixed(1)}%` },
      { label: "Produtos com giro", value: formatNumber(rows.length) },
    ],
    columns: [
      { key: "name", label: "Produto" },
      { key: "movements", label: "Movimentações", align: "right", render: (r) => formatNumber(r.movements as number) },
      { key: "units", label: "Unidades saídas", align: "right", render: (r) => formatNumber(r.units as number) },
    ],
    rows,
  };
}

async function loadInventario(ctx: ReportContext): Promise<ReportResult> {
  const { fromTs, toTs } = rangeToTimestamp(ctx.range);
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("id, product_id, type, quantity, movement_date, reason, notes")
    .eq("company_id", ctx.companyId)
    .gte("movement_date", fromTs)
    .lte("movement_date", toTs)
    .order("movement_date", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const ids = Array.from(new Set(rows.map((r) => r.product_id).filter(Boolean) as string[]));
  const nameMap = new Map<string, string>();
  if (ids.length) {
    const { data: prods } = await supabase.from("products").select("id, name").in("id", ids);
    for (const p of prods ?? []) nameMap.set(p.id, p.name);
  }
  return {
    kpis: [{ label: "Movimentações", value: formatNumber(rows.length) }],
    columns: [
      { key: "movement_date", label: "Data", render: (r) => fmtDateTime(r.movement_date as string) },
      { key: "product", label: "Produto", value: (r) => nameMap.get(r.product_id as string) ?? "—" },
      { key: "type", label: "Tipo" },
      { key: "quantity", label: "Qtd", align: "right", render: (r) => formatNumber(num(r.quantity)) },
      { key: "reason", label: "Motivo" },
    ],
    rows,
  };
}

async function loadValorEstoque(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, category_id, stock, cost")
    .eq("company_id", ctx.companyId)
    .neq("status", "inactive");
  if (error) throw error;
  const catIds = Array.from(new Set((data ?? []).map((p) => p.category_id).filter(Boolean) as string[]));
  const catMap = new Map<string, string>();
  if (catIds.length) {
    const { data: cats } = await supabase.from("product_categories").select("id, name").in("id", catIds);
    for (const c of cats ?? []) catMap.set(c.id, c.name);
  }
  const rows = (data ?? []).map((p) => ({
    ...p,
    category: p.category_id ? (catMap.get(p.category_id) ?? "—") : "Sem categoria",
    value: num(p.stock) * num(p.cost),
  }));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return {
    kpis: [{ label: "Valor total", value: formatCurrency(total) }],
    columns: [
      { key: "name", label: "Produto" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Categoria" },
      { key: "stock", label: "Estoque", align: "right", render: (r) => formatNumber(num(r.stock)) },
      { key: "cost", label: "Custo", align: "right", render: (r) => formatCurrency(num(r.cost)) },
      { key: "value", label: "Valor", align: "right", render: (r) => formatCurrency(r.value as number) },
    ],
    rows,
  };
}

async function loadSemMovimentacao(ctx: ReportContext): Promise<ReportResult> {
  const rep = await reportsService.inventory(ctx.companyId, ctx.range);
  return {
    kpis: [{ label: "Produtos parados", value: formatNumber(rep.stagnant.length) }],
    columns: [
      { key: "name", label: "Produto" },
      { key: "sku", label: "SKU" },
      { key: "stock", label: "Estoque", align: "right", render: (r) => formatNumber(r.stock as number) },
    ],
    rows: rep.stagnant,
  };
}

/* ---------------- Produtos ---------------- */

async function loadCadastroProdutos(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, barcode, brand, category_id, supplier_id, price, cost, stock, status")
    .eq("company_id", ctx.companyId)
    .order("name");
  if (error) throw error;
  const rows = data ?? [];
  return {
    kpis: [
      { label: "Total", value: formatNumber(rows.length) },
      { label: "Ativos", value: formatNumber(rows.filter((r) => r.status === "active").length) },
    ],
    columns: [
      { key: "name", label: "Produto" },
      { key: "sku", label: "SKU" },
      { key: "barcode", label: "Cód. barras" },
      { key: "brand", label: "Marca" },
      { key: "price", label: "Preço", align: "right", render: (r) => formatCurrency(num(r.price)) },
      { key: "cost", label: "Custo", align: "right", render: (r) => formatCurrency(num(r.cost)) },
      { key: "stock", label: "Estoque", align: "right", render: (r) => formatNumber(num(r.stock)) },
      { key: "status", label: "Status" },
    ],
    rows,
  };
}

async function loadCurvaABC(ctx: ReportContext): Promise<ReportResult> {
  const rep = await reportsService.products(ctx.companyId, ctx.range);
  const sorted = [...rep.bestSellers, ...rep.worstSellers]
    .filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i)
    .sort((a, b) => b.revenue - a.revenue);
  const total = sorted.reduce((s, r) => s + r.revenue, 0);
  let acc = 0;
  const rows = sorted.map((r) => {
    acc += r.revenue;
    const share = total > 0 ? acc / total : 0;
    const classe = share <= 0.8 ? "A" : share <= 0.95 ? "B" : "C";
    return {
      ...r,
      share: total > 0 ? r.revenue / total : 0,
      accShare: share,
      classe,
    };
  });
  return {
    kpis: [
      { label: "Classe A", value: formatNumber(rows.filter((r) => r.classe === "A").length) },
      { label: "Classe B", value: formatNumber(rows.filter((r) => r.classe === "B").length) },
      { label: "Classe C", value: formatNumber(rows.filter((r) => r.classe === "C").length) },
    ],
    columns: [
      { key: "classe", label: "Classe", align: "center" },
      { key: "name", label: "Produto" },
      { key: "revenue", label: "Receita", align: "right", render: (r) => formatCurrency(r.revenue as number) },
      { key: "share", label: "% Receita", align: "right", render: (r) => `${((r.share as number) * 100).toFixed(1)}%` },
      { key: "accShare", label: "% Acumulado", align: "right", render: (r) => `${((r.accShare as number) * 100).toFixed(1)}%` },
    ],
    rows,
  };
}

async function loadMargens(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, price, cost, margin")
    .eq("company_id", ctx.companyId)
    .neq("status", "inactive")
    .order("name");
  if (error) throw error;
  const rows = (data ?? []).map((p) => {
    const price = num(p.price);
    const cost = num(p.cost);
    const marginValue = price - cost;
    const marginPct = price > 0 ? marginValue / price : 0;
    return { ...p, marginValue, marginPct };
  });
  return {
    columns: [
      { key: "name", label: "Produto" },
      { key: "sku", label: "SKU" },
      { key: "cost", label: "Custo", align: "right", render: (r) => formatCurrency(num(r.cost)) },
      { key: "price", label: "Preço", align: "right", render: (r) => formatCurrency(num(r.price)) },
      {
        key: "marginValue",
        label: "Margem R$",
        align: "right",
        render: (r) => formatCurrency(r.marginValue as number),
      },
      {
        key: "marginPct",
        label: "Margem %",
        align: "right",
        render: (r) => `${((r.marginPct as number) * 100).toFixed(1)}%`,
      },
    ],
    rows,
  };
}

async function loadCustos(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, cost, freight, insurance, other_costs, stock")
    .eq("company_id", ctx.companyId)
    .neq("status", "inactive")
    .order("name");
  if (error) throw error;
  const rows = (data ?? []).map((p) => ({
    ...p,
    totalCost: num(p.cost) + num(p.freight) + num(p.insurance) + num(p.other_costs),
  }));
  return {
    columns: [
      { key: "name", label: "Produto" },
      { key: "sku", label: "SKU" },
      { key: "cost", label: "Custo", align: "right", render: (r) => formatCurrency(num(r.cost)) },
      { key: "freight", label: "Frete", align: "right", render: (r) => formatCurrency(num(r.freight)) },
      { key: "insurance", label: "Seguro", align: "right", render: (r) => formatCurrency(num(r.insurance)) },
      { key: "other_costs", label: "Outros", align: "right", render: (r) => formatCurrency(num(r.other_costs)) },
      {
        key: "totalCost",
        label: "Custo total",
        align: "right",
        render: (r) => formatCurrency(r.totalCost as number),
      },
    ],
    rows,
  };
}

async function loadPoliticasPreco(ctx: ReportContext): Promise<ReportResult> {
  const [company, category, product] = await Promise.all([
    supabase
      .from("company_pricing_policies")
      .select("id, version, envelope, updated_at")
      .eq("company_id", ctx.companyId)
      .is("deleted_at", null),
    supabase
      .from("category_pricing_policies")
      .select("id, category_id, version, envelope, updated_at")
      .eq("company_id", ctx.companyId)
      .is("deleted_at", null),
    supabase
      .from("product_pricing_policies")
      .select("id, product_id, version, envelope, updated_at")
      .eq("company_id", ctx.companyId)
      .is("deleted_at", null),
  ]);
  const rows: Record<string, unknown>[] = [];
  for (const r of company.data ?? [])
    rows.push({ escopo: "Empresa", alvo: "Todos", versao: r.version, atualizado_em: r.updated_at });
  for (const r of category.data ?? [])
    rows.push({ escopo: "Categoria", alvo: r.category_id, versao: r.version, atualizado_em: r.updated_at });
  for (const r of product.data ?? [])
    rows.push({ escopo: "Produto", alvo: r.product_id, versao: r.version, atualizado_em: r.updated_at });
  return {
    kpis: [{ label: "Políticas ativas", value: formatNumber(rows.length) }],
    columns: [
      { key: "escopo", label: "Escopo" },
      { key: "alvo", label: "Alvo" },
      { key: "versao", label: "Versão", align: "right" },
      { key: "atualizado_em", label: "Atualizado em", render: (r) => fmtDateTime(r.atualizado_em as string) },
    ],
    rows,
  };
}

/* ---------------- Clientes ---------------- */

async function loadClientesAtivos(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone, segment, city, state, last_interaction_at, created_at")
    .eq("company_id", ctx.companyId)
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  const rows = data ?? [];
  return {
    kpis: [{ label: "Clientes ativos", value: formatNumber(rows.length) }],
    columns: [
      { key: "name", label: "Nome" },
      { key: "email", label: "E-mail" },
      { key: "phone", label: "Telefone" },
      { key: "segment", label: "Segmento" },
      { key: "city", label: "Cidade" },
      { key: "last_interaction_at", label: "Última interação", render: (r) => fmtDate(r.last_interaction_at as string) },
    ],
    rows,
  };
}

async function loadClientesInativos(ctx: ReportContext): Promise<ReportResult> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone, last_interaction_at, created_at")
    .eq("company_id", ctx.companyId)
    .or(`last_interaction_at.is.null,last_interaction_at.lt.${cutoff.toISOString()}`)
    .order("name");
  if (error) throw error;
  const rows = data ?? [];
  return {
    kpis: [{ label: "Inativos (>90 dias)", value: formatNumber(rows.length) }],
    columns: [
      { key: "name", label: "Nome" },
      { key: "email", label: "E-mail" },
      { key: "phone", label: "Telefone" },
      { key: "last_interaction_at", label: "Última interação", render: (r) => fmtDate(r.last_interaction_at as string) },
      { key: "created_at", label: "Cadastro", render: (r) => fmtDate(r.created_at as string) },
    ],
    rows,
  };
}

async function loadClientesNovos(ctx: ReportContext): Promise<ReportResult> {
  const { fromTs, toTs } = rangeToTimestamp(ctx.range);
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone, lead_source, created_at")
    .eq("company_id", ctx.companyId)
    .gte("created_at", fromTs)
    .lte("created_at", toTs)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  return {
    kpis: [{ label: "Novos no período", value: formatNumber(rows.length) }],
    columns: [
      { key: "name", label: "Nome" },
      { key: "email", label: "E-mail" },
      { key: "phone", label: "Telefone" },
      { key: "lead_source", label: "Origem" },
      { key: "created_at", label: "Cadastro", render: (r) => fmtDate(r.created_at as string) },
    ],
    rows,
  };
}

async function loadAniversariantes(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, birth_date, phone, whatsapp")
    .eq("company_id", ctx.companyId)
    .not("birth_date", "is", null);
  if (error) throw error;
  const from = new Date(`${ctx.range.from}T00:00:00`);
  const to = new Date(`${ctx.range.to}T23:59:59`);
  const rows = (data ?? [])
    .map((c) => {
      const bd = c.birth_date ? new Date(`${c.birth_date}T00:00:00`) : null;
      if (!bd) return null;
      const yearStart = from.getFullYear();
      const candidates = [
        new Date(yearStart, bd.getMonth(), bd.getDate()),
        new Date(yearStart + 1, bd.getMonth(), bd.getDate()),
      ];
      const match = candidates.find((d) => d >= from && d <= to);
      if (!match) return null;
      return {
        ...c,
        proximo_aniversario: match.toISOString().slice(0, 10),
      };
    })
    .filter(Boolean) as Record<string, unknown>[];
  return {
    kpis: [{ label: "Aniversariantes", value: formatNumber(rows.length) }],
    columns: [
      { key: "name", label: "Nome" },
      { key: "birth_date", label: "Nascimento", render: (r) => fmtDate(r.birth_date as string) },
      { key: "proximo_aniversario", label: "No período", render: (r) => fmtDate(r.proximo_aniversario as string) },
      { key: "phone", label: "Telefone" },
      { key: "whatsapp", label: "WhatsApp" },
    ],
    rows,
  };
}

async function loadClientesVIP(ctx: ReportContext): Promise<ReportResult> {
  const rep = await reportsService.customers(ctx.companyId, ctx.range);
  const rows = rep.topCustomers.filter((c) => c.purchases >= 3 || c.revenue >= 1000);
  return {
    kpis: [{ label: "Clientes VIP", value: formatNumber(rows.length) }],
    columns: [
      { key: "name", label: "Cliente" },
      { key: "purchases", label: "Compras", align: "right", render: (r) => formatNumber(r.purchases as number) },
      { key: "revenue", label: "Receita", align: "right", render: (r) => formatCurrency(r.revenue as number) },
    ],
    rows,
  };
}

/* ---------------- Compras ---------------- */

async function loadComprasPeriodo(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("purchases")
    .select("id, number, supplier_id, purchase_date, status, grand_total")
    .eq("company_id", ctx.companyId)
    .gte("purchase_date", ctx.range.from)
    .lte("purchase_date", ctx.range.to)
    .order("purchase_date", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const supIds = Array.from(new Set(rows.map((r) => r.supplier_id).filter(Boolean) as string[]));
  const supMap = new Map<string, string>();
  if (supIds.length) {
    const { data: sup } = await supabase.from("product_suppliers").select("id, name").in("id", supIds);
    for (const s of sup ?? []) supMap.set(s.id, s.name);
  }
  const total = rows.reduce((s, r) => s + num(r.grand_total), 0);
  return {
    kpis: [
      { label: "Pedidos", value: formatNumber(rows.length) },
      { label: "Total", value: formatCurrency(total) },
    ],
    columns: [
      { key: "number", label: "Nº" },
      { key: "purchase_date", label: "Data", render: (r) => fmtDate(r.purchase_date as string) },
      {
        key: "supplier",
        label: "Fornecedor",
        value: (r) => (r.supplier_id ? (supMap.get(r.supplier_id as string) ?? "—") : "—"),
      },
      { key: "status", label: "Status" },
      {
        key: "grand_total",
        label: "Total",
        align: "right",
        render: (r) => formatCurrency(num(r.grand_total)),
        value: (r) => num(r.grand_total),
      },
    ],
    rows,
  };
}

async function loadFornecedores(ctx: ReportContext): Promise<ReportResult> {
  const rep = await reportsService.purchases(ctx.companyId, ctx.range);
  return {
    kpis: [{ label: "Fornecedores", value: formatNumber(rep.topSuppliers.length) }],
    columns: [
      { key: "name", label: "Fornecedor" },
      { key: "count", label: "Pedidos", align: "right", render: (r) => formatNumber(r.count as number) },
      { key: "total", label: "Total", align: "right", render: (r) => formatCurrency(r.total as number) },
    ],
    rows: rep.topSuppliers,
  };
}

async function loadProdutosComprados(ctx: ReportContext): Promise<ReportResult> {
  const { data: purchases } = await supabase
    .from("purchases")
    .select("id")
    .eq("company_id", ctx.companyId)
    .gte("purchase_date", ctx.range.from)
    .lte("purchase_date", ctx.range.to);
  const ids = (purchases ?? []).map((p) => p.id);
  if (ids.length === 0) {
    return { columns: [{ key: "name", label: "Produto" }], rows: [] };
  }
  const { data: items, error } = await supabase
    .from("purchase_items")
    .select("product_id, description, quantity, unit_price, total")
    .in("purchase_id", ids);
  if (error) throw error;
  const rows = items ?? [];
  const productIds = Array.from(new Set(rows.map((r) => r.product_id).filter(Boolean) as string[]));
  const nameMap = new Map<string, string>();
  if (productIds.length) {
    const { data: prods } = await supabase.from("products").select("id, name").in("id", productIds);
    for (const p of prods ?? []) nameMap.set(p.id, p.name);
  }
  const totalQty = rows.reduce((s, r) => s + num(r.quantity), 0);
  const totalVal = rows.reduce((s, r) => s + num(r.total), 0);
  return {
    kpis: [
      { label: "Itens", value: formatNumber(rows.length) },
      { label: "Qtd total", value: formatNumber(totalQty) },
      { label: "Total", value: formatCurrency(totalVal) },
    ],
    columns: [
      { key: "product", label: "Produto", value: (r) => (r.product_id ? (nameMap.get(r.product_id as string) ?? "—") : (r.description as string) ?? "—") },
      { key: "quantity", label: "Qtd", align: "right", render: (r) => formatNumber(num(r.quantity)) },
      { key: "unit_price", label: "Unitário", align: "right", render: (r) => formatCurrency(num(r.unit_price)) },
      { key: "total", label: "Total", align: "right", render: (r) => formatCurrency(num(r.total)) },
    ],
    rows,
  };
}

async function loadPedidosPendentes(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("purchases")
    .select("id, number, supplier_id, purchase_date, expected_delivery_date, status, grand_total")
    .eq("company_id", ctx.companyId)
    .in("status", ["draft", "pending"])
    .order("expected_delivery_date", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const supIds = Array.from(new Set(rows.map((r) => r.supplier_id).filter(Boolean) as string[]));
  const supMap = new Map<string, string>();
  if (supIds.length) {
    const { data: sup } = await supabase.from("product_suppliers").select("id, name").in("id", supIds);
    for (const s of sup ?? []) supMap.set(s.id, s.name);
  }
  return {
    kpis: [{ label: "Pendentes", value: formatNumber(rows.length) }],
    columns: [
      { key: "number", label: "Nº" },
      { key: "supplier", label: "Fornecedor", value: (r) => (r.supplier_id ? (supMap.get(r.supplier_id as string) ?? "—") : "—") },
      { key: "purchase_date", label: "Emissão", render: (r) => fmtDate(r.purchase_date as string) },
      { key: "expected_delivery_date", label: "Previsão", render: (r) => fmtDate(r.expected_delivery_date as string) },
      { key: "status", label: "Status" },
      { key: "grand_total", label: "Total", align: "right", render: (r) => formatCurrency(num(r.grand_total)) },
    ],
    rows,
  };
}

/* ---------------- Caixa ---------------- */

async function loadCaixaSessoes(ctx: ReportContext, opts?: { status?: "open" | "closed" }): Promise<ReportResult> {
  const { fromTs, toTs } = rangeToTimestamp(ctx.range);
  let q = supabase
    .from("cash_sessions")
    .select("id, operator_name, status, opened_at, closed_at, opening_balance, counted_cash, expected_cash, difference, sales_count, sales_total")
    .eq("company_id", ctx.companyId)
    .gte("opened_at", fromTs)
    .lte("opened_at", toTs)
    .order("opened_at", { ascending: false });
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  return {
    kpis: [{ label: "Sessões", value: formatNumber(rows.length) }],
    columns: [
      { key: "operator_name", label: "Operador" },
      { key: "opened_at", label: "Abertura", render: (r) => fmtDateTime(r.opened_at as string) },
      { key: "closed_at", label: "Fechamento", render: (r) => fmtDateTime(r.closed_at as string) },
      { key: "status", label: "Status" },
      { key: "opening_balance", label: "Abertura R$", align: "right", render: (r) => formatCurrency(num(r.opening_balance)) },
      { key: "sales_count", label: "Vendas", align: "right", render: (r) => formatNumber(num(r.sales_count)) },
      { key: "sales_total", label: "Total vendas", align: "right", render: (r) => formatCurrency(num(r.sales_total)) },
      { key: "difference", label: "Diferença", align: "right", render: (r) => formatCurrency(num(r.difference)) },
    ],
    rows,
  };
}

async function loadCaixaMovimentos(ctx: ReportContext, type: "cash_in" | "cash_out"): Promise<ReportResult> {
  const { fromTs, toTs } = rangeToTimestamp(ctx.range);
  const { data, error } = await supabase
    .from("cash_movements")
    .select("id, session_id, type, amount, reason, note, created_at")
    .eq("company_id", ctx.companyId)
    .eq("type", type)
    .gte("created_at", fromTs)
    .lte("created_at", toTs)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + num(r.amount), 0);
  return {
    kpis: [
      { label: "Movimentos", value: formatNumber(rows.length) },
      { label: "Total", value: formatCurrency(total) },
    ],
    columns: [
      { key: "created_at", label: "Data", render: (r) => fmtDateTime(r.created_at as string) },
      { key: "reason", label: "Motivo" },
      { key: "note", label: "Observação" },
      {
        key: "amount",
        label: "Valor",
        align: "right",
        render: (r) => formatCurrency(num(r.amount)),
        value: (r) => num(r.amount),
      },
    ],
    rows,
  };
}

async function loadCaixaDivergencias(ctx: ReportContext): Promise<ReportResult> {
  const rep = await loadCaixaSessoes(ctx, { status: "closed" });
  const rows = rep.rows.filter((r) => Math.abs(num((r as Record<string, unknown>).difference)) > 0.01);
  return { ...rep, rows, kpis: [{ label: "Divergências", value: formatNumber(rows.length) }] };
}

/* ---------------- Bella Pay ---------------- */

async function loadBellaPayCharges(
  ctx: ReportContext,
  opts: { billingType?: string; status?: string | string[] } = {},
): Promise<ReportResult> {
  const { fromTs, toTs } = rangeToTimestamp(ctx.range);
  let q = supabase
    .from("bella_pay_charges")
    .select("id, customer_id, billing_type, value, net_value, due_date, status, paid_at, canceled_at, invoice_url, payment_link, created_at")
    .eq("company_id", ctx.companyId)
    .gte("created_at", fromTs)
    .lte("created_at", toTs)
    .order("created_at", { ascending: false });
  if (opts.billingType) q = q.eq("billing_type", opts.billingType);
  if (opts.status) {
    q = Array.isArray(opts.status) ? q.in("status", opts.status) : q.eq("status", opts.status);
  }
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const custIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean) as string[]));
  const custMap = new Map<string, string>();
  if (custIds.length) {
    const { data: cs } = await supabase.from("customers").select("id, name").in("id", custIds);
    for (const c of cs ?? []) custMap.set(c.id, c.name);
  }
  const total = rows.reduce((s, r) => s + num(r.value), 0);
  return {
    kpis: [
      { label: "Cobranças", value: formatNumber(rows.length) },
      { label: "Total", value: formatCurrency(total) },
    ],
    columns: [
      { key: "created_at", label: "Criada", render: (r) => fmtDateTime(r.created_at as string) },
      { key: "customer", label: "Cliente", value: (r) => (r.customer_id ? (custMap.get(r.customer_id as string) ?? "—") : "—") },
      { key: "billing_type", label: "Tipo" },
      { key: "status", label: "Status" },
      { key: "due_date", label: "Vencimento", render: (r) => fmtDate(r.due_date as string) },
      {
        key: "value",
        label: "Valor",
        align: "right",
        render: (r) => formatCurrency(num(r.value)),
        value: (r) => num(r.value),
      },
      { key: "paid_at", label: "Pago em", render: (r) => fmtDateTime(r.paid_at as string) },
    ],
    rows,
  };
}

async function loadBellaPayEstornos(ctx: ReportContext): Promise<ReportResult> {
  return loadBellaPayCharges(ctx, { status: ["REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_DISPUTE", "CHARGEBACK_REVERSAL"] });
}

/* ---------------- Crediário ---------------- */

interface CredAccRow {
  id: string;
  sale_id: string | null;
  customer_id: string | null;
  status: string;
  original_amount: number | string | null;
  down_payment: number | string | null;
  paid_amount: number | string | null;
  balance: number | string | null;
  due_date: string | null;
  opened_at: string | null;
  customers?: { name: string | null } | null;
  sales?: { number: string | null } | null;
}

async function fetchCreditAccounts(companyId: string) {
  const { data, error } = await supabase
    .from("credit_accounts")
    .select("id, sale_id, customer_id, status, original_amount, down_payment, paid_amount, balance, due_date, opened_at, customers(name), sales(number)")
    .eq("company_id", companyId);
  if (error) throw error;
  return (data ?? []) as unknown as CredAccRow[];
}

async function loadCrediarioAbertos(ctx: ReportContext): Promise<ReportResult> {
  const rows = (await fetchCreditAccounts(ctx.companyId)).filter(
    (r) => r.status === "open" || r.status === "partially_paid",
  );
  const totalBalance = rows.reduce((s, r) => s + num(r.balance), 0);
  const totalOriginal = rows.reduce((s, r) => s + num(r.original_amount), 0);
  return {
    kpis: [
      { label: "Contas em aberto", value: formatNumber(rows.length) },
      { label: "Saldo total", value: formatCurrency(totalBalance) },
      { label: "Valor original", value: formatCurrency(totalOriginal) },
    ],
    columns: [
      { key: "sale", label: "Venda", value: (r) => (r as unknown as CredAccRow).sales?.number ?? "—" },
      { key: "customer", label: "Cliente", value: (r) => (r as unknown as CredAccRow).customers?.name ?? "—" },
      { key: "opened_at", label: "Abertura", value: (r) => fmtDate((r as unknown as CredAccRow).opened_at) },
      { key: "due_date", label: "Vencimento", value: (r) => fmtDate((r as unknown as CredAccRow).due_date) },
      { key: "original_amount", label: "Original", align: "right", value: (r) => formatCurrency(num((r as unknown as CredAccRow).original_amount)) },
      { key: "paid_amount", label: "Recebido", align: "right", value: (r) => formatCurrency(num((r as unknown as CredAccRow).paid_amount)) },
      { key: "balance", label: "Saldo", align: "right", value: (r) => formatCurrency(num((r as unknown as CredAccRow).balance)) },
      { key: "status", label: "Status" },
    ],
    rows: rows as unknown as Record<string, unknown>[],
    emptyLabel: "Nenhuma conta em aberto.",
  };
}

async function loadCrediarioAtrasados(ctx: ReportContext): Promise<ReportResult> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("credit_installments")
    .select("id, account_id, installment_number, due_date, amount, paid_amount, status, credit_accounts!inner(company_id, sale_id, customer_id, customers(name), sales(number))")
    .eq("credit_accounts.company_id", ctx.companyId)
    .in("status", ["pending", "partially_paid", "overdue"])
    .lt("due_date", today);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{
    id: string; installment_number: number; due_date: string;
    amount: number | string; paid_amount: number | string; status: string;
    credit_accounts: { sales?: { number: string | null } | null; customers?: { name: string | null } | null };
  }>;
  const totalDue = rows.reduce((s, r) => s + Math.max(0, num(r.amount) - num(r.paid_amount)), 0);
  return {
    kpis: [
      { label: "Parcelas em atraso", value: formatNumber(rows.length) },
      { label: "Total em atraso", value: formatCurrency(totalDue) },
    ],
    columns: [
      { key: "sale", label: "Venda", value: (r) => (r as unknown as typeof rows[number]).credit_accounts.sales?.number ?? "—" },
      { key: "customer", label: "Cliente", value: (r) => (r as unknown as typeof rows[number]).credit_accounts.customers?.name ?? "—" },
      { key: "installment_number", label: "Parcela", align: "right" },
      { key: "due_date", label: "Vencimento", value: (r) => fmtDate((r as unknown as typeof rows[number]).due_date) },
      { key: "amount", label: "Valor", align: "right", value: (r) => formatCurrency(num((r as unknown as typeof rows[number]).amount)) },
      { key: "paid_amount", label: "Recebido", align: "right", value: (r) => formatCurrency(num((r as unknown as typeof rows[number]).paid_amount)) },
      { key: "open", label: "Em aberto", align: "right", value: (r) => formatCurrency(Math.max(0, num((r as unknown as typeof rows[number]).amount) - num((r as unknown as typeof rows[number]).paid_amount))) },
      { key: "status", label: "Status" },
    ],
    rows: rows as unknown as Record<string, unknown>[],
    emptyLabel: "Nenhuma parcela em atraso.",
  };
}

async function loadCrediarioParcelas(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("credit_installments")
    .select("id, installment_number, due_date, amount, paid_amount, status, credit_accounts!inner(company_id, sales(number), customers(name))")
    .eq("credit_accounts.company_id", ctx.companyId)
    .gte("due_date", ctx.range.from)
    .lte("due_date", ctx.range.to)
    .order("due_date", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{
    id: string; installment_number: number; due_date: string;
    amount: number | string; paid_amount: number | string; status: string;
    credit_accounts: { sales?: { number: string | null } | null; customers?: { name: string | null } | null };
  }>;
  const total = rows.reduce((s, r) => s + num(r.amount), 0);
  const paid = rows.reduce((s, r) => s + num(r.paid_amount), 0);
  return {
    kpis: [
      { label: "Parcelas", value: formatNumber(rows.length) },
      { label: "Valor previsto", value: formatCurrency(total) },
      { label: "Recebido", value: formatCurrency(paid) },
    ],
    columns: [
      { key: "sale", label: "Venda", value: (r) => (r as unknown as typeof rows[number]).credit_accounts.sales?.number ?? "—" },
      { key: "customer", label: "Cliente", value: (r) => (r as unknown as typeof rows[number]).credit_accounts.customers?.name ?? "—" },
      { key: "installment_number", label: "Parcela", align: "right" },
      { key: "due_date", label: "Vencimento", value: (r) => fmtDate((r as unknown as typeof rows[number]).due_date) },
      { key: "amount", label: "Valor", align: "right", value: (r) => formatCurrency(num((r as unknown as typeof rows[number]).amount)) },
      { key: "paid_amount", label: "Recebido", align: "right", value: (r) => formatCurrency(num((r as unknown as typeof rows[number]).paid_amount)) },
      { key: "status", label: "Status" },
    ],
    rows: rows as unknown as Record<string, unknown>[],
    emptyLabel: "Sem parcelas no período.",
  };
}

async function loadCrediarioRecebimentos(ctx: ReportContext): Promise<ReportResult> {
  const { data, error } = await supabase
    .from("credit_payments")
    .select("id, amount, payment_method, paid_at, notes, credit_accounts!inner(company_id, sales(number), customers(name))")
    .eq("credit_accounts.company_id", ctx.companyId)
    .gte("paid_at", ctx.range.from)
    .lte("paid_at", ctx.range.to)
    .order("paid_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{
    id: string; amount: number | string; payment_method: string | null; paid_at: string | null; notes: string | null;
    credit_accounts: { sales?: { number: string | null } | null; customers?: { name: string | null } | null };
  }>;
  const total = rows.reduce((s, r) => s + num(r.amount), 0);
  return {
    kpis: [
      { label: "Pagamentos", value: formatNumber(rows.length) },
      { label: "Total recebido", value: formatCurrency(total) },
    ],
    columns: [
      { key: "paid_at", label: "Data", value: (r) => fmtDateTime((r as unknown as typeof rows[number]).paid_at) },
      { key: "sale", label: "Venda", value: (r) => (r as unknown as typeof rows[number]).credit_accounts.sales?.number ?? "—" },
      { key: "customer", label: "Cliente", value: (r) => (r as unknown as typeof rows[number]).credit_accounts.customers?.name ?? "—" },
      { key: "payment_method", label: "Forma" },
      { key: "amount", label: "Valor", align: "right", value: (r) => formatCurrency(num((r as unknown as typeof rows[number]).amount)) },
      { key: "notes", label: "Observação" },
    ],
    rows: rows as unknown as Record<string, unknown>[],
    emptyLabel: "Sem recebimentos no período.",
  };
}

async function loadCrediarioClientes(ctx: ReportContext): Promise<ReportResult> {
  const accounts = (await fetchCreditAccounts(ctx.companyId)).filter(
    (r) => r.status === "open" || r.status === "partially_paid",
  );
  const map = new Map<string, { customer: string; accounts: number; balance: number; original: number }>();
  for (const a of accounts) {
    const key = a.customer_id ?? "—";
    const cur = map.get(key) ?? { customer: a.customers?.name ?? "—", accounts: 0, balance: 0, original: 0 };
    cur.accounts += 1;
    cur.balance += num(a.balance);
    cur.original += num(a.original_amount);
    map.set(key, cur);
  }
  const rows = Array.from(map.values()).sort((a, b) => b.balance - a.balance);
  const total = rows.reduce((s, r) => s + r.balance, 0);
  return {
    kpis: [
      { label: "Clientes com saldo", value: formatNumber(rows.length) },
      { label: "Saldo total", value: formatCurrency(total) },
    ],
    columns: [
      { key: "customer", label: "Cliente" },
      { key: "accounts", label: "Contas", align: "right" },
      { key: "original", label: "Valor original", align: "right", value: (r) => formatCurrency(num((r as unknown as typeof rows[number]).original)) },
      { key: "balance", label: "Saldo devedor", align: "right", value: (r) => formatCurrency(num((r as unknown as typeof rows[number]).balance)) },
    ],
    rows: rows as unknown as Record<string, unknown>[],
    emptyLabel: "Nenhum cliente com saldo em aberto.",
  };
}

/* ---------------- REGISTRY ---------------- */


export const REPORTS: ReportDefinition[] = [
  // Comercial
  { id: "vendas-periodo", category: "comercial", title: "Vendas por período", description: "Listagem de vendas emitidas no período.", icon: Receipt, filename: "vendas-periodo", load: loadVendasPeriodo },
  { id: "produtos-vendidos", category: "comercial", title: "Produtos vendidos", description: "Itens vendidos no período com receita.", icon: Package, filename: "produtos-vendidos", load: loadProdutosVendidos },
  { id: "ticket-medio", category: "comercial", title: "Ticket médio", description: "Ticket médio diário.", icon: TrendingUp, filename: "ticket-medio", load: loadTicketMedio },
  { id: "ranking-produtos", category: "comercial", title: "Ranking de produtos", description: "Top produtos por receita.", icon: Award, filename: "ranking-produtos", load: loadRankingProdutos },
  { id: "ranking-clientes", category: "comercial", title: "Ranking de clientes", description: "Top clientes por receita.", icon: Star, filename: "ranking-clientes", load: loadRankingClientes },
  { id: "ranking-vendedores", category: "comercial", title: "Ranking de vendedores", description: "Vendedores com mais vendas.", icon: UserCheck, filename: "ranking-vendedores", load: loadRankingVendedores },
  { id: "produtos-sem-venda", category: "comercial", title: "Produtos sem venda", description: "Produtos sem venda no período.", icon: PackageX, filename: "produtos-sem-venda", load: loadProdutosSemVenda },

  // Financeiro
  { id: "contas-receber", category: "financeiro", title: "Contas a receber", description: "Títulos pendentes e vencidos.", icon: ArrowDownRight, filename: "contas-receber", load: loadContasReceber },
  { id: "contas-pagar", category: "financeiro", title: "Contas a pagar", description: "Obrigações pendentes e vencidas.", icon: ArrowUpRight, filename: "contas-pagar", load: loadContasPagar },
  { id: "fluxo-caixa", category: "financeiro", title: "Fluxo de caixa", description: "Entradas x saídas por dia.", icon: PieChart, filename: "fluxo-caixa", load: loadFluxoCaixa },
  { id: "recebimentos", category: "financeiro", title: "Recebimentos", description: "Recebimentos confirmados no período.", icon: Wallet, filename: "recebimentos", load: loadRecebimentos },
  { id: "pagamentos", category: "financeiro", title: "Pagamentos", description: "Pagamentos efetuados no período.", icon: DollarSign, filename: "pagamentos", load: loadPagamentos },
  { id: "resultado-periodo", category: "financeiro", title: "Resultado do período", description: "Receitas e despesas por categoria.", icon: BarChart3, filename: "resultado-periodo", load: loadResultadoPeriodo },

  // Estoque
  { id: "estoque-atual", category: "estoque", title: "Estoque atual", description: "Posição consolidada de estoque.", icon: Boxes, filename: "estoque-atual", load: loadEstoqueAtual },
  { id: "estoque-critico", category: "estoque", title: "Estoque crítico", description: "Produtos abaixo do mínimo.", icon: PackageX, filename: "estoque-critico", load: loadEstoqueCritico },
  { id: "giro-estoque", category: "estoque", title: "Giro de estoque", description: "Rotatividade no período.", icon: Repeat, filename: "giro-estoque", load: loadGiroEstoque },
  { id: "inventario", category: "estoque", title: "Inventário / movimentações", description: "Movimentações de estoque no período.", icon: ClipboardList, filename: "inventario", load: loadInventario },
  { id: "valor-estoque", category: "estoque", title: "Valor do estoque", description: "Valorização por produto e categoria.", icon: Banknote, filename: "valor-estoque", load: loadValorEstoque },
  { id: "sem-movimentacao", category: "estoque", title: "Produtos sem movimentação", description: "Estoque parado no período.", icon: PackageX, filename: "sem-movimentacao", load: loadSemMovimentacao },

  // Produtos
  { id: "cadastro-produtos", category: "produtos", title: "Cadastro completo", description: "Base completa de produtos.", icon: FileText, filename: "cadastro-produtos", load: loadCadastroProdutos },
  { id: "curva-abc", category: "produtos", title: "Curva ABC", description: "Classificação por participação na receita.", icon: BarChart3, filename: "curva-abc", load: loadCurvaABC },
  { id: "margens", category: "produtos", title: "Margens", description: "Margem por produto.", icon: TrendingUp, filename: "margens", load: loadMargens },
  { id: "custos", category: "produtos", title: "Custos", description: "Composição de custos por produto.", icon: DollarSign, filename: "custos", load: loadCustos },
  { id: "politicas-preco", category: "produtos", title: "Políticas de preço", description: "Políticas ativas por escopo.", icon: Sparkles, filename: "politicas-preco", load: loadPoliticasPreco },
  { id: "precificacao", category: "produtos", title: "Precificação", description: "Confira a formação de preço dos produtos: custos, margem, lucro e preço de venda.", icon: TrendingUp, filename: "precificacao", load: async () => ({ columns: [], rows: [] }) },

  // Catálogos
  { id: "catalogo-produtos", category: "catalogos", title: "Tabela de Precificação (Interno)", description: "Conferência gerencial de custo, margem, lucro e preço.", icon: ClipboardList, filename: "precificacao-interno", load: async () => ({ columns: [], rows: [] }) },
  { id: "catalogo-comercial", category: "catalogos", title: "Catálogo Comercial", description: "Catálogo premium para apresentação aos clientes: capa institucional, 6 produtos por página e visual estilo lookbook.", icon: Sparkles, filename: "catalogo-comercial", load: async () => ({ columns: [], rows: [] }) },


  // Clientes
  { id: "clientes-ativos", category: "clientes", title: "Clientes ativos", description: "Base ativa de clientes.", icon: UserCheck, filename: "clientes-ativos", load: loadClientesAtivos },
  { id: "clientes-inativos", category: "clientes", title: "Clientes inativos", description: "Sem interação nos últimos 90 dias.", icon: UserX, filename: "clientes-inativos", load: loadClientesInativos },
  { id: "clientes-novos", category: "clientes", title: "Novos clientes", description: "Novos cadastros no período.", icon: UserPlus, filename: "clientes-novos", load: loadClientesNovos },
  { id: "aniversariantes", category: "clientes", title: "Aniversariantes", description: "Aniversariantes no período selecionado.", icon: Gift, filename: "aniversariantes", load: loadAniversariantes },
  { id: "clientes-vip", category: "clientes", title: "Clientes VIP", description: "Clientes com alta recorrência ou receita.", icon: Star, filename: "clientes-vip", load: loadClientesVIP },

  // Compras
  { id: "compras-periodo", category: "compras", title: "Compras por período", description: "Pedidos de compra no período.", icon: ShoppingBag, filename: "compras-periodo", load: loadComprasPeriodo },
  { id: "compras-fornecedores", category: "compras", title: "Fornecedores", description: "Fornecedores com maior volume.", icon: Truck, filename: "compras-fornecedores", load: loadFornecedores },
  { id: "compras-produtos", category: "compras", title: "Produtos comprados", description: "Itens adquiridos no período.", icon: Package, filename: "compras-produtos", load: loadProdutosComprados },
  { id: "compras-pendentes", category: "compras", title: "Pedidos pendentes", description: "Pedidos abertos e aguardando recebimento.", icon: CalendarClock, filename: "compras-pendentes", load: loadPedidosPendentes },

  // Caixa
  { id: "caixa-aberturas", category: "caixa", title: "Aberturas de caixa", description: "Sessões abertas no período.", icon: Calendar, filename: "caixa-aberturas", load: (ctx) => loadCaixaSessoes(ctx, { status: "open" }) },
  { id: "caixa-fechamentos", category: "caixa", title: "Fechamentos", description: "Sessões fechadas no período.", icon: CalendarDays, filename: "caixa-fechamentos", load: (ctx) => loadCaixaSessoes(ctx, { status: "closed" }) },
  { id: "caixa-sangrias", category: "caixa", title: "Sangrias", description: "Retiradas de caixa.", icon: ArrowUpRight, filename: "caixa-sangrias", load: (ctx) => loadCaixaMovimentos(ctx, "cash_out") },
  { id: "caixa-suprimentos", category: "caixa", title: "Suprimentos", description: "Reforços de caixa.", icon: ArrowDownRight, filename: "caixa-suprimentos", load: (ctx) => loadCaixaMovimentos(ctx, "cash_in") },
  { id: "caixa-divergencias", category: "caixa", title: "Divergências", description: "Sessões com diferença no fechamento.", icon: ListChecks, filename: "caixa-divergencias", load: loadCaixaDivergencias },

  // Bella Pay
  { id: "bellapay-cobrancas", category: "bella_pay", title: "Cobranças", description: "Todas as cobranças no período.", icon: Receipt, filename: "bellapay-cobrancas", load: (ctx) => loadBellaPayCharges(ctx) },
  { id: "bellapay-pix", category: "bella_pay", title: "PIX", description: "Cobranças PIX.", icon: Zap, filename: "bellapay-pix", load: (ctx) => loadBellaPayCharges(ctx, { billingType: "PIX" }) },
  { id: "bellapay-cartoes", category: "bella_pay", title: "Cartões", description: "Cobranças por cartão.", icon: CreditCard, filename: "bellapay-cartoes", load: (ctx) => loadBellaPayCharges(ctx, { billingType: "CREDIT_CARD" }) },
  { id: "bellapay-links", category: "bella_pay", title: "Links de pagamento", description: "Boletos e links UNDEFINED/BOLETO.", icon: LinkIcon, filename: "bellapay-links", load: (ctx) => loadBellaPayCharges(ctx, { billingType: "UNDEFINED" }) },
  { id: "bellapay-pendentes", category: "bella_pay", title: "Pagamentos pendentes", description: "Cobranças aguardando pagamento.", icon: CalendarClock, filename: "bellapay-pendentes", load: (ctx) => loadBellaPayCharges(ctx, { status: ["PENDING", "AWAITING_RISK_ANALYSIS"] }) },
  { id: "bellapay-confirmados", category: "bella_pay", title: "Pagamentos confirmados", description: "Cobranças pagas / recebidas.", icon: Wallet, filename: "bellapay-confirmados", load: (ctx) => loadBellaPayCharges(ctx, { status: ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"] }) },
  { id: "bellapay-estornos", category: "bella_pay", title: "Estornos", description: "Cobranças estornadas ou em disputa.", icon: RotateCcw, filename: "bellapay-estornos", load: loadBellaPayEstornos },

  // Crediário
  { id: "crediario-abertos", category: "crediario", title: "Contas em aberto", description: "Todas as contas de crediário com saldo em aberto.", icon: HandCoins, filename: "crediario-abertos", load: loadCrediarioAbertos },
  { id: "crediario-atrasados", category: "crediario", title: "Contas em atraso", description: "Contas com parcelas vencidas e não pagas.", icon: CalendarClock, filename: "crediario-atrasados", load: loadCrediarioAtrasados },
  { id: "crediario-parcelas", category: "crediario", title: "Parcelas do período", description: "Parcelas de crediário com vencimento no período.", icon: ClipboardList, filename: "crediario-parcelas", load: loadCrediarioParcelas },
  { id: "crediario-recebimentos", category: "crediario", title: "Recebimentos", description: "Pagamentos recebidos no crediário no período.", icon: Wallet, filename: "crediario-recebimentos", load: loadCrediarioRecebimentos },
  { id: "crediario-clientes", category: "crediario", title: "Ranking de clientes", description: "Clientes com maior saldo devedor no crediário.", icon: Star, filename: "crediario-clientes", load: loadCrediarioClientes },
];

export function reportsByCategory(id: ReportCategoryId): ReportDefinition[] {
  return REPORTS.filter((r) => r.category === id);
}
