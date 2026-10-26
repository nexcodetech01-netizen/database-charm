/** Eventos medidos no catálogo público. */
export const CATALOG_EVENTS = ["collection_view", "product_view", "whatsapp_click"] as const;
export type CatalogEventType = (typeof CATALOG_EVENTS)[number];
