interface ProductInfo {
  name: string;
  source: string;
}

const API_SOURCES = [
  {
    name: 'Open Food Facts (Brasil)',
    url: (barcode: string) => `https://br.openfoodfacts.org/api/v2/product/${barcode}.json`,
  },
  {
    name: 'Open Food Facts (Mundial)',
    url: (barcode: string) => `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
  },
  {
    name: 'Open Beauty Facts (Mundial)',
    url: (barcode: string) => `https://world.openbeautyfacts.org/api/v2/product/${barcode}.json`,
  },
];

export const searchProductByBarcode = async (barcode: string): Promise<ProductInfo | null> => {
  for (const source of API_SOURCES) {
    try {
      console.log(`[DIAGNÓSTICO] Buscando em: ${source.name}`);
      const response = await fetch(source.url(barcode), {
        headers: {
          'User-Agent': 'ShoppingListApp/1.0 (seu-email@exemplo.com)',
        },
      });

      const json = await response.json();

      if (response.ok && json.status === 1 && json.product) {
        const product = json.product;
        const productName = product.product_name_pt || product.product_name || 'Nome não encontrado';
        
        if (productName !== 'Nome não encontrado') {
          console.log(`[DIAGNÓSTICO] Sucesso! Produto encontrado em: ${source.name}`);
          return { name: productName, source: source.name };
        }
      }
    } catch (error) {
      console.error(`[ERRO] Falha ao buscar em ${source.name}:`, error);
      // Continua para a próxima fonte
    }
  }

  console.log('[DIAGNÓSTICO] Produto não encontrado em nenhuma das fontes.');
  return null;
};