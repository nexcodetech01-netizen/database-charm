import { useQuery } from "@tanstack/react-query";
import { printerService } from "../services/printer.service";

/** Só a impressora "de reserva" (Bridge desligado quando a lista foi buscada). */
const onlyFallback = (list: { id?: string }[] | undefined) =>
  !!list && list.length > 0 && list.every((p) => String(p.id ?? "").includes("default-pdf"));

export function usePrinters() {
  const { data: printers = [], isLoading: loading } = useQuery({
    queryKey: ["printers"],
    queryFn: () => printerService.listPrinters(),
    staleTime: 30000,
    // Com o Bridge desligado a lista fica só com a reserva: tenta de novo a
    // cada 10 s, para as impressoras aparecerem assim que ele ligar.
    refetchInterval: (query) => (onlyFallback(query.state.data) ? 10_000 : false),
  });

  return { printers, loading };
}
