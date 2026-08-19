/**
 * Sincronização entre abas/sessões para o Inbox Comercial.
 *
 * Utiliza BroadcastChannel para garantir que, se um usuário resolver um pedido
 * em uma aba, o contador de todas as outras abas abertas no mesmo navegador
 * seja atualizado instantaneamente, evitando redundância de notificações.
 */
const CHANNEL_NAME = "nexos:inbox-sync";
// Singleton para o canal de transmissão
let channel = null;
export function getInboxChannel() {
    if (typeof window === "undefined")
        return null;
    if (!channel) {
        try {
            channel = new BroadcastChannel(CHANNEL_NAME);
        }
        catch (e) {
            console.warn("[InboxSync] BroadcastChannel não suportado neste navegador.");
        }
    }
    return channel;
}
export function broadcastInboxEvent(msg) {
    const ch = getInboxChannel();
    if (ch) {
        ch.postMessage(msg);
    }
}
