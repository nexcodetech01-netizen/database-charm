# Integration Plan: NexOS → n8n Catalog Orders

Implementation of a secondary egress integration to send confirmed catalog orders to n8n.

## Proposed Changes

### Backend Integration
- Modify `src/features/whatsapp/inbound/commercial-inbox.server.ts` to include a new helper function `notifyN8NConfirmedOrder`.
- This function will:
  - Read `N8N_WEBHOOK_SECRET` from environment variables.
  - Construct the payload using data from `CommercialTicketDraft`.
  - Send a POST request to `https://ugc.nexxcode.com.br/webhook/f273ba04-bb25-47bf-bfd3-51cfb7526223`.
  - Include an `Authorization: Bearer ${SECRET}` header.
  - Use a 10-second timeout.
  - Silently log errors without exposing the secret or blocking the main flow.
- Call `notifyN8NConfirmedOrder` inside `recordConfirmedOrder` after the ticket is successfully created.

### Technical Details
- **Idempotency**: Uses `catalog-${ticketId}` as `event_id`.
- **Secret Management**: Requires `N8N_WEBHOOK_SECRET` to be set in the environment.
- **Safety**: Errors in the fetch call are caught and logged; they do not propagate or interrupt the order confirmation.

## Verification Plan

### Automated Tests
- Run `bun tsgo` to ensure no type errors are introduced.
- Run `bun build` to verify the project builds correctly.

### Manual Verification
- Verify that the `N8N_WEBHOOK_SECRET` is checked correctly.
- Ensure the payload structure matches the request exactly.
