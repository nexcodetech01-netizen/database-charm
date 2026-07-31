/**
 * Shared, cross-feature TypeScript types.
 * Feature-specific types live under src/features/<feature>/types.ts.
 */

export type ID = string;

export interface Timestamps {
  created_at: string;
  updated_at: string;
}

export type Nullable<T> = T | null;

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type AsyncStatus = "idle" | "loading" | "success" | "error";
