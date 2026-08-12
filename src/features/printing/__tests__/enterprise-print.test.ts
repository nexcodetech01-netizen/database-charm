import { describe, expect, it, vi, beforeEach } from "vitest";
import { printManager, printQueue } from "../services/print.service";
import { LabelData, PrintOptions } from "../types/printing.types";

// O serviço exige um Print Bridge físico online para confirmar a impressão
// (bloqueio intencional contra falha silenciosa — ver print.service.ts).
// Simulamos um bridge online e bem-sucedido para PDF, mas mantemos a falha
// para RAW (usada de propósito pelo teste de retry logic abaixo).
vi.mock("../services/print-bridge.registry", () => ({
  getPrintBridge: vi.fn(async () => ({
    health: vi.fn(async () => ({ status: "online" })),
    print: vi.fn(async (_label: LabelData, options: PrintOptions) => {
      if (options.strategy === "RAW") {
        return { success: false, message: "RAW não suportado pelo bridge simulado." };
      }
      return { success: true, jobId: "bridge-job-1" };
    }),
  })),
}));

describe("PrintManager Enterprise", () => {
  const mockLabel: LabelData = {
    id: "test-001",
    zpl: "^XA^FDTest^XZ",
    width: 4,
    height: 6
  };

  const mockOptions: PrintOptions = {
    strategy: "PDF",
    priority: "MEDIUM"
  };

  beforeEach(() => {
    // @ts-ignore - limpando estado global do singleton entre testes
    printQueue.__clear();
  });

  it("deve enfileirar um trabalho de impressão com sucesso", async () => {
    const result = await printManager.print(mockLabel, mockOptions);
    expect(result.success).toBe(true);
    expect(result.jobId).toBeDefined();
  });

  it("deve emitir eventos durante o ciclo de vida da impressão", async () => {
    const listener = vi.fn();
    printManager.subscribe(listener);

    await printManager.print(mockLabel, mockOptions);

    // Aguarda processamento (simulado com delay no service)
    await new Promise(resolve => setTimeout(resolve, 1500));

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      type: "PRINT_STARTED"
    }));
    
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      type: "PRINT_FINISHED"
    }));
  });

  it("deve gerenciar tentativas em caso de falha (Retry Logic)", async () => {
    const failLabel: LabelData = {
      id: "fail-test",
      zpl: "^XA^FAIL^XZ",
    };
    
    const failOptions: PrintOptions = {
      strategy: "RAW" // Estratégia RAW propositalmente configurada para falhar no mock atual
    };

    await printManager.print(failLabel, failOptions);

    // Aguarda o processamento e as tentativas (3 tentativas com delay)
    await new Promise(resolve => setTimeout(resolve, 3500));

    const history = printManager.getHistory();
    const failJob = history.find(j => j.label.id === "fail-test");
    
    expect(failJob).toBeDefined();
    expect(failJob?.status).toBe("FAILED");
    expect(failJob?.attempts).toBe(failJob?.maxAttempts || 3);
  });

  it("deve listar impressoras com capacidades Enterprise", async () => {
    const printers = await printManager.getPrinters();
    expect(printers.length).toBeGreaterThan(0);
    expect(printers[0].capabilities).toBeDefined();
    expect(printers[0].capabilities.supportsPdf).toBeDefined();
  });
});
