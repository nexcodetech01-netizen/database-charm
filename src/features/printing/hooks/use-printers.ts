import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { printerService } from "../services/printer.service";
import { Printer } from "../types/printing.types";

export function usePrinters() {
  const { data: printers = [], isLoading: loading } = useQuery({
    queryKey: ["printers"],
    queryFn: () => printerService.listPrinters(),
    staleTime: 30000,
  });

  return { printers, loading };
}
