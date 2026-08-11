# Plan: Remove Hardcoded Offline Response and Correct WhatsApp Inbound Flow

The user wants to remove the automatic "offline mode" response in the WhatsApp webhook/inbound flow and ensure that if the AI (Bella) is paused or an error occurs, no generic automatic messages are sent to the customer.

## Technical Details

1.  **Remove Hardcoded Response in `MockProvider.ts`**:
    *   Locate the "Recebi sua mensagem: ..." string in `src/features/bella-ai/ai/providers/MockProvider.ts`.
    *   Modify the `chat` method to return an empty string or a specific marker that indicates no response should be sent, or better yet, handle this at the Gateway/Router level.

2.  **Adjust `router.server.ts` Flow**:
    *   In `src/features/whatsapp/inbound/router.server.ts`, specifically the `processOneMessage` function.
    *   Update the engine processing block:
        *   If `bellaAIGateway.chat` returns a result from the `mock` provider (which means fallback was used), DO NOT send a message to the customer.
        *   In the `catch` block where a generic error message is currently set, remove the assignment of the error message to `response.description` and ensure no `sendWhatsAppText` is called if it's an error state.
    *   Ensure that messages are still recorded in the database and notified to the operator via the existing persistence logic.

3.  **Refine `BellaAIGateway.ts`**:
    *   Ensure the gateway correctly reports when a fallback (Mock) is used so the caller can decide whether to skip the outgoing message.

## Steps

### Backend
1.  **Modify `src/features/bella-ai/ai/providers/MockProvider.ts`**:
    *   Change the default response to an empty string or null-like value to signal "no AI response".

2.  **Modify `src/features/whatsapp/inbound/router.server.ts`**:
    *   In the engine processing section (around line 795):
        *   Check if the `ai.provider === 'mock'`. If so, treat it as a silent failure (no response sent).
    *   In the `catch` block (around line 812):
        *   Remove the generic "Não consegui processar" title/description.
        *   Set a flag or handle it so that `sendWhatsAppText` is skipped.
    *   Update the logic around line 850 (`sendWhatsAppText`) to only execute if a valid response exists and it's not a mock/error fallback.

3.  **Verify**:
    *   The inbound message should still be saved to `whatsapp_messages`.
    *   The `whatsapp_conversations` should still be updated (unread count, last inbound).
    *   No `outbound` message should be sent to WhatsApp or saved to the DB if AI is offline/errored.
