export * from "./types";
export { categoriesService, DuplicateCategoryError } from "./services/categories.service";
export type {
  DuplicateGroupRow,
  DuplicateGroupCategory,
  MergeResult,
} from "./services/categories.service";
export * from "./hooks/use-categories";
export * from "./lib/category-name-key";
export * from "./lib/merge-plan";
export { CategoryTable } from "./components/category-table";
export { CategoryFormDialog } from "./components/category-form-dialog";
export { CategoryManagerDialog } from "./components/category-manager-dialog";
export { CategoryStatusBadge } from "./components/category-status-badge";
export { CategoryDuplicatesPanel } from "./components/category-duplicates-panel";
export { CategoryIconGlyph, IconPicker, getCategoryIcon } from "./components/icon-picker";
export { ColorPicker } from "./components/color-picker";
