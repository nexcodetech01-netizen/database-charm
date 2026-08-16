/**
2:  * Sincronização entre abas/sessões para o Inbox Comercial.
3:  *
4:  * Utiliza BroadcastChannel para garantir que, se um usuário resolver um pedido
5:  * em uma aba, o contador de todas as outras abas abertas no mesmo navegador
6:  * seja atualizado instantaneamente, evitando redundância de notificações.
7:  */
8: 
9: export type InboxSyncMessage = 
10:   | { type: "CATALOG_ORDER_RECEIVED"; payload: { ticketId: string; buyerName: string; total: number } }
11:   | { type: "CATALOG_ORDER_RESOLVED"; payload: { ticketId: string } }
12:   | { type: "SYNC_COUNT"; payload: { count: number } };
13: 
14: const CHANNEL_NAME = "nexos:inbox-sync";
15: 
16: // Singleton para o canal de transmissão
17: let channel: BroadcastChannel | null = null;
18: 
19: export function getInboxChannel() {
20:   if (typeof window === "undefined") return null;
21:   if (!channel) {
22:     try {
23:       channel = new BroadcastChannel(CHANNEL_NAME);
24:     } catch (e) {
25:       console.warn("[InboxSync] BroadcastChannel não suportado neste navegador.");
26:     }
27:   }
28:   return channel;
29: }
30: 
31: export function broadcastInboxEvent(msg: InboxSyncMessage) {
32:   const ch = getInboxChannel();
33:   if (ch) {
34:     ch.postMessage(msg);
35:   }
36: }
