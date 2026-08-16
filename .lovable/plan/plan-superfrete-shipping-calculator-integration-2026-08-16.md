# Plan - SuperFrete Shipping Calculator Integration

Implement a standalone shipping calculator tools using the SuperFrete API, secured via a Supabase Edge Function.

## User Review Required

> [!IMPORTANT]
> The user must manually configure `SUPERFRETE_TOKEN` and `SUPERFRETE_ENV` in the Supabase Dashboard as environment variables (Secrets) for the Edge Function to work. I will provide the steps.

- **CEP Origem Padrão**: I will use a placeholder (e.g., `01001-000`) unless you provide a specific default ZIP code for your business.
- **Route**: Accessible at `/ferramentas/calculadora-frete`.

## Proposed Changes

### 1. Database & Security (Supabase Edge Function)
- Create `supabase/functions/superfrete-cotacao/index.ts`.
- Implementation:
  - Proxy request to `https://(sandbox|api).superfrete.com/api/v0/calculator`.
  - Use `SUPERFRETE_TOKEN` from environment variables.
  - Normalize response to a clean JSON array of shipping options.
  - Handle errors (invalid ZIP, timeout, API limits).

### 2. Backend & Features
- Create `src/features/shipping/services/shipping.functions.ts` to call the edge function using `createServerFn`.
- Create `src/features/shipping/types.ts` for Zod schemas and TypeScript interfaces.

### 3. Frontend & UI
- **New Route**: `src/routes/_authenticated/ferramentas.calculadora-frete.tsx`.
- **Form Component**: Fields for Origin ZIP, Destination ZIP, Weight (kg), Height, Width, Length (cm), and Declared Value.
- **Result Component**: Cards showing "Correios PAC/SEDEX", Price, and Estimated delivery days.
- **Navigation**: Add "Calculadora de Frete" to `AppSidebar.tsx` under a new "Ferramentas" group or existing "Inteligência" group.

### 4. Technical Details
- **API Version**: SuperFrete v0.
- **Framework**: TanStack Start v1 (React 19).
- **Styling**: Tailwind CSS v4 with Shadcn UI components.
- **Environment**: Support for `sandbox` and `production` modes via `SUPERFRETE_ENV`.

## Verification Plan

### Automated Tests
- Type-check validation for the new route and components.
- Mock the edge function response to test UI states (loading, success, error).

### Manual Verification
- Verify the form renders correctly and validates inputs (e.g., ZIP code format).
- Check the sidebar link works and points to the correct route.
- Confirm loading and error states are user-friendly.
