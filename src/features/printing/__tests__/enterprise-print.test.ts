import { describe, expect, it, vi } from "vitest";
import { printManager, printQueue } from "../services/print.service";
import { LabelData, PrintOptions } from "../types/printing.types";

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

  it("deve enfileirar um trabalho de impressão com sucesso", async () => {
    const result = await printManager.print(mockLabel, mockOptions);
    expect(result.success).toBe(true);
    expect(result.jobId).toBeDefined();
    
    // Aguarda um ciclo pequeno para garantir que o job entrou na fila
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const queue = printManager.getQueue();
    const history = printManager.getHistory();
    expect(history.length + queue.length).toBeGreaterThan(0);
  });

  it("deve emitir eventos durante o ciclo de vida da impressão", async () => {
    const listener = vi.fn();
    printManager.subscribe(listener);

    await printManager.print(mockLabel, mockOptions);

    // Aguarda processamento
    await new Promise(resolve => setTimeout(resolve, 1000));

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

    // Aguarda o processamento e as tentativas
    await new Promise(resolve => setTimeout(resolve, 2000));

    const history = printManager.getHistory();
    const failJob = history.find(j => j.label.id === "fail-test");
    
    expect(failJob).toBeDefined();
    expect(failJob?.status).toBe("FAILED");
    expect(failJob?.attempts).toBe(failJob?.maxAttempts);
  });

  it("deve listar impressoras com capacidades Enterprise", async () => {
    const printers = await printManager.getPrinters();
    expect(printers.length).toBeGreaterThan(0);
    expect(printers[0].capabilities).toBeDefined();
    expect(printers[0].capabilities.supportsPdf).toBeDefined();
  });
});
