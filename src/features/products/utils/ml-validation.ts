import { Product } from "../types";
import { DEFAULT_ML_SETTINGS } from "./ml-pricing";

export interface MercadoLivreRequirement {
  id: string;
  label: string;
  isValid: boolean;
  message: string;
  critical: boolean;
}

export interface MercadoLivreValidationResult {
  isValid: boolean;
  isReady: boolean; // Se cumpre todos os críticos
  requirements: MercadoLivreRequirement[];
  score: number; // 0-100
}

/**
 * Validação centralizada dos requisitos do Mercado Livre.
 * Usada tanto no ProductForm quanto no PublishToMercadoLivreDialog.
 */
export function validateMercadoLivreRequirements(
  product: Partial<Product> & { 
    selectedPhotoPaths?: string[];
    categoryId?: string;
    brand?: string;
    model?: string;
    listingType?: string;
    walletTarget?: number;
  }
): MercadoLivreValidationResult {
  const requirements: MercadoLivreRequirement[] = [];
  
  // 1. Título (Nome)
  const title = (product.name || "").trim();
  requirements.push({
    id: "title",
    label: "Título SEO",
    isValid: title.length >= 25 && title.length <= 60,
    message: title.length < 25 
      ? "Título muito curto (mínimo 25 caracteres para SEO)" 
      : title.length > 60 
        ? "Título muito longo (máximo 60 caracteres)"
        : "Título otimizado",
    critical: true,
  });

  // 2. Preço
  const price = Number(product.price || 0);
  requirements.push({
    id: "price",
    label: "Preço de Venda",
    isValid: price > 0,
    message: price > 0 ? "Preço definido" : "Preço deve ser maior que zero",
    critical: true,
  });

  // 3. Categoria
  const hasCategory = !!product.categoryId || !!product.category_id;
  requirements.push({
    id: "category",
    label: "Categoria ML",
    isValid: hasCategory,
    message: hasCategory ? "Categoria selecionada" : "Selecione uma categoria do Mercado Livre",
    critical: true,
  });

  // 4. Imagens
  const photoCount = product.selectedPhotoPaths?.length || 0;
  requirements.push({
    id: "photos",
    label: "Fotos (Mín. 1)",
    isValid: photoCount >= 1,
    message: photoCount >= 1 ? `${photoCount} foto(s) selecionada(s)` : "Adicione ao menos 1 foto",
    critical: true,
  });

  // 5. NCM
  const ncm = (product.ncm || "").trim();
  requirements.push({
    id: "ncm",
    label: "NCM Fiscal",
    isValid: ncm.length === 8,
    message: ncm.length === 8 ? "NCM válido" : "NCM deve ter 8 dígitos",
    critical: true,
  });

  // 6. Logística (Dimensões e Peso)
  const hasLogistics = 
    Number(product.weight || 0) > 0 && 
    Number(product.length || 0) > 0 && 
    Number(product.width || 0) > 0 && 
    Number(product.height || 0) > 0;
  
  requirements.push({
    id: "logistics",
    label: "Dados Logísticos",
    isValid: hasLogistics,
    message: hasLogistics ? "Dimensões e peso preenchidos" : "Informe peso e dimensões (C x L x A)",
    critical: false, // Pode publicar com defaults no backend, mas o formulário deve avisar
  });

  // 7. Marca e Modelo (Obrigatórios na maioria das categorias)
  const brand = (product.brand || "").trim();
  const model = (product.model || "").trim();
  requirements.push({
    id: "brand_model",
    label: "Marca e Modelo",
    isValid: brand.length > 0 && model.length > 0,
    message: brand.length > 0 && model.length > 0 
      ? "Marca e Modelo preenchidos" 
      : "Marca e Modelo são obrigatórios para a maioria das categorias",
    critical: false,
  });

  // 8. Validação de Preço e Frete (Fórmula Mercado Livre)
  if (product.listingType && product.price) {
    const isPremium = product.listingType === "gold_pro";
    const feePct = isPremium ? DEFAULT_ML_SETTINGS.premiumFeePercent : DEFAULT_ML_SETTINGS.classicFeePercent;
    const price = Number(product.price);
    const shipping = price >= DEFAULT_ML_SETTINGS.freeShippingThreshold ? DEFAULT_ML_SETTINGS.freeShippingValue : 0;
    const fixedFee = (!isPremium && price < DEFAULT_ML_SETTINGS.freeShippingThreshold && price > 0) ? DEFAULT_ML_SETTINGS.fixedFeeValue : 0;
    
    // Líquido esperado com base no preço atual
    const expectedNet = (price * (1 - feePct)) - shipping - fixedFee;

    requirements.push({
      id: "price_formula",
      label: "Fórmula de Preço",
      isValid: expectedNet > 0,
      message: expectedNet > 0 
        ? "Margem líquida positiva" 
        : "Preço insuficiente para cobrir taxas e frete",
      critical: true,
    });
  }

  const criticals = requirements.filter(r => r.critical);
  const isReady = criticals.every(r => r.isValid);
  const isValid = requirements.every(r => r.isValid);
  
  const score = Math.round(
    (requirements.filter(r => r.isValid).length / requirements.length) * 100
  );

  return {
    isValid,
    isReady,
    requirements,
    score,
  };
}
