/**
 * Interface única `AIProvider`.
 *
 * O Gateway é o ÚNICO consumidor autorizado a receber implementações
 * concretas. Nenhuma Skill, Service, Action ou componente pode
 * importar diretamente `GeminiProvider`, `MockProvider`, etc.
 */
import type {
  AIProviderHealth,
  AIProviderId,
  AIRequest,
  AIResponse,
  AIResult,
} from "./types";

export interface AIProvider {
  readonly id: AIProviderId;
  readonly displayName: string;
  /** true quando há credenciais/config para operar de verdade. */
  isConfigured(): boolean;

  /**
   * Interpreta uma mensagem — deve devolver intent + parameters.
   * Providers podem reaproveitar `chat()` internamente.
   */
  interpret(request: AIRequest): Promise<AIResult>;

  /** Conversa livre — devolve o payload cru do provider. */
  chat(request: AIRequest): Promise<AIResponse>;

  /** Sondagem leve para monitoria/telemetria. */
  healthCheck(): Promise<AIProviderHealth>;
}
