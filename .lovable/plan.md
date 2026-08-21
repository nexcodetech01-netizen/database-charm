# Bella IA Architecture Correction Plan

Relocate all skill planning and execution to server-side functions to prevent "Skill not found" errors and client-side code leaks.

## Proposed Changes

### 1. Server-Side Execution Isolation
- Move all business logic execution into a dedicated server function `executeAgentActionFn`.
- Refactor `handleAgentRuntimeFn` to focus solely on **planning** (Intent detection -> Planning).
- Ensure `BellaSkillRegistry` is ONLY imported in `.server.ts` or inside server function handlers.
- Explicitly separate the `AgentResponse` into "Plan Proposal" and "Execution Result".

### 2. Implementation Steps

#### A. Backend Refactoring
- **`src/features/bella-ai/agent/runtime.functions.ts`**: 
    - Keep `handleAgentRuntimeFn` for planning.
    - Create `executeAgentActionFn` for execution.
- **`src/features/bella-ai/agent/agent.ts`**:
    - Ensure `runAgent` is called correctly from server functions.
    - Validate that `BellaSkillRegistry` is imported dynamically.
- **`src/features/bella-ai/agent/runtime.ts`**:
    - Clean up imports to ensure no server-side leak.
    - Add a check to prevent execution on the client (already exists, but reinforcement is good).

#### B. Frontend Refactoring
- **`src/features/bella-ai/components/bella-ask-panel.tsx`**:
    - Update to use `handleAgentRuntimeFn` for planning.
    - Update `handleActionConfirm` to call the new `executeAgentActionFn`.
    - Ensure it only receives serializable data.
- **`src/features/bella-ai/components/ActionCard.tsx`**:
    - Ensure it handles the new execution flow.

### 3. Verification Plan
- **Production Build**: Run `npm run build` to verify no client-side leaks.
- **Type Check**: Run `bunx tsgo` or `tsc --noEmit`.
- **Manual Test**: Test the "Altere o estoque..." flow.
    - Verify ActionCard appears.
    - Verify stock doesn't change before confirmation.
    - Verify stock changes correctly after confirmation.
    - Verify no "Skill not found" errors in the console.

## Technical Details
- **Safety**: `companyId` validation will be performed in both planning and execution server functions.
- **Idempotency**: Execution will include checks to prevent duplicate operations.
- **Serialization**: Use the existing `sanitize` utility to ensure all data sent to the client is serializable.
