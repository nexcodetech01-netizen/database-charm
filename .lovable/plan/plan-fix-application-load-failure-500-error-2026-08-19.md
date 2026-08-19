# Plan - Fix Application Load Failure (500 Error)

The application is failing to load for the user, showing a "Something went wrong" error boundary. Diagnostics show that the server is healthy and the `bella-detectors` route fix is applied. The issue likely stems from a hydration mismatch or a failing fetch during the application boot process, specifically related to PWA initialization or version checking.

## Proposed Changes

### Core Logic (Server & Client)
- **Fix Side Effects in PWA Boot**: Refactor `src/lib/pwa-boot.ts` to ensure that all network-heavy or state-modifying operations are strictly gated behind hydration checks.
- **Sanitize Version Check**: Update `src/hooks/use-version-check.ts` to handle fetch failures gracefully, preventing a 500 error from a background check from crashing the main UI thread via the router's error boundary.
- **Root Layout Resilience**: Wrap PWA and Version Check hooks in `src/routes/__root.tsx` with defensive logic to ensure that a failure in these non-critical services does not prevent the application from rendering.

### Technical Details
- Use `useHydrated()` pattern to gate `pwa-boot` execution.
- Implement a global `fetch` wrapper with timeout and error handling for version checks.
- Add specific console logging to identify the exact failing resource in the PWA manifest flow.

## Verification Plan

### Automated Tests
- Run `check_pwa.py` script via Playwright to verify that `/?source=pwa` loads without console errors.
- Mock a 500 response for `/api/public/jobs/health` (used by version check) and verify the UI remains functional.

### Manual Verification
- Access the preview URL and confirm the Auth page loads without the "Something went wrong" screen.
- Verify that PWA registration logs appear in the console only after hydration.
