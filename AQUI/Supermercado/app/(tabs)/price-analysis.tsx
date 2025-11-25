import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { storage } from '@/lib/storage';
import { TrendingUp, TrendingDown, Minus, Store, Trash2, Building2, X, ChevronDown, Search, ScanBarcode } from 'lucide-react-native';
import BarcodeScanner from '@/components/BarcodeScanner';
import Watermark from '@/components/Watermark';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PriceVariation {
  productName: string;
  currentPrice: number;
  previousPrice: number;
  variation: number;
  variationPercent: number;
  marketName?: string;
  lastPurchaseDate: string;
}

interface MarketComparison {
  productName: string;
  markets: Array<{
    marketName: string;
    price: number;
    date: string;
    isCheapest: boolean;
    isMostExpensive: boolean;
  }>;
  priceDifference: number;
  savingsPercent: number;
}

interface Market {
  id: string;
  name: string;
}

interface ProductComparison {
  productName: string;
  market1Price: number;
  market2Price: number;
  difference: number;
  percentDiff: number;
  cheaperMarket: string;
  excluded: boolean;
}

export default function PriceAnalysisScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [priceVariations, setPriceVariations] = useState<PriceVariation[]>([]);
  const [marketComparisons, setMarketComparisons] = useState<MarketComparison[]>([]);
  const [viewMode, setViewMode] = useState<'variation' | 'comparison'>('variation');
  const [filter, setFilter] = useState<'all' | 'increased' | 'decreased'>('all');
  const [comparisonFilter, setComparisonFilter] = useState<'all' | 'cheaper' | 'expensive'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [availableMarkets, setAvailableMarkets] = useState<Market[]>([]);
  const [selectedMarket1, setSelectedMarket1] = useState<string | null>(null);
  const [selectedMarket2, setSelectedMarket2] = useState<string | null>(null);
  const [showMarket1Picker, setShowMarket1Picker] = useState(false);
  const [showMarket2Picker, setShowMarket2Picker] = useState(false);
  const [comparisonData, setComparisonData] = useState<ProductComparison[]>([]);
  const [scannerVisible, setScannerVisible] = useState(false);

  useEffect(() => {
    loadPriceAnalysis();
  }, []);

  useEffect(() => {
    if (selectedMarket1 && selectedMarket2) {
      compareMarkets();
    }
  }, [selectedMarket1, selectedMarket2]);

  const compareMarkets = async () => {
    try {
      const purchases = await storage.getActivePurchases();

      const market1Products = new Map<string, { price: number; date: string }>();
      const market2Products = new Map<string, { price: number; date: string }>();

      purchases.forEach(purchase => {
        if (purchase.market_id === selectedMarket1) {
          purchase.items.forEach(item => {
            const key = item.name.toLowerCase().trim();
            const existing = market1Products.get(key);
            if (!existing || new Date(purchase.completed_at) > new Date(existing.date)) {
              market1Products.set(key, {
                price: item.unit_price,
                date: purchase.completed_at,
              });
            }
          });
        }

        if (purchase.market_id === selectedMarket2) {
          purchase.items.forEach(item => {
            const key = item.name.toLowerCase().trim();
            const existing = market2Products.get(key);
            if (!existing || new Date(purchase.completed_at) > new Date(existing.date)) {
              market2Products.set(key, {
                price: item.unit_price,
                date: purchase.completed_at,
              });
            }
          });
        }
      });

      const comparisons: ProductComparison[] = [];

      market1Products.forEach((data1, productKey) => {
        const data2 = market2Products.get(productKey);
        if (data2) {
          const difference = data1.price - data2.price;
          const percentDiff = Math.abs((difference / Math.max(data1.price, data2.price)) * 100);
          const market1Name = availableMarkets.find(m => m.id === selectedMarket1)?.name || '';
          const market2Name = availableMarkets.find(m => m.id === selectedMarket2)?.name || '';

          comparisons.push({
            productName: productKey.charAt(0).toUpperCase() + productKey.slice(1),
            market1Price: data1.price,
            market2Price: data2.price,
            difference: Math.abs(difference),
            percentDiff,
            cheaperMarket: difference > 0 ? market2Name : market1Name,
            excluded: false,
          });
        }
      });

      comparisons.sort((a, b) => b.percentDiff - a.percentDiff);
      setComparisonData(comparisons);
    } catch (error) {
      console.error('Error comparing markets:', error);
    }
  };

  const loadPriceAnalysis = async () => {
    try {
      setLoading(true);

      const markets = await storage.getMarkets();
      setAvailableMarkets(markets);

      const purchases = await storage.getActivePurchases();

      if (markets.length >= 2 && !selectedMarket1 && !selectedMarket2) {
        setSelectedMarket1(markets[0].id);
        setSelectedMarket2(markets[1].id);
      }

      if (purchases.length < 2) {
        setPriceVariations([]);
        return;
      }

      const productPriceHistory: Record<string, Array<{
        price: number;
        date: string;
        marketName?: string;
      }>> = {};

      purchases.forEach(purchase => {
        purchase.items.forEach(item => {
          const key = item.name.toLowerCase().trim();
          if (!productPriceHistory[key]) {
            productPriceHistory[key] = [];
          }
          productPriceHistory[key].push({
            price: item.unit_price,
            date: purchase.completed_at,
            marketName: purchase.market_name,
          });
        });
      });

      const variations: PriceVariation[] = [];

      Object.entries(productPriceHistory).forEach(([productKey, history]) => {
        if (history.length < 2) return;

        history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const current = history[0];
        const previous = history[1];

        if (current.price !== previous.price) {
          const variation = current.price - previous.price;
          const variationPercent = ((variation / previous.price) * 100);

          variations.push({
            productName: productKey.charAt(0).toUpperCase() + productKey.slice(1),
            currentPrice: current.price,
            previousPrice: previous.price,
            variation,
            variationPercent,
            marketName: current.marketName,
            lastPurchaseDate: current.date,
          });
        }
      });

      variations.sort((a, b) => Math.abs(b.variationPercent) - Math.abs(a.variationPercent));

      setPriceVariations(variations);

      const comparisons: MarketComparison[] = [];

      Object.entries(productPriceHistory).forEach(([productKey, history]) => {
        const marketPrices = new Map<string, { price: number; date: string }>();

        history.forEach(entry => {
          if (entry.marketName) {
            const existing = marketPrices.get(entry.marketName);
            if (!existing || new Date(entry.date) > new Date(existing.date)) {
              marketPrices.set(entry.marketName, {
                price: entry.price,
                date: entry.date,
              });
            }
          }
        });

        if (marketPrices.size >= 2) {
          const prices = Array.from(marketPrices.values()).map(m => m.price);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const priceDifference = maxPrice - minPrice;
          const savingsPercent = ((priceDifference / maxPrice) * 100);

          const markets = Array.from(marketPrices.entries()).map(([name, data]) => ({
            marketName: name,
            price: data.price,
            date: data.date,
            isCheapest: data.price === minPrice,
            isMostExpensive: data.price === maxPrice,
          }));

          markets.sort((a, b) => a.price - b.price);

          comparisons.push({
            productName: productKey.charAt(0).toUpperCase() + productKey.slice(1),
            markets,
            priceDifference,
            savingsPercent,
          });
        }
      });

      comparisons.sort((a, b) => b.savingsPercent - a.savingsPercent);

      setMarketComparisons(comparisons);
    } catch (error) {
      console.error('Error loading price analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredVariations = () => {
    let filtered = priceVariations;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(v =>
        v.productName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply variation filter
    switch (filter) {
      case 'increased':
        return filtered.filter(v => v.variation > 0);
      case 'decreased':
        return filtered.filter(v => v.variation < 0);
      default:
        return filtered;
    }
  };

  const getFilteredComparisons = () => {
    let filtered = marketComparisons;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(comparison =>
        comparison.productName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply comparison filter
    return filtered.filter(comparison => {
      if (comparisonFilter === 'all') return true;

      const hasCheaper = comparison.markets.some(m => m.isCheapest);
      const hasExpensive = comparison.markets.some(m => m.isMostExpensive);

      if (comparisonFilter === 'cheaper') return hasCheaper;
      if (comparisonFilter === 'expensive') return hasExpensive;

      return true;
    });
  };

  const getFilteredComparisonData = () => {
    if (!searchQuery.trim()) {
      return comparisonData;
    }
    return comparisonData.filter(item =>
      item.productName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const handleDeleteProduct = (productName: string) => {
    Alert.alert(
      'Excluir Produto',
      `Deseja remover "${productName}" do histórico de preços?\n\nIsso não afetará suas compras anteriores.`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteProductFromAnalysis(productName),
        },
      ]
    );
  };

  const deleteProductFromAnalysis = (productName: string) => {
    setPriceVariations(prev =>
      prev.filter(item => item.productName !== productName)
    );
  };

  const toggleExcludeProduct = (index: number) => {
    setComparisonData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], excluded: !updated[index].excluded };
      return updated;
    });
  };

  const handleBarcodeScanned = async (barcode: string) => {
    setScannerVisible(false);

    try {
      const purchases = await storage.getActivePurchases();
      let productName = '';

      for (const purchase of purchases) {
        const item = purchase.items.find(i => i.barcode === barcode);
        if (item) {
          productName = item.name;
          break;
        }
      }

      if (productName) {
        setSearchQuery(productName);
      } else {
        Alert.alert('Produto não encontrado', 'Este código de barras não está no histórico de compras.');
      }
    } catch (error) {
      console.error('Error searching barcode:', error);
      Alert.alert('Erro', 'Não foi possível buscar o produto');
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getVariationIcon = (variation: number) => {
    if (variation > 0) {
      return <TrendingUp size={20} color="#ef4444" />;
    } else if (variation < 0) {
      return <TrendingDown size={20} color="#22c55e" />;
    }
    return <Minus size={20} color="#6b7280" />;
  };

  const getVariationColor = (variation: number) => {
    if (variation > 0) return '#ef4444';
    if (variation < 0) return '#22c55e';
    return '#6b7280';
  };

  const getSummary = () => {
    const activeProducts = comparisonData.filter(p => !p.excluded);
    if (activeProducts.length === 0) return null;

    const market1Name = availableMarkets.find(m => m.id === selectedMarket1)?.name || '';
    const market2Name = availableMarkets.find(m => m.id === selectedMarket2)?.name || '';

    const market1Total = activeProducts.reduce((sum, p) => sum + p.market1Price, 0);
    const market2Total = activeProducts.reduce((sum, p) => sum + p.market2Price, 0);

    const cheaperMarket = market1Total < market2Total ? market1Name : market2Name;
    const savings = Math.abs(market1Total - market2Total);
    const savingsPercent = (savings / Math.max(market1Total, market2Total)) * 100;

    return {
      market1Name,
      market2Name,
      market1Total,
      market2Total,
      cheaperMarket,
      savings,
      savingsPercent,
    };
  };

  const filteredVariations = getFilteredVariations();
  const filteredComparisons = getFilteredComparisons();
  const increasedCount = priceVariations.filter(v => v.variation > 0).length;
  const decreasedCount = priceVariations.filter(v => v.variation < 0).length;
  const summary = getSummary();

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (priceVariations.length === 0 && marketComparisons.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <TrendingUp size={64} color="#d1d5db" />
        <Text style={styles.emptyText}>
          Faça pelo menos 2 compras para ver a análise de variação de preços
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Watermark />
      <View style={styles.compactHeader}>
        <Text style={styles.compactTitle}>Análise de Preços</Text>
        <Text style={styles.compactSubtitle}>Compare os preços dos seus produtos</Text>
      </View>

      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeButton, viewMode === 'variation' && styles.modeButtonActive]}
          onPress={() => setViewMode('variation')}>
          <TrendingUp size={18} color={viewMode === 'variation' ? '#ffffff' : '#6b7280'} />
          <Text style={[styles.modeText, viewMode === 'variation' && styles.modeTextActive]}>
            Variação
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, viewMode === 'comparison' && styles.modeButtonActive]}
          onPress={() => setViewMode('comparison')}>
          <Building2 size={18} color={viewMode === 'comparison' ? '#ffffff' : '#6b7280'} />
          <Text style={[styles.modeText, viewMode === 'comparison' && styles.modeTextActive]}>
            Supermercados
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'variation' && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollViewContent,
            { paddingBottom: 16 + insets.bottom }
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.searchContainer}>
            <Search size={20} color="#9ca3af" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar produto..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <X size={18} color="#6b7280" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setScannerVisible(true)}
              style={styles.scanButton}>
              <ScanBarcode size={20} color="#22c55e" />
            </TouchableOpacity>
          </View>

        {filteredVariations.map((item, index) => (
          <View key={index} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.productNameContainer}>
                <Text style={styles.productName}>{item.productName}</Text>
              </View>
              <View style={styles.cardActions}>
                <View style={styles.variationBadge}>
                  {getVariationIcon(item.variation)}
                  <Text style={[styles.variationPercent, { color: getVariationColor(item.variation) }]}>
                    {item.variation > 0 ? '+' : ''}{item.variationPercent.toFixed(1)}%
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteProduct(item.productName)}>
                  <Trash2 size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.priceComparison}>
              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>Preço Anterior</Text>
                <Text style={styles.priceValue}>{formatCurrency(item.previousPrice)}</Text>
              </View>

              <View style={styles.arrow}>
                <Text style={styles.arrowText}>→</Text>
              </View>

              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>Preço Atual</Text>
                <Text style={[styles.priceValue, { color: getVariationColor(item.variation) }]}>
                  {formatCurrency(item.currentPrice)}
                </Text>
              </View>
            </View>

            <View style={styles.variationAmount}>
              <Text style={[styles.variationText, { color: getVariationColor(item.variation) }]}>
                {item.variation > 0 ? '+' : ''}{formatCurrency(Math.abs(item.variation))} por unidade
              </Text>
            </View>

            {item.marketName && (
              <View style={styles.marketInfo}>
                <Store size={14} color="#6b7280" />
                <Text style={styles.marketText}>{item.marketName}</Text>
                <Text style={styles.dateText}>• {formatDate(item.lastPurchaseDate)}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      )}

      {viewMode === 'comparison' && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollViewContent,
            { paddingBottom: 16 + insets.bottom }
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.searchContainer}>
            <Search size={20} color="#9ca3af" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar produto..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <X size={18} color="#6b7280" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setScannerVisible(true)}
              style={styles.scanButton}>
              <ScanBarcode size={20} color="#22c55e" />
            </TouchableOpacity>
          </View>

          {availableMarkets.length >= 2 && (
            <View style={styles.marketSelectionContainer}>
              <Text style={styles.selectLabel}>Selecione dois mercados para comparar:</Text>

              <View style={styles.marketSelectors}>
                <TouchableOpacity
                  style={styles.marketSelector}
                  onPress={() => setShowMarket1Picker(true)}>
                  <Store size={16} color="#22c55e" />
                  <Text style={styles.marketSelectorText} numberOfLines={1}>
                    {availableMarkets.find(m => m.id === selectedMarket1)?.name || 'Selecione'}
                  </Text>
                  <ChevronDown size={16} color="#6b7280" />
                </TouchableOpacity>

                <Text style={styles.vsText}>VS</Text>

                <TouchableOpacity
                  style={styles.marketSelector}
                  onPress={() => setShowMarket2Picker(true)}>
                  <Store size={16} color="#22c55e" />
                  <Text style={styles.marketSelectorText} numberOfLines={1}>
                    {availableMarkets.find(m => m.id === selectedMarket2)?.name || 'Selecione'}
                  </Text>
                  <ChevronDown size={16} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!selectedMarket1 || !selectedMarket2 ? (
            <View style={styles.emptyComparison}>
              <Building2 size={48} color="#d1d5db" />
              <Text style={styles.emptyComparisonText}>
                Selecione dois mercados para comparar preços
              </Text>
            </View>
          ) : comparisonData.length === 0 ? (
            <View style={styles.emptyComparison}>
              <Building2 size={48} color="#d1d5db" />
              <Text style={styles.emptyComparisonText}>
                Não há produtos em comum entre os mercados selecionados
              </Text>
            </View>
          ) : (
            <>
              {summary && (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Resumo da Comparação</Text>

                  <View style={styles.summaryContent}>
                    <View style={styles.summaryRow}>
                      <View style={styles.summaryMarket}>
                        <Store size={16} color="#6b7280" />
                        <Text style={styles.summaryMarketName}>{summary.market1Name}</Text>
                      </View>
                      <Text style={styles.summaryPrice}>{formatCurrency(summary.market1Total)}</Text>
                    </View>

                    <View style={styles.summaryDivider} />

                    <View style={styles.summaryRow}>
                      <View style={styles.summaryMarket}>
                        <Store size={16} color="#6b7280" />
                        <Text style={styles.summaryMarketName}>{summary.market2Name}</Text>
                      </View>
                      <Text style={styles.summaryPrice}>{formatCurrency(summary.market2Total)}</Text>
                    </View>
                  </View>

                  <View style={styles.cheaperBadge}>
                    <Text style={styles.cheaperBadgeText}>
                      {summary.cheaperMarket} é mais barato
                    </Text>
                    <Text style={styles.savingsText}>
                      Economize {formatCurrency(summary.savings)} ({summary.savingsPercent.toFixed(1)}%)
                    </Text>
                  </View>
                </View>
              )}

              {summary && (
                <View style={styles.comparisonTable}>
                <View style={styles.tableHeader}>
                  <View style={styles.tableHeaderProduct}>
                    <Text style={styles.tableHeaderText}>Produto</Text>
                  </View>
                  <View style={styles.tableHeaderPrice}>
                    <Store size={14} color="#6b7280" />
                    <Text style={styles.tableHeaderText} numberOfLines={1}>
                      {summary.market1Name}
                    </Text>
                  </View>
                  <View style={styles.tableHeaderPrice}>
                    <Store size={14} color="#6b7280" />
                    <Text style={styles.tableHeaderText} numberOfLines={1}>
                      {summary.market2Name}
                    </Text>
                  </View>
                  <View style={styles.tableHeaderAction}>
                    <Text style={styles.tableHeaderText}>Ação</Text>
                  </View>
                </View>

                {getFilteredComparisonData().map((item, index) => (
                  <View key={index} style={[styles.tableRow, item.excluded && styles.excludedRow]}>
                    <View style={styles.tableProductCell}>
                      <Text style={[styles.tableProductText, item.excluded && styles.excludedText]} numberOfLines={2}>
                        {item.productName}
                      </Text>
                    </View>
                    <View style={styles.tablePriceCell}>
                      {!item.excluded && item.cheaperMarket === summary.market1Name && (
                        <View style={styles.cheaperBadgeSmall}>
                          <TrendingDown size={12} color="#22c55e" />
                        </View>
                      )}
                      <Text style={[
                        styles.tablePriceText,
                        item.excluded && styles.excludedText,
                        !item.excluded && item.cheaperMarket === summary.market1Name && styles.cheaperPriceText
                      ]}>
                        {formatCurrency(item.market1Price)}
                      </Text>
                    </View>
                    <View style={styles.tablePriceCell}>
                      {!item.excluded && item.cheaperMarket === summary.market2Name && (
                        <View style={styles.cheaperBadgeSmall}>
                          <TrendingDown size={12} color="#22c55e" />
                        </View>
                      )}
                      <Text style={[
                        styles.tablePriceText,
                        item.excluded && styles.excludedText,
                        !item.excluded && item.cheaperMarket === summary.market2Name && styles.cheaperPriceText
                      ]}>
                        {formatCurrency(item.market2Price)}
                      </Text>
                    </View>
                    <View style={styles.tableActionCell}>
                      <TouchableOpacity
                        style={styles.tableExcludeButton}
                        onPress={() => toggleExcludeProduct(index)}>
                        {item.excluded ? (
                          <Text style={styles.tableIncludeText}>+</Text>
                        ) : (
                          <Trash2 size={14} color="#ef4444" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <View style={styles.tableFooter}>
                  <View style={styles.tableFooterCell}>
                    <Text style={styles.tableFooterLabel}>TOTAL</Text>
                  </View>
                  <View style={styles.tableFooterPriceCell}>
                    {summary.market1Total < summary.market2Total && (
                      <View style={styles.winnerBadge}>
                        <TrendingDown size={16} color="#22c55e" />
                      </View>
                    )}
                    <Text style={[
                      styles.tableFooterPrice,
                      summary.market1Total < summary.market2Total && styles.winnerPrice
                    ]}>
                      {formatCurrency(summary.market1Total)}
                    </Text>
                  </View>
                  <View style={styles.tableFooterPriceCell}>
                    {summary.market2Total < summary.market1Total && (
                      <View style={styles.winnerBadge}>
                        <TrendingDown size={16} color="#22c55e" />
                      </View>
                    )}
                    <Text style={[
                      styles.tableFooterPrice,
                      summary.market2Total < summary.market1Total && styles.winnerPrice
                    ]}>
                      {formatCurrency(summary.market2Total)}
                    </Text>
                  </View>
                  <View style={styles.tableFooterActionCell} />
                </View>
              </View>
              )}

              {summary && (
                <View style={styles.finalSummary}>
                  <Text style={styles.finalSummaryText}>
                    {summary.cheaperMarket} é mais barato
                  </Text>
                  <Text style={styles.finalSummarySubtext}>
                    Economize {formatCurrency(summary.savings)} comprando lá
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      <Modal visible={showMarket1Picker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecione o Mercado 1</Text>
              <TouchableOpacity onPress={() => setShowMarket1Picker(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {availableMarkets
                .filter(m => m.id !== selectedMarket2)
                .map(market => (
                  <TouchableOpacity
                    key={market.id}
                    style={[
                      styles.modalItem,
                      selectedMarket1 === market.id && styles.modalItemSelected
                    ]}
                    onPress={() => {
                      setSelectedMarket1(market.id);
                      setShowMarket1Picker(false);
                    }}>
                    <Store size={20} color={selectedMarket1 === market.id ? '#22c55e' : '#6b7280'} />
                    <Text style={[
                      styles.modalItemText,
                      selectedMarket1 === market.id && styles.modalItemTextSelected
                    ]}>
                      {market.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showMarket2Picker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecione o Mercado 2</Text>
              <TouchableOpacity onPress={() => setShowMarket2Picker(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {availableMarkets
                .filter(m => m.id !== selectedMarket1)
                .map(market => (
                  <TouchableOpacity
                    key={market.id}
                    style={[
                      styles.modalItem,
                      selectedMarket2 === market.id && styles.modalItemSelected
                    ]}
                    onPress={() => {
                      setSelectedMarket2(market.id);
                      setShowMarket2Picker(false);
                    }}>
                    <Store size={20} color={selectedMarket2 === market.id ? '#22c55e' : '#6b7280'} />
                    <Text style={[
                      styles.modalItemText,
                      selectedMarket2 === market.id && styles.modalItemTextSelected
                    ]}>
                      {market.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onBarcodeScanned={handleBarcodeScanned}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 21,
    paddingBottom: 11.2,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  compactHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  compactTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  compactSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  modeSelector: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  modeButtonActive: {
    backgroundColor: '#22c55e',
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  modeTextActive: {
    color: '#ffffff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    padding: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  scanButton: {
    padding: 6,
    marginLeft: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#ffffff',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#22c55e',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  marketSelectionContainer: {
    backgroundColor: '#f9fafb',
    padding: 16,
    marginBottom: 1,
  },
  selectLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  marketSelectors: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  marketSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  marketSelectorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  vsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 16,
    marginBottom: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  productNameContainer: {
    flex: 1,
    marginRight: 8,
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  variationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  variationPercent: {
    fontSize: 15,
    fontWeight: '700',
  },
  priceComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceItem: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  arrow: {
    paddingHorizontal: 8,
  },
  arrowText: {
    fontSize: 20,
    color: '#9ca3af',
  },
  variationAmount: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginBottom: 8,
  },
  variationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  marketInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  marketText: {
    fontSize: 13,
    color: '#6b7280',
  },
  dateText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  emptyComparison: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyComparisonText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 16,
    marginBottom: 1,
    borderBottomWidth: 2,
    borderBottomColor: '#22c55e',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  summaryContent: {
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryMarket: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  summaryMarketName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  summaryPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  cheaperBadge: {
    backgroundColor: '#dcfce7',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cheaperBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 4,
  },
  savingsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  comparisonTable: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableHeaderProduct: {
    flex: 2,
    paddingHorizontal: 8,
  },
  tableHeaderPrice: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  tableHeaderAction: {
    width: 50,
    alignItems: 'center',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  excludedRow: {
    opacity: 0.4,
    backgroundColor: '#f9fafb',
  },
  tableProductCell: {
    flex: 2,
    paddingHorizontal: 8,
  },
  tableProductText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  tablePriceCell: {
    flex: 1.5,
    paddingHorizontal: 4,
    position: 'relative',
  },
  tablePriceText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  cheaperPriceText: {
    color: '#22c55e',
  },
  cheaperBadgeSmall: {
    position: 'absolute',
    top: -6,
    left: 0,
    backgroundColor: '#dcfce7',
    borderRadius: 10,
    padding: 2,
  },
  tableActionCell: {
    width: 50,
    alignItems: 'center',
  },
  tableExcludeButton: {
    padding: 6,
    backgroundColor: '#fef2f2',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  tableIncludeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22c55e',
  },
  excludedText: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  tableFooter: {
    flexDirection: 'row',
    backgroundColor: '#f0fdf4',
    borderTopWidth: 2,
    borderTopColor: '#22c55e',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  tableFooterCell: {
    flex: 2,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  tableFooterLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  tableFooterPriceCell: {
    flex: 1.5,
    paddingHorizontal: 4,
    position: 'relative',
  },
  tableFooterPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  winnerPrice: {
    color: '#22c55e',
    fontSize: 20,
  },
  winnerBadge: {
    position: 'absolute',
    top: -8,
    left: 0,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 4,
  },
  tableFooterActionCell: {
    width: 50,
  },
  finalSummary: {
    backgroundColor: '#dcfce7',
    padding: 16,
    borderRadius: 0,
    alignItems: 'center',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#22c55e',
  },
  finalSummaryText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 4,
  },
  finalSummarySubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalList: {
    padding: 16,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalItemSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#22c55e',
    borderWidth: 2,
  },
  modalItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalItemTextSelected: {
    color: '#16a34a',
  },
});
