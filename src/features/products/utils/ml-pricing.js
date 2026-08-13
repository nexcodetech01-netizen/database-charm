export const DEFAULT_ML_SETTINGS = {
    freeShippingThreshold: 79.0,
    freeShippingValue: 24.65,
    fixedFeeValue: 6.5,
    classicFeePercent: 0.135,
    premiumFeePercent: 0.15,
};
/**
 * Calcula o preço final de venda para atingir um líquido desejado ("No Bolso").
 */
export function calculateMLFinalPrice(desiredNet, listingType, settings = DEFAULT_ML_SETTINGS) {
    if (desiredNet <= 0)
        return 0;
    const isPremium = listingType === "gold_pro";
    const feePct = isPremium ? settings.premiumFeePercent : settings.classicFeePercent;
    // No Premium, o frete grátis gatilha no threshold mas não tem taxa fixa extra (comprovado nas sprints anteriores).
    // No Clássico, abaixo do threshold tem taxa fixa e não tem frete grátis.
    // Tentativa 1: Assumindo que o preço final será >= threshold (com frete grátis)
    const shipping = settings.freeShippingValue;
    let finalWithShipping = (desiredNet + shipping) / (1 - feePct);
    // Se esse preço calculado for realmente >= threshold, ele é válido.
    if (finalWithShipping >= settings.freeShippingThreshold) {
        return Math.ceil(finalWithShipping * 100) / 100;
    }
    // Tentativa 2: Assumindo que o preço final será < threshold (sem frete grátis)
    // Mas no Clássico tem a taxa fixa. No Premium (gold_pro) não tem taxa fixa (regra da Sprint 7.1).
    const fixedFee = isPremium ? 0 : settings.fixedFeeValue;
    let finalWithoutShipping = (desiredNet + fixedFee) / (1 - feePct);
    // Se o preço calculado sem frete ainda assim for >= threshold, 
    // significa que caímos num limbo onde o frete grátis DEVE ser aplicado.
    // Mas como a tentativa 1 falhou (deu < threshold), isso não deve acontecer se os valores forem coerentes.
    return Math.ceil(finalWithoutShipping * 100) / 100;
}
/**
 * Calcula quanto o vendedor recebe ("Líquido") dado um preço final de venda.
 */
export function calculateMLNetValue(finalPrice, listingType, settings = DEFAULT_ML_SETTINGS) {
    if (finalPrice <= 0)
        return 0;
    const isPremium = listingType === "gold_pro";
    const feePct = isPremium ? settings.premiumFeePercent : settings.classicFeePercent;
    const shipping = finalPrice >= settings.freeShippingThreshold ? settings.freeShippingValue : 0;
    const fixedFee = (!isPremium && finalPrice < settings.freeShippingThreshold) ? settings.fixedFeeValue : 0;
    const net = (finalPrice * (1 - feePct)) - shipping - fixedFee;
    return Math.max(0, Math.round(net * 100) / 100);
}
