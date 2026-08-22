import { loadCollectionPagePayload } from "./src/features/catalog/lib/load-collection-page.server";

async function run() {
  const result = await loadCollectionPagePayload({ 
    slug: 'tg-style-catalogue', 
    isPreview: false 
  });
  
  if (result.ok) {
    console.log(JSON.stringify(result.payload.products.map(p => ({ 
        id: p.id, 
        name: p.name, 
        category: p.category_name 
    })), null, 2));
  } else {
    console.error("Error loading collection:", result.error);
  }
}

run();
