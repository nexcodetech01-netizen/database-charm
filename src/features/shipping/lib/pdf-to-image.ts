/**
 * Converte a primeira página de um PDF (por URL) numa imagem PNG em
 * base64, pronta pra imprimir via `/print/image` do Print Bridge.
 *
 * NOTA: Esta implementação depende do pdfjs-dist que foi temporariamente removido
 * para estabilização do build. Em um ambiente real, este componente deve ser
 * carregado apenas no cliente via import dinâmico para evitar problemas de SSR
 * e dependências nativas (como 'canvas' no Node.js).
 */
export async function convertPdfToImage(pdfUrl: string): Promise<string> {
  // Mock temporário para permitir o build enquanto a dependência pdfjs-dist 
  // é tratada via import dinâmico em uma sprint futura.
  console.warn("convertPdfToImage: PDF conversion is temporarily mocked for build stabilization.");
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
}
