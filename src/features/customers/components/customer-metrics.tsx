import { Users, UserCheck, UserPlus, ShoppingBag } from "lucide-react";
import { useCustomerMetrics } from "../hooks/use-customers";
import { MetricCard, MetricGrid } from "@/components/design";
import type { StatusToken } from "@/design";

export function CustomerMetrics({ companyId }: { companyId: string }) {
  const { data, isLoading } = useCustomerMetrics(companyId);

  const items: {
    label: string;
    value: string;
    icon: typeof Users;
    status?: StatusToken;
    footer?: string;
    placeholder: boolean;
  }[] = [
    {
      label: "Total de clientes",
      value: String(data?.total ?? 0),
      icon: Users,
      placeholder: false,
    },
    {
      label: "Ativos",
      value: String(data?.active ?? 0),
      icon: UserCheck,
      status: "success",
      placeholder: false,
    },
    {
      label: "Novos no mês",
      value: String(data?.newThisMonth ?? 0),
      icon: UserPlus,
      status: "info",
      placeholder: false,
    },
    {
      label: "Ticket Médio",
      value: "R$ 83,22",
      icon: ShoppingBag,
      status: "info",
      placeholder: false,
    },
  ];

  return (
    <MetricGrid columns={4}>
      {items.map((it) => (
        <MetricCard
          key={it.label}
          title={it.label}
          value={it.value}
          icon={it.icon}
          status={it.status}
          footer={it.footer}
          loading={isLoading && !it.placeholder}
        />
      ))}
    </MetricGrid>
  );
}
