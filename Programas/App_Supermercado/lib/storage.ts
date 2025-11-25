import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  market_id?: string;
  barcode?: string;
  checked?: boolean;
  created_at: string;
}

export interface Market {
  id: string;
  name: string;
  location?: string;
  created_at: string;
}

export interface Purchase {
  id: string;
  market_id?: string;
  market_name?: string;
  total_amount: number;
  items_count: number;
  completed_at: string;
  items: PurchaseItem[];
  archived?: boolean;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  barcode?: string;
}

const STORAGE_KEYS = {
  ITEMS: '@shopping_items',
  MARKETS: '@markets',
  PURCHASES: '@purchases',
  SELECTED_MARKET: '@selected_market',
};

const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const storage = {
  async getItems(): Promise<ShoppingItem[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ITEMS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting items:', error);
      return [];
    }
  },

  async saveItems(items: ShoppingItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
    } catch (error) {
      console.error('Error saving items:', error);
      throw error;
    }
  },

  async addItem(item: Omit<ShoppingItem, 'id' | 'created_at'>): Promise<ShoppingItem> {
    const items = await this.getItems();
    const newItem: ShoppingItem = {
      ...item,
      id: generateId(),
      created_at: new Date().toISOString(),
    };
    items.unshift(newItem);
    await this.saveItems(items);
    return newItem;
  },

  async updateItem(id: string, updates: Partial<Omit<ShoppingItem, 'id' | 'created_at'>>): Promise<void> {
    const items = await this.getItems();
    const index = items.findIndex(item => item.id === id);

    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      await this.saveItems(items);
    }
  },

  async deleteItem(id: string): Promise<void> {
    const items = await this.getItems();
    const filtered = items.filter(item => item.id !== id);
    await this.saveItems(filtered);
  },

  async clearItems(): Promise<void> {
    await this.saveItems([]);
  },

  async getMarkets(): Promise<Market[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.MARKETS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting markets:', error);
      return [];
    }
  },

  async saveMarkets(markets: Market[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.MARKETS, JSON.stringify(markets));
    } catch (error) {
      console.error('Error saving markets:', error);
      throw error;
    }
  },

  async addMarket(market: Omit<Market, 'id' | 'created_at'>): Promise<Market> {
    const markets = await this.getMarkets();
    const newMarket: Market = {
      ...market,
      id: generateId(),
      created_at: new Date().toISOString(),
    };
    markets.push(newMarket);
    markets.sort((a, b) => a.name.localeCompare(b.name));
    await this.saveMarkets(markets);
    return newMarket;
  },

  async getSelectedMarket(): Promise<Market | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_MARKET);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting selected market:', error);
      return null;
    }
  },

  async setSelectedMarket(market: Market | null): Promise<void> {
    try {
      if (market) {
        await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_MARKET, JSON.stringify(market));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_MARKET);
      }
    } catch (error) {
      console.error('Error setting selected market:', error);
      throw error;
    }
  },

  async getPurchases(): Promise<Purchase[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PURCHASES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting purchases:', error);
      return [];
    }
  },

  async savePurchases(purchases: Purchase[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(purchases));
    } catch (error) {
      console.error('Error saving purchases:', error);
      throw error;
    }
  },

  async addPurchase(
    items: ShoppingItem[],
    market: Market | null,
    totalAmount: number
  ): Promise<Purchase> {
    const purchases = await this.getPurchases();
    const purchaseId = generateId();

    const purchaseItems: PurchaseItem[] = items.map(item => ({
      id: generateId(),
      purchase_id: purchaseId,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      barcode: item.barcode,
    }));

    const newPurchase: Purchase = {
      id: purchaseId,
      market_id: market?.id,
      market_name: market?.name,
      total_amount: totalAmount,
      items_count: items.length,
      completed_at: new Date().toISOString(),
      items: purchaseItems,
    };

    purchases.unshift(newPurchase);
    await this.savePurchases(purchases);
    return newPurchase;
  },

  async getUniqueItemNames(): Promise<string[]> {
    try {
      const purchases = await this.getPurchases();
      const itemNames = new Set<string>();

      purchases.forEach(purchase => {
        purchase.items.forEach(item => {
          itemNames.add(item.name.trim());
        });
      });

      return Array.from(itemNames).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      );
    } catch (error) {
      console.error('Error getting unique item names:', error);
      return [];
    }
  },

  async getLastItemPrice(itemName: string, marketId?: string): Promise<number | null> {
    try {
      const purchases = await this.getPurchases();
      const filteredPurchases = marketId
        ? purchases.filter(p => p.market_id === marketId)
        : purchases;

      for (const purchase of filteredPurchases) {
        const item = purchase.items.find(
          i => i.name.toLowerCase().trim() === itemName.toLowerCase().trim()
        );
        if (item) {
          return item.unit_price;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting last item price:', error);
      return null;
    }
  },

  async getItemByBarcode(barcode: string, marketId?: string): Promise<{ name: string; price: number } | null> {
    try {
      const purchases = await this.getPurchases();
      const filteredPurchases = marketId
        ? purchases.filter(p => p.market_id === marketId)
        : purchases;

      for (const purchase of filteredPurchases) {
        const item = purchase.items.find(i => i.barcode === barcode);
        if (item) {
          return {
            name: item.name,
            price: item.unit_price
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting item by barcode:', error);
      return null;
    }
  },

  async clearPurchases(): Promise<void> {
    await this.savePurchases([]);
  },

  async archivePurchase(id: string): Promise<void> {
    const purchases = await this.getPurchases();
    const updated = purchases.map(purchase =>
      purchase.id === id ? { ...purchase, archived: true } : purchase
    );
    await this.savePurchases(updated);
  },

  async getActivePurchases(): Promise<Purchase[]> {
    const purchases = await this.getPurchases();
    return purchases.filter(purchase => !purchase.archived);
  },

  async getAllPurchasesForReports(): Promise<Purchase[]> {
    return await this.getPurchases();
  },
};
