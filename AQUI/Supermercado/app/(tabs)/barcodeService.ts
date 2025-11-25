interface ProductInfo {
  name: string;
  source: string;
}

interface ApiSource {
  name: string;
  url: (barcode: string) => string;
  headers?: { [key: string]: string };
  responseTransformer: (json: any) => string | null;
}

const API_SOURCES: ApiSource[] = [
  {
    name: 'Bluesoft Cosmos',
    url: (barcode: string) => `https://api.cosmos.bluesoft.com.br/gtins/${barcode}`,
    headers: {
      'X-Cosmos-Token': 'NWD2vep1Itfh7iH4yuYANg',
    },
    responseTransformer: (json: any) => {
      if (json.description) {
        return json.description;
      }
      return null;
    },
  },
  {
    name: 'Open Food Facts (Brasil)',
    url: (barcode: string) => `https://br.openfoodfacts.org/api/v2/product/${barcode}.json`,
    responseTransformer: (json: any) => {
      if (json.status === 1 && json.product) {
        return json.product.product_name_pt || json.product.product_name || null;
      }
      return null;
    },
  },
  {
    name: 'Open Food Facts (Mundial)',
    url: (barcode: string) => `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
    responseTransformer: (json: any) => {
      if (json.status === 1 && json.product) {
        return json.product.product_name_pt || json.product.product_name || null;
      }
      return null;
    },
  },
  {
    name: 'Open Beauty Facts (Mundial)',
    url: (barcode: string) => `https://world.openbeautyfacts.org/api/v2/product/${barcode}.json`,
    responseTransformer: (json: any) => {
      if (json.status === 1 && json.product) {
        return json.product.product_name_pt || json.product.product_name || null;
      }
      return null;
    },
  },
  {
    name: 'Open Products Facts (Mundial)',
    url: (barcode: string) => `https://world.openproductsfacts.org/api/v2/product/${barcode}.json`,
    responseTransformer: (json: any) => {
      if (json.status === 1 && json.product) {
        return json.product.product_name_pt || json.product.product_name || null;
      }
      return null;
    },
  },
];

export const searchProductByBarcode = async (barcode: string): Promise<ProductInfo | null> => {
  for (const source of API_SOURCES) {
    try {
      console.log(`[DIAGNÓSTICO] Buscando em: ${source.name}`);
      const response = await fetch(source.url(barcode), {
        headers: {
          'User-Agent': 'ShoppingListApp/1.0',
          ...(source.headers || {}),
        },
      });

      const json = await response.json();

      if (response.ok) {
        const productName = source.responseTransformer(json);
        if (productName) {
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
