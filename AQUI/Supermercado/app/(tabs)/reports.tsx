import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { ChevronDown, ChevronUp, Calendar, DollarSign, Package, FileText, ShoppingCart, ChevronLeft, ChevronRight, Store } from 'lucide-react-native';
import { storage, Purchase } from '@/lib/storage';
import { useRouter } from 'expo-router';
import Watermark from '@/components/Watermark';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MarketReport {
  marketId: string;
  marketName: string;
  totalSpent: number;
  purchaseCount: number;
  itemsCount: number;
  purchases: Purchase[];
  expanded: boolean;
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<MarketReport[]>([]);
  const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdItemsCount, setCreatedItemsCount] = useState(0);
  const router = useRouter();

  const allMarketsData = useMemo(() => {
    const marketMap = new Map<string, { name: string; count: number; total: number }>();

    allPurchases.forEach(purchase => {
      const marketId = purchase.market_id || 'sem-mercado';
      const marketName = purchase.market_name || 'Sem mercado';

      if (!marketMap.has(marketId)) {
        marketMap.set(marketId, { name: marketName, count: 0, total: 0 });
      }

      const data = marketMap.get(marketId)!;
      data.count += 1;
      data.total += purchase.total_amount;
    });

    return Array.from(marketMap.values()).sort((a, b) => b.total - a.total);
  }, [allPurchases]);

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    filterPurchasesByMonth();
  }, [selectedMonth, allPurchases]);

  const loadReports = async () => {
    try {
      const purchases = await storage.getActivePurchases();
      setAllPurchases(purchases);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPurchasesByMonth = () => {
    console.log('Total purchases loaded:', allPurchases.length);

    allPurchases.forEach(purchase => {
      console.log('Purchase:', {
        id: purchase.id,
        market_id: purchase.market_id,
        market_name: purchase.market_name,
        date: purchase.completed_at,
        total: purchase.total_amount
      });
    });

    const filteredPurchases = allPurchases.filter(purchase => {
      const purchaseDate = new Date(purchase.completed_at);
      return (
        purchaseDate.getMonth() === selectedMonth.getMonth() &&
        purchaseDate.getFullYear() === selectedMonth.getFullYear()
      );
    });

    console.log('Filtered purchases for selected month:', filteredPurchases.length);

    const marketMap = new Map<string, MarketReport>();

    filteredPurchases.forEach(purchase => {
      const marketId = purchase.market_id || 'sem-mercado';
      const marketName = purchase.market_name || 'Sem mercado definido';

      console.log('Processing purchase for market:', marketName, marketId);

      if (!marketMap.has(marketId)) {
        marketMap.set(marketId, {
          marketId,
          marketName,
          totalSpent: 0,
          purchaseCount: 0,
          itemsCount: 0,
          purchases: [],
          expanded: false,
        });
      }

      const report = marketMap.get(marketId)!;
      report.totalSpent += purchase.total_amount;
      report.purchaseCount += 1;
      report.itemsCount += purchase.items_count;
      report.purchases.push(purchase);
    });

    console.log('Markets found:', Array.from(marketMap.keys()));

    const sortedReports = Array.from(marketMap.values()).sort(
      (a, b) => b.totalSpent - a.totalSpent
    );

    console.log('Final reports:', sortedReports.map(r => ({ name: r.marketName, count: r.purchaseCount })));

    setReports(sortedReports);
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setSelectedMonth(newMonth);
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
  };

  const getAvailableMonths = () => {
    const months: Date[] = [];
    const uniqueMonths = new Set<string>();

    allPurchases.forEach(purchase => {
      const date = new Date(purchase.completed_at);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (!uniqueMonths.has(monthKey)) {
        uniqueMonths.add(monthKey);
        months.push(new Date(date.getFullYear(), date.getMonth(), 1));
      }
    });

    return months.sort((a, b) => b.getTime() - a.getTime());
  };

  const toggleExpanded = (marketId: string) => {
    setReports(
      reports.map(report =>
        report.marketId === marketId
          ? { ...report, expanded: !report.expanded }
          : report
      )
    );
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

  const createShoppingListFromPurchase = async (purchase: Purchase) => {
    try {
      console.log('=== STARTING CREATE SHOPPING LIST ===');
      console.log('Purchase ID:', purchase.id);
      console.log('Purchase items:', JSON.stringify(purchase.items, null, 2));

      console.log('Step 1: Clearing existing items...');
      await storage.clearItems();
      const afterClear = await storage.getItems();
      console.log('Items after clear:', afterClear.length);

      console.log('Step 2: Getting markets...');
      const markets = await storage.getMarkets();
      console.log('Markets found:', markets.length);
      console.log('Purchase market_id:', purchase.market_id);

      const market = purchase.market_id
        ? markets.find(m => m.id === purchase.market_id)
        : null;

      if (market) {
        console.log('Step 3: Setting selected market:', market.name);
        await storage.setSelectedMarket(market);
        const selectedMarket = await storage.getSelectedMarket();
        console.log('Selected market confirmed:', selectedMarket?.name);
      } else {
        console.log('Step 3: No market to select');
      }

      console.log('Step 4: Adding items...');
      let addedCount = 0;
      for (const item of purchase.items) {
        console.log(`Adding item ${addedCount + 1}/${purchase.items.length}:`, item.name);
        try {
          const addedItem = await storage.addItem({
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            market_id: purchase.market_id,
            barcode: item.barcode,
          });
          console.log('Item added successfully:', addedItem.id, addedItem.name);
          addedCount++;
        } catch (itemError) {
          console.error('Error adding individual item:', itemError);
        }
      }

      console.log('Step 5: Verifying final items...');
      const finalItems = await storage.getItems();
      console.log('Final items count:', finalItems.length);
      console.log('Final items:', JSON.stringify(finalItems, null, 2));

      console.log('Step 6: Showing success modal...');
      console.log('Items count:', finalItems.length);
      setCreatedItemsCount(finalItems.length);
      console.log('Setting showSuccessModal to true...');
      setShowSuccessModal(true);
      console.log('showSuccessModal state should be true now');
      console.log('=== CREATE SHOPPING LIST COMPLETED ===');
    } catch (error) {
      console.error('=== ERROR CREATING SHOPPING LIST ===');
      console.error('Error:', error);
      console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
      Alert.alert('Erro', `Não foi possível criar a lista de compras: ${error}`);
    }
  };

  const renderPurchase = (purchase: Purchase) => (
    <View key={purchase.id} style={styles.purchaseCard}>
      <View style={styles.purchaseHeader}>
        <View style={styles.purchaseInfo}>
          <Calendar size={16} color="#6b7280" />
          <Text style={styles.purchaseDate}>{formatDate(purchase.completed_at)}</Text>
        </View>
        <Text style={styles.purchaseTotal}>{formatCurrency(purchase.total_amount)}</Text>
      </View>
      <View style={styles.purchaseDetails}>
        <View style={styles.purchaseDetailsRow}>
          <Text style={styles.purchaseItemsCount}>
            {purchase.items_count} {purchase.items_count === 1 ? 'item' : 'itens'}
          </Text>
          <TouchableOpacity
            style={styles.createListButton}
            onPress={() => createShoppingListFromPurchase(purchase)}>
            <ShoppingCart size={14} color="#22c55e" />
            <Text style={styles.createListButtonText}>Criar Lista</Text>
          </TouchableOpacity>
        </View>
      </View>
      {purchase.items.map((item, index) => (
        <View key={item.id} style={styles.itemRow}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemQuantity}>
            {item.quantity}x {formatCurrency(item.unit_price)}
          </Text>
          <Text style={styles.itemTotal}>{formatCurrency(item.total_price)}</Text>
        </View>
      ))}
    </View>
  );

  const renderReport = ({ item }: { item: MarketReport }) => (
    <View style={styles.reportCard}>
      <TouchableOpacity
        style={styles.reportHeader}
        onPress={() => toggleExpanded(item.marketId)}>
        <View style={styles.reportInfo}>
          <Text style={styles.marketName}>{item.marketName}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <DollarSign size={14} color="#6b7280" />
              <Text style={styles.statText}>{formatCurrency(item.totalSpent)}</Text>
            </View>
            <View style={styles.statItem}>
              <Package size={14} color="#6b7280" />
              <Text style={styles.statText}>
                {item.purchaseCount} {item.purchaseCount === 1 ? 'compra' : 'compras'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.expandIcon}>
          {item.expanded ? (
            <ChevronUp size={24} color="#22c55e" />
          ) : (
            <ChevronDown size={24} color="#6b7280" />
          )}
        </View>
      </TouchableOpacity>

      {item.expanded && (
        <View style={styles.purchasesContainer}>
          {item.purchases.map(purchase => renderPurchase(purchase))}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Watermark />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Relatório de Compras</Text>
        </View>

        <View style={styles.monthSelector}>
          <TouchableOpacity
            style={styles.monthButton}
            onPress={() => changeMonth('prev')}>
            <ChevronLeft size={24} color="#22c55e" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.monthDisplay}
            onPress={() => setShowMonthPicker(true)}>
            <Calendar size={20} color="#22c55e" />
            <Text style={styles.monthText}>
              {formatMonthYear(selectedMonth).charAt(0).toUpperCase() +
               formatMonthYear(selectedMonth).slice(1)}
            </Text>
            <ChevronDown size={20} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.monthButton}
            onPress={() => changeMonth('next')}>
            <ChevronRight size={24} color="#22c55e" />
          </TouchableOpacity>
        </View>

        {reports.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FileText size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>Nenhuma compra registrada</Text>
            <Text style={styles.emptySubtext}>
              Nenhuma compra encontrada neste período
            </Text>
          </View>
        ) : (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Total Geral</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(
                reports.reduce((sum, report) => sum + report.totalSpent, 0)
              )}
            </Text>
            <Text style={styles.summarySubtext}>
              {reports.reduce((sum, report) => sum + report.purchaseCount, 0)} compras em{' '}
              {reports.length} {reports.length === 1 ? 'mercado' : 'mercados'}
            </Text>
            {(() => {
              const allPurchasesInPeriod = reports.flatMap(r => r.purchases);
              if (allPurchasesInPeriod.length > 0) {
                const sortedPurchases = allPurchasesInPeriod.sort(
                  (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
                );
                const lastPurchase = sortedPurchases[0];
                return (
                  <View style={styles.lastPurchaseInfo}>
                    <Calendar size={14} color="#6b7280" />
                    <Text style={styles.lastPurchaseText}>
                      Última compra: {formatDate(lastPurchase.completed_at)}
                    </Text>
                  </View>
                );
              }
              return null;
            })()}
          </View>
        )}

        <FlatList
          data={reports}
          renderItem={renderReport}
          keyExtractor={(item) => item.marketId}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: 16 + insets.bottom }
          ]}
        />
      </View>

      <Modal
        visible={showMonthPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMonthPicker(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthPicker(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Período</Text>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.monthList}>
              {getAvailableMonths().map((month, index) => {
                const isSelected =
                  month.getMonth() === selectedMonth.getMonth() &&
                  month.getFullYear() === selectedMonth.getFullYear();
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.monthOption,
                      isSelected && styles.monthOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedMonth(month);
                      setShowMonthPicker(false);
                    }}>
                    <Text
                      style={[
                        styles.monthOptionText,
                        isSelected && styles.monthOptionTextSelected,
                      ]}>
                      {formatMonthYear(month).charAt(0).toUpperCase() +
                       formatMonthYear(month).slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => {
          console.log('Modal closed via back button');
          setShowSuccessModal(false);
          router.push('/(tabs)');
        }}>
        <TouchableOpacity
          style={styles.successModalOverlay}
          activeOpacity={1}
          onPress={() => {
            console.log('Overlay pressed');
            setShowSuccessModal(false);
            router.push('/(tabs)');
          }}>
          <TouchableOpacity
            style={styles.successModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.successIcon}>
              <ShoppingCart size={48} color="#22c55e" />
            </View>
            <Text style={styles.successTitle}>Lista Criada!</Text>
            <Text style={styles.successMessage}>
              Lista de compras criada com {createdItemsCount} {createdItemsCount === 1 ? 'item' : 'itens'}
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => {
                console.log('Ver Lista button pressed');
                setShowSuccessModal(false);
                router.push('/(tabs)');
              }}>
              <Text style={styles.successButtonText}>Ver Lista</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 11.2,
    paddingTop: 16.8,
    paddingBottom: 8.96,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 15.21,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  allMarketsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  marketChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  marketChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    marginHorizontal: 10.24,
    marginTop: 10.24,
    marginBottom: 5.12,
    paddingHorizontal: 10.24,
    paddingVertical: 10.24,
    borderRadius: 7.68,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  monthButton: {
    padding: 6.4,
    borderRadius: 6.4,
    backgroundColor: '#f3f4f6',
  },
  monthDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5.12,
    flex: 1,
    marginHorizontal: 9.6,
    justifyContent: 'center',
  },
  monthText: {
    fontSize: 12.8,
    fontWeight: '600',
    color: '#111827',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalClose: {
    fontSize: 28,
    color: '#6b7280',
    fontWeight: '300',
  },
  monthList: {
    padding: 16,
  },
  monthOption: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  monthOptionSelected: {
    backgroundColor: '#d1fae5',
    borderColor: '#22c55e',
  },
  monthOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  monthOptionTextSelected: {
    color: '#166534',
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: '#22c55e',
    marginHorizontal: 10.24,
    marginTop: 5.12,
    padding: 12.8,
    borderRadius: 9.6,
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 11.2,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 6.4,
  },
  summaryAmount: {
    fontSize: 22.4,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 3.2,
  },
  summarySubtext: {
    fontSize: 9.6,
    color: '#d1fae5',
  },
  lastPurchaseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  lastPurchaseText: {
    fontSize: 9.6,
    color: '#d1fae5',
  },
  listContainer: {
    padding: 12.8,
    paddingBottom: 80,
  },
  reportCard: {
    backgroundColor: '#ffffff',
    borderRadius: 9.6,
    marginBottom: 9.6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12.8,
  },
  reportInfo: {
    flex: 1,
  },
  marketName: {
    fontSize: 14.4,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6.4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12.8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.2,
  },
  statText: {
    fontSize: 11.2,
    color: '#6b7280',
  },
  expandIcon: {
    marginLeft: 9.6,
  },
  purchasesContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 16,
  },
  purchaseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  purchaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  purchaseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  purchaseDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  purchaseTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22c55e',
  },
  purchaseDetails: {
    marginBottom: 8,
  },
  purchaseDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  purchaseItemsCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  createListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  createListButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22c55e',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  itemName: {
    flex: 2,
    fontSize: 14,
    color: '#374151',
  },
  itemQuantity: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
  },
  itemTotal: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'right',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  successButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
});
