# Plan: Architectural Fix for WhatsApp Checkout Routing Priority

The goal is to ensure that while a customer is in an active checkout flow (WAITING_PAYMENT_METHOD, WAITING_CUSTOMER_NAME, etc.), the checkout logic has maximum priority. The general intent router (which might interpret "dinheiro" as a financial query) must not intercept these messages.

## Technical Strategy

1.  **Prioritize Checkout in Router**: Modify `router.server.ts` to check for an active checkout session *before* any other intent detection (purchase intent, product search, recommendation, etc.).
2.  **Strict State Guard**: Ensure `handleCheckoutTurn` acts as a guard that swallows the message if a session is active, preventing it from reaching the general intent router or other skills.
3.  **Refine Payment Parsing**: Enhance `parsePayment` in `checkout-session.ts` to be more robust with normalization and broader mapping as requested.
4.  **Handoff Prevention**: Ensure that while in checkout, the general `isDataSubmissionIntent` (which triggers a human handoff) doesn't fire unless it's the intended conclusion of the flow.

## Implementation Details

### 1. `src/features/whatsapp/inbound/router.server.ts`
- Move the `handleCheckoutTurn` call to the very top of the message processing logic (after contact/conversation resolution).
- If `handleCheckoutTurn` returns a result (indicating an active session was handled), stop processing and send the response immediately.

### 2. `src/features/whatsapp/inbound/checkout-session.ts`
- Update `parsePayment` to handle "dinheiro", "espécie", "pix", "cartão", etc., with normalization (lowercase, accent removal).
- Update the `WAITING_PAYMENT_METHOD` handler to ensure it doesn't fall through to other logic if the input is ambiguous—instead, it should re-prompt for payment.

### 3. Verification
- Update `checkout-flow-repro.test.ts` to include a test case that simulates the "dinheiro" input specifically during the checkout phase to ensure it transitions to the name step.
- Verify that no financial skills are triggered.

## Proposed Changes

### `src/features/whatsapp/inbound/router.server.ts`
- Reorder turn handlers. `handleCheckoutTurn` will be the first "guard".

### `src/features/whatsapp/inbound/checkout-session.ts`
- Improve `parsePayment` regex and normalization.
- Adjust `advanceCheckout` logic for better state isolation.

---
**Note**: This is an architectural fix. We are not just adding keywords; we are changing the order of operations to give the Checkout State Guard absolute priority.
