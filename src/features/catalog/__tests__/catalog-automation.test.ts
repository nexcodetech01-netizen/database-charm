import { productsService } from "../../products/services/products.service";
import { supabase } from "@/integrations/supabase/client";

/**
 * Teste de Integração: Automação de Catálogo
 * 
 * Verifica se um produto criado com o canal 'catalog' é automaticamente
 * vinculado à coleção principal 'tg-style-catalogue'.
 */
export async function testCatalogAutomation() {
  console.log("--- Testando Automação de Catálogo ---");
  
  const MAIN_COLLECTION_ID = 'd71d809c-83c6-499e-b2bc-ebfcb1df28af';
  
  // 1. Obter uma empresa e categoria válida para o teste
  const { data: company } = await supabase.from("companies").select("id").limit(1).single();
  if (!company?.id) throw new Error("Empresa não encontrada para teste");

  const { data: category } = await supabase.from("product_categories").select("id").eq("company_id", company.id).limit(1).single();
  
  if (!category?.id) {
    throw new Error("Ambiente de teste incompleto: empresa ou categoria não encontrada.");
  }

  const testSku = "TEST-CAT-" + Date.now();
  const testName = "Produto Teste Automação " + Date.now();

  try {
    // 2. Criar produto com canal 'catalog'
    console.log(`Criando produto de teste: ${testName}`);
    const product = await productsService.create({
      company_id: company.id,
      category_id: category.id,
      name: testName,
      sku: testSku,
      barcode: "TEST-" + Date.now(),
      price: 99.90,
      stock: 10,
      sales_channels: ["loja_fisica", "catalog"],
      status: "active",
      unit: "UN",
      brand: "Teste",
      model: "Automatizado"
    });

    console.log("Produto criado com ID:", product.id);

    // 3. Aguardar um pequeno intervalo para a importação dinâmica e execução da promessa fire-and-forget
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 4. Verificar se o vínculo foi criado na tabela product_collection_items
    const { data: item, error: itemError } = await supabase
      .from("product_collection_items")
      .select("id, collection_id")
      .eq("product_id", product.id)
      .eq("collection_id", MAIN_COLLECTION_ID)
      .maybeSingle();

    if (itemError) throw itemError;

    if (item) {
      console.log("✅ SUCESSO: Produto vinculado automaticamente à coleção", item.collection_id);
    } else {
      console.log("❌ FALHA: O vínculo automático com a coleção não foi encontrado.");
      throw new Error("Automação de catálogo falhou: vínculo não encontrado.");
    }

    // 5. Cleanup
    console.log("Limpando dados de teste...");
    await supabase.from("product_collection_items").delete().eq("product_id", product.id);
    await supabase.from("products").delete().eq("id", product.id);
    
    return true;
  } catch (err) {
    console.error("Erro no teste de automação:", err);
    throw err;
  }
}
