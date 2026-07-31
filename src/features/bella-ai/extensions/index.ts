/**
 * Bella Extension SDK — barrel público.
 *
 * Uso:
 *   import { ExtensionManager } from "@/features/bella-ai/extensions";
 *   await ExtensionManager.install(myExtension);
 */
export * from "./types";
export * from "./ExtensionManifest";
export * from "./ExtensionPermissions";
export * from "./ExtensionValidator";
export * from "./ExtensionRegistry";
export * from "./ExtensionContext";
export * from "./ExtensionLifecycle";
export * from "./ExtensionLoader";
export * from "./ExtensionManager";
