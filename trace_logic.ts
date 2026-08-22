import { loadCollectionPagePayload } from "./src/features/catalog/lib/load-collection-page.server";

async function trace() {
  const slug = "tg-style-catalogue";
  // The loadCollectionPagePayload uses supabaseAdmin internally.
  // We need to see if we can run it here.
  // It imports it dynamically: const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  
  try {
    const result = await loadCollectionPagePayload({ slug, isPreview: false });
    console.log("RESULT:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("FATAL ERROR:", e);
  }
}

trace();
