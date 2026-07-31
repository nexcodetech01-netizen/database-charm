/**
 * EventDetector — contrato leve para detectores agendados.
 *
 * Um Detector recebe um snapshot já buscado pelos módulos existentes
 * (KPIs, listas, agregados) e devolve `EmitNexosEventInput[]`.
 * Não acessa banco diretamente e não altera estado — apenas produz
 * eventos que o `EventEngine.emit()` publica.
 */
import type { EmitNexosEventInput, NexosEventType } from "./types";

export interface DetectorRunContext {
  companyId: string;
  now: Date;
}

export interface NexosEventDetector<TInput = unknown> {
  id: string;
  handles: NexosEventType[];
  detect(input: TInput, ctx: DetectorRunContext): EmitNexosEventInput[];
}

class DetectorRegistryImpl {
  private detectors = new Map<string, NexosEventDetector>();
  register(det: NexosEventDetector): void {
    this.detectors.set(det.id, det);
  }
  list(): NexosEventDetector[] {
    return Array.from(this.detectors.values());
  }
  get(id: string): NexosEventDetector | undefined {
    return this.detectors.get(id);
  }
}

export const NexosEventDetectors = new DetectorRegistryImpl();
