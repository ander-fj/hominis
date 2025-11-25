import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Plus, Trash2, X, ScanBarcode, Store, ShoppingCart, MapPin, Calendar, DollarSign, CircleCheck as CheckCircle2, Circle, Search, CheckSquare, Square } from 'lucide-react-native';
import { storage, ShoppingItem, Market, Purchase } from '@/lib/storage';
import BarcodeScanner from '@/components/BarcodeScanner';
import SwipeableItem from '@/components/SwipeableItem';
import Watermark from '@/components/Watermark';
import { searchProductByBarcode } from './barcodeService';
import * as ExpoLocation from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ShoppingListScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [quickScannerVisible, setQuickScannerVisible] = useState(false);
  const [marketModalVisible, setMarketModalVisible] = useState(false);
  const [addMarketMode, setAddMarketMode] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [purchasesModalVisible, setPurchasesModalVisible] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [previousItems, setPreviousItems] = useState<string[]>([]);
  const [filteredItems, setFilteredItems] = useState<Array<{ name: string; price: number | null }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expandedPurchases, setExpandedPurchases] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPurchases, setSelectedPurchases] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [newMarket, setNewMarket] = useState({ name: '', location: '' });
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingBarcode, setIsSearchingBarcode] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    quantity: '1',
    unit_price: '',
    barcode: '',
  });

  const loadItems = useCallback(async () => {
    try {
      const itemsData = await storage.getItems();
      const filteredByMarket = selectedMarket
        ? itemsData.filter(item => item.market_id === selectedMarket.id)
        : itemsData;
      setItems(filteredByMarket);
    } catch (error) {
      console.error('Error loading items:', error);
    }
  }, [selectedMarket]);

  const loadData = async () => {
    try {
      const [itemsData, marketsData, savedMarket, itemNames] = await Promise.all([
        storage.getItems(),
        storage.getMarkets(),
        storage.getSelectedMarket(),
        storage.getUniqueItemNames(),
      ]);
      setItems(itemsData);
      setMarkets(marketsData);
      setSelectedMarket(savedMarket);
      setPreviousItems(itemNames);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPurchasesOnMount = async () => {
    try {
      const purchasesData = await storage.getPurchases();
      console.log('Purchases on mount:', purchasesData.length);
      if (purchasesData.length > 0) {
        console.log('First purchase:', purchasesData[0]);
      }
    } catch (error) {
      console.error('Error checking purchases:', error);
    }
  };

  useEffect(() => {
    loadData();
    checkPurchasesOnMount();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadItems();
    }
  }, [loading, loadItems]);

  useFocusEffect(
    useCallback(() => {
      console.log('Screen focused, reloading data...');
      loadData();
      return () => {
        console.log('Screen unfocused');
      };
    }, [])
  );

  const loadMarkets = async () => {
    try {
      const marketsData = await storage.getMarkets();
      setMarkets(marketsData);
    } catch (error) {
      console.error('Error loading markets:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLoadingLocation(true);

      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Precisamos de acesso à localização para buscar o endereço');
        return;
      }

      const location = await ExpoLocation.getCurrentPositionAsync({});
      const [address] = await ExpoLocation.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address) {
        const addressText = [
          address.street,
          address.streetNumber,
          address.district || address.subregion,
          address.city,
        ]
          .filter(Boolean)
          .join(', ');

        setNewMarket({ ...newMarket, location: addressText });
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Erro', 'Não foi possível obter a localização');
    } finally {
      setLoadingLocation(false);
    }
  };

  const addMarket = async () => {
    if (!newMarket.name.trim()) {
      Alert.alert('Erro', 'Digite o nome do mercado');
      return;
    }

    try {
      await storage.addMarket({
        name: newMarket.name.trim(),
        location: newMarket.location.trim() || undefined,
      });

      setNewMarket({ name: '', location: '' });
      setAddMarketMode(false);
      loadMarkets();
    } catch (error) {
      console.error('Error adding market:', error);
      Alert.alert('Não foi possível adicionar o mercado');
    }
  };

  const formatCurrencyInput = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';

    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const parseCurrencyInput = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return 0;
    return parseFloat(numbers) / 100;
  };

  const handlePriceChange = (text: string) => {
    const formatted = formatCurrencyInput(text);
    setNewItem({ ...newItem, unit_price: formatted });
  };

  const handleNameChange = async (text: string) => {
    setNewItem({ ...newItem, name: text });

    if (text.trim().length >= 2) {
      const matchingItems = previousItems.filter(item =>
        item.toLowerCase().includes(text.toLowerCase())
      );

      const itemsWithPrices = await Promise.all(
        matchingItems.map(async (name) => ({
          name,
          price: await storage.getLastItemPrice(name, selectedMarket?.id),
        }))
      );

      setFilteredItems(itemsWithPrices);
      setShowSuggestions(itemsWithPrices.length > 0);
    } else {
      setFilteredItems([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (itemName: string, price: number | null) => {
    setShowSuggestions(false);
    setFilteredItems([]);

    if (price !== null) {
      const priceFormatted = formatCurrencyInput((price * 100).toString());
      setNewItem({ ...newItem, name: itemName, unit_price: priceFormatted });
    } else {
      setNewItem({ ...newItem, name: itemName });
    }
  };

  const addItem = async () => {
    if (!editingItem && !selectedMarket) {
      Alert.alert('Erro', 'Selecione um mercado antes de adicionar itens');
      return;
    }

    if (!newItem.name.trim()) {
      Alert.alert('Erro', 'Digite o nome do item');
      return;
    }

    const quantity = parseFloat(newItem.quantity) || 1;
    const unitPrice = parseCurrencyInput(newItem.unit_price);

    if (unitPrice <= 0) {
      Alert.alert('Erro', 'Digite um preço válido');
      return;
    }

    try {
      if (editingItem) {
        await storage.updateItem(editingItem.id, {
          name: newItem.name.trim(),
          quantity: quantity,
          unit_price: unitPrice,
          total_price: quantity * unitPrice,
          barcode: newItem.barcode || undefined,
        });
      } else {
        await storage.addItem({
          name: newItem.name.trim(),
          quantity: quantity,
          unit_price: unitPrice,
          total_price: quantity * unitPrice,
          market_id: selectedMarket!.id,
          barcode: newItem.barcode || undefined,
        });
      }

      setNewItem({ name: '', quantity: '1', unit_price: '', barcode: '' });
      setEditingItem(null);
      setShowSuggestions(false);
      setFilteredItems([]);
      setModalVisible(false);
      loadItems();
    } catch (error) {
      console.error('Error adding/updating item:', error);
      Alert.alert('Erro', 'Não foi possível salvar o item');
    }
  };

  const startEditItem = (item: ShoppingItem) => {
    setEditingItem(item);
    setNewItem({
      name: item.name,
      quantity: item.quantity.toString(),
      unit_price: formatCurrencyInput((item.unit_price * 100).toString()),
      barcode: item.barcode || '',
    });
    setModalVisible(true);
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setNewItem({ name: '', quantity: '1', unit_price: '', barcode: '' });
    setShowSuggestions(false);
    setFilteredItems([]);
    setModalVisible(false);
  };

const handleBarcodeScanned = async (barcode: string) => {
    setScannerVisible(false);
    setModalVisible(true);
    setIsSearchingBarcode(true);
    setNewItem({ name: '', quantity: '1', unit_price: '', barcode }); // Limpa o item anterior
  
    console.log(`[DIAGNÓSTICO] Iniciando busca para o código: ${barcode}`);
  
    // 1. Tenta buscar no histórico local primeiro
    const localItemData = await storage.getItemByBarcode(barcode, selectedMarket?.id);
    if (localItemData) {
      console.log('[DIAGNÓSTICO] Produto encontrado no histórico local.', localItemData);
      setNewItem({
        name: localItemData.name,
        quantity: '1',
        unit_price: formatCurrencyInput((localItemData.price * 100).toString()),
        barcode: barcode,
      });
      setIsSearchingBarcode(false);
      Alert.alert('Item Encontrado no Histórico', `Produto "${localItemData.name}" preenchido com base no seu histórico.`);
      return;
    }
  
    console.log('[DIAGNÓSTICO] Produto não encontrado no histórico. Buscando nas APIs...');
  
    // 2. Se não achou, busca nas APIs
    try {
      const productInfo = await searchProductByBarcode(barcode);

      if (productInfo) {
        console.log(`[DIAGNÓSTICO] Sucesso! Produto encontrado em: ${productInfo.source}`);
        setNewItem({ name: productInfo.name, quantity: '1', unit_price: '', barcode: barcode });
        Alert.alert('Produto Encontrado!', `Produto: ${productInfo.name}\n\nAgora preencha o preço e a quantidade.`);
      } else {
        console.log('[DIAGNÓSTICO] Produto não encontrado em nenhuma das fontes.');
        setNewItem({ name: '', quantity: '1', unit_price: '', barcode: barcode });
        Alert.alert('Produto não encontrado', 'Não encontramos este produto online. Por favor, adicione as informações manualmente.');
      }
    } catch (error) {
      console.error('[ERRO GRAVE] Falha ao buscar o produto:', error);
      setNewItem({ name: '', quantity: '1', unit_price: '', barcode: barcode });
      Alert.alert('Erro de Rede', 'Não foi possível conectar para buscar o produto. Verifique sua conexão e tente novamente.');
    } finally {
      console.log('[DIAGNÓSTICO] Finalizando busca.');
      setIsSearchingBarcode(false);
    }
  };
const handleQuickScan = async (barcode: string) => {
    setQuickScannerVisible(false);
  
    if (!selectedMarket) {
      Alert.alert('Erro', 'Selecione um mercado antes de escanear itens');
      return;
    }
  
    // 1. Verifica se o item já está na lista atual
    const existingItemInList = items.find(item => item.barcode === barcode);
    if (existingItemInList) {
      setSearchQuery(existingItemInList.name);
      Alert.alert('Produto na Lista', `${existingItemInList.name} já está na sua lista!`);
      return;
    }
  
    // 2. Tenta buscar no histórico local
    const localItemData = await storage.getItemByBarcode(barcode, selectedMarket.id);
    if (localItemData) {
      Alert.alert(
        'Adicionar Item?',
        `Produto: ${localItemData.name}\nPreço: ${formatCurrency(localItemData.price)}\n\nDeseja adicionar à lista?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Adicionar',
            onPress: async () => {
              try {
                await storage.addItem({
                  name: localItemData.name,
                  quantity: 1,
                  unit_price: localItemData.price,
                  total_price: localItemData.price,
                  market_id: selectedMarket.id,
                  barcode: barcode,
                });
                loadItems();
                Alert.alert('Sucesso', 'Item adicionado à lista!');
              } catch (error) {
                console.error('Error adding item from quick scan:', error);
                Alert.alert('Erro', 'Não foi possível adicionar o item');
              }
            },
          },
        ]
      );
      return; // Encerra aqui pois encontrou no histórico
    }
  
    // 3. Se não encontrou no histórico, busca na API (mesma lógica do handleBarcodeScanned)
    console.log('[DIAGNÓSTICO QUICKSCAN] Produto não encontrado no histórico. Buscando na API...');
    setNewItem({ name: '', quantity: '1', unit_price: '', barcode }); // Limpa o item
    setModalVisible(true); // Abre o modal para mostrar o carregamento e o resultado
    setIsSearchingBarcode(true);
  
    // Chama a função principal de busca, que já tem toda a lógica e diagnóstico
    // Passa o código de barras para ela, que cuidará do resto.
    await handleBarcodeScanned(barcode);
};

  const deleteItem = async (id: string) => {
    try {
      await storage.deleteItem(id);
      loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const toggleItemChecked = async (id: string) => {
    try {
      const item = items.find(i => i.id === id);
      if (item) {
        await storage.updateItem(id, { checked: !item.checked });
        loadItems();
      }
    } catch (error) {
      console.error('Error toggling item:', error);
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedPurchases(new Set());
  };

  const togglePurchaseSelection = (purchaseId: string) => {
    const newSelected = new Set(selectedPurchases);
    if (newSelected.has(purchaseId)) {
      newSelected.delete(purchaseId);
    } else {
      newSelected.add(purchaseId);
    }
    setSelectedPurchases(newSelected);
  };

  const deleteSelectedPurchases = async () => {
    if (selectedPurchases.size === 0) return;

    Alert.alert(
      'Excluir Compras',
      `Deseja excluir ${selectedPurchases.size} ${selectedPurchases.size === 1 ? 'compra' : 'compras'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const purchaseId of selectedPurchases) {
                await storage.archivePurchase(purchaseId);
              }
              setSelectedPurchases(new Set());
              setSelectionMode(false);
              await loadPurchases();
            } catch (error) {
              console.error('Error deleting purchases:', error);
              Alert.alert('Erro', 'Não foi possível excluir as compras');
            }
          },
        },
      ]
    );
  };

  const finalizePurchase = async () => {
    if (items.length === 0) {
      return;
    }
    const checkedItems = items.filter(item => item.checked);
    if (checkedItems.length === 0) {
      Alert.alert('Atenção', 'Selecione pelo menos um item para finalizar a compra');
      return;
    }
    setConfirmModalVisible(true);
  };

  const confirmFinalize = async () => {
    try {
      const checkedItems = items.filter(item => item.checked);
      const totalAmount = calculateCheckedTotal;
      await storage.addPurchase(checkedItems, selectedMarket, totalAmount);

      const uncheckedItems = items.filter(item => !item.checked);
      await storage.clearItems();

      for (const item of uncheckedItems) {
        await storage.addItem({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          market_id: item.market_id,
          barcode: item.barcode,
        });
      }

      await loadItems();

      const itemNames = await storage.getUniqueItemNames();
      setPreviousItems(itemNames);

      setConfirmModalVisible(false);
    } catch (error) {
      console.error('Error finalizing purchase:', error);
    }
  };

  const clearList = async () => {
    Alert.alert(
      'Limpar lista',
      'Deseja remover todos os itens da lista?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              await storage.clearItems();
              loadItems();
            } catch (error) {
              console.error('Error clearing list:', error);
            }
          },
        },
      ]
    );
  };

  const loadPurchases = async () => {
    try {
      console.log('Loading purchases from storage...');
      const purchasesData = await storage.getActivePurchases();
      console.log('Purchases loaded:', purchasesData.length);
      setPurchases(purchasesData);
    } catch (error) {
      console.error('Error loading purchases:', error);
    }
  };

  const openPurchasesModal = async () => {
    console.log('Opening purchases modal...');
    try {
      await loadPurchases();
      console.log('Purchases loaded, opening modal');
      setPurchasesModalVisible(true);
    } catch (error) {
      console.error('Error opening purchases modal:', error);
      Alert.alert('Erro', 'Não foi possível carregar o histórico');
    }
  };

  const createListFromPurchase = async (purchase: Purchase) => {
    try {
      console.log('Creating list from purchase:', purchase.id);

      await storage.clearItems();
      console.log('Items cleared');

      if (purchase.market_id) {
        const market = markets.find(m => m.id === purchase.market_id);
        if (market) {
          await storage.setSelectedMarket(market);
          setSelectedMarket(market);
          console.log('Market selected:', market.name);
        }
      }

      console.log('Adding items:', purchase.items.length);
      for (const item of purchase.items) {
        await storage.addItem({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          market_id: purchase.market_id,
          barcode: item.barcode,
        });
        console.log('Item added:', item.name);
      }

      await loadItems();
      const finalItems = await storage.getItems();
      console.log('Final items count:', finalItems.length);

      setPurchasesModalVisible(false);
      Alert.alert('Sucesso', `Lista criada com ${purchase.items.length} itens!`);
    } catch (error) {
      console.error('Error creating list from purchase:', error);
      Alert.alert('Erro', 'Não foi possível criar a lista de compras');
    }
  };

  const clearAllPurchases = () => {
    Alert.alert(
      'Limpar Histórico',
      'Tem certeza que deseja excluir todas as compras anteriores? Esta ação não pode ser desfeita.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await storage.clearPurchases();
              await loadPurchases();
              Alert.alert('Sucesso', 'Histórico de compras limpo.');
            } catch (error) {
              console.error('Error clearing purchases:', error);
              Alert.alert('Erro', 'Não foi possível limpar o histórico.');
            }
          },
        },
      ]
    );
  };

  const calculateTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.total_price), 0);
  }, [items]);

  const calculateCheckedTotal = useMemo(() => {
    return items
      .filter(item => item.checked)
      .reduce((sum, item) => sum + Number(item.total_price), 0);
  }, [items]);

  const getCheckedCount = useMemo(() => {
    return items.filter(item => item.checked).length;
  }, [items]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const getFilteredItems = () => {
    if (!searchQuery.trim()) {
      return items;
    }
    return items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const handleMarketSelect = async (market: Market) => {
    setSelectedMarket(market);
    await storage.setSelectedMarket(market);
    setMarketModalVisible(false);
  };

  const renderItem = ({ item }: { item: ShoppingItem }) => (
    <SwipeableItem onDelete={() => deleteItem(item.id)}>
      <View style={[styles.itemCard, item.checked && styles.itemCardChecked]}>
        <TouchableOpacity
          style={styles.checkboxButton}
          onPress={() => toggleItemChecked(item.id)}
          activeOpacity={0.7}>
          {item.checked ? (
            <CheckCircle2 size={16.8} color="#22c55e" />
          ) : (
            <Circle size={16.8} color="#9ca3af" />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.itemContent}
          onPress={() => startEditItem(item)}>
          <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>
            {item.name}
          </Text>
          <View style={styles.itemDetails}>
            <Text style={[styles.itemQuantity, item.checked && styles.itemQuantityChecked]}>
              {item.quantity}x {formatCurrency(Number(item.unit_price))}
            </Text>
            <Text style={[styles.itemTotal, item.checked && styles.itemTotalChecked]}>
              {formatCurrency(Number(item.total_price))}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteItem(item.id)}
          activeOpacity={0.7}>
          <Trash2 size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </SwipeableItem>
  );

  const renderMarketItem = ({ item }: { item: Market }) => (
    <TouchableOpacity
      style={[
        styles.marketItem,
        selectedMarket?.id === item.id && styles.marketItemSelected,
      ]}
      onPress={() => handleMarketSelect(item)}>
      <View style={styles.marketItemContent}>
        <Text style={styles.marketItemName}>{item.name}</Text>
        {item.location && (
          <Text style={styles.marketItemLocation}>{item.location}</Text>
        )}
      </View>
      {selectedMarket?.id === item.id && (
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedBadgeText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Watermark />
      <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.titleContainer}>
            <ShoppingCart size={19.012} color="#22c55e" />
            <Text style={styles.title}>Lista de Compras</Text>
          </View>
          {items.length > 0 && (
            <Text style={styles.itemsCount}>
              {getCheckedCount}/{items.length} itens
            </Text>
          )}
        </View>
      </View>

      <View style={styles.topBarContainer}>
        <TouchableOpacity
          style={styles.marketSelector}
          onPress={() => setMarketModalVisible(true)}>
          <Store size={16} color="#22c55e" />
          <Text style={styles.marketSelectorText}>
            {selectedMarket ? selectedMarket.name : 'Selecionar Mercado'}
          </Text>
          {selectedMarket?.location && (
            <Text style={styles.marketLocation}>• {selectedMarket.location}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickScanButton}
          onPress={() => {
            if (!selectedMarket) {
              Alert.alert('Erro', 'Selecione um mercado primeiro');
              return;
            }
            setQuickScannerVisible(true);
          }}
          activeOpacity={0.7}>
          <ScanBarcode size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {items.length > 0 && (
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
            onPress={() => {
              setQuickScannerVisible(true);
            }}
            style={styles.searchScanButton}>
            <ScanBarcode size={20} color="#22c55e" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.listWrapper}>
        <FlatList
          data={getFilteredItems()}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: 180 + insets.bottom }
          ]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Nenhum item na lista
              </Text>
              <Text style={styles.emptySubtext}>
                Adicione produtos para começar
              </Text>
            </View>
          }
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(calculateTotal)}
            </Text>
          </View>
          {getCheckedCount > 0 && (
            <View style={styles.checkedTotalRow}>
              <Text style={styles.checkedTotalLabel}>Selecionados:</Text>
              <Text style={styles.checkedTotalValue}>
                {formatCurrency(calculateCheckedTotal)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.footerButtons}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              console.log('Add button clicked');
              setModalVisible(true);
            }}
            activeOpacity={0.7}>
            <Plus size={14} color="#ffffff" />
            <Text style={styles.buttonText}>Adicionar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => {
              console.log('History button clicked!');
              openPurchasesModal();
            }}
            activeOpacity={0.7}>
            <Calendar size={14} color="#ffffff" />
            <Text style={styles.buttonText}>Histórico</Text>
          </TouchableOpacity>
          {getCheckedCount > 0 ? (
            <TouchableOpacity
              testID="finish-button"
              style={styles.finishButton}
              onPress={() => {
                console.log('Finish button pressed!');
                finalizePurchase();
              }}
              activeOpacity={0.7}
              disabled={false}>
              <ShoppingCart size={14} color="#ffffff" />
              <Text style={styles.buttonText}>Finalizar</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.finishButtonDisabled}>
              <ShoppingCart size={14} color="#9ca3af" />
              <Text style={styles.buttonTextDisabled}>Finalizar</Text>
            </View>
          )}
        </View>
      </View>

      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingItem ? 'Editar Item' : 'Adicionar Item'}
            </Text>
            <TouchableOpacity onPress={cancelEdit}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {isSearchingBarcode ? (
              <View style={styles.loadingIndicatorContainer}>
                <ActivityIndicator size="large" color="#22c55e" />
                <Text style={styles.loadingIndicatorText}>Buscando produto...</Text>
              </View>
            ) : ( <>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nome do Produto</Text>
              <View style={styles.inputWithButton}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  value={newItem.name}
                  onChangeText={handleNameChange}
                  placeholder="Ex: Arroz 5kg"
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity
                  style={styles.scanButton}
                  onPress={() => {
                    setModalVisible(false);
                    setScannerVisible(true);
                  }}>
                  <ScanBarcode size={20} color="#22c55e" />
                </TouchableOpacity>
              </View>

              {showSuggestions && filteredItems.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <FlatList
                    data={filteredItems}
                    keyExtractor={(item, index) => `${item.name}-${index}`}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => selectSuggestion(item.name, item.price)}>
                        <View style={styles.suggestionContent}>
                          <Text style={styles.suggestionText}>{item.name}</Text>
                          {item.price !== null && (
                            <Text style={styles.suggestionPrice}>
                              {formatCurrency(item.price)}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    )}
                    style={styles.suggestionsList}
                    keyboardShouldPersistTaps="handled"
                  />
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Código de Barras</Text>
              <TextInput
                style={styles.input}
                value={newItem.barcode}
                onChangeText={(text) =>
                  setNewItem({ ...newItem, barcode: text })
                }
                placeholder="Digite ou escaneie o código"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, styles.inputHalf]}>
                <Text style={styles.inputLabel}>Quantidade</Text>
                <TextInput
                  style={styles.input}
                  value={newItem.quantity}
                  onChangeText={(text) =>
                    setNewItem({ ...newItem, quantity: text })
                  }
                  placeholder="1"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputGroup, styles.inputHalf]}>
                <Text style={styles.inputLabel}>Preço Unitário</Text>
                <TextInput
                  style={styles.input}
                  value={newItem.unit_price}
                  onChangeText={handlePriceChange}
                  placeholder="R$ 0,00"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={addItem}>
              <Text style={styles.saveButtonText}>
                {editingItem ? 'Salvar Alterações' : 'Adicionar à Lista'}
              </Text>
            </TouchableOpacity>
            </>)}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={false}
        visible={marketModalVisible}
        onRequestClose={() => setMarketModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Selecionar Mercado</Text>
            <TouchableOpacity
              onPress={() => {
                setMarketModalVisible(false);
                setAddMarketMode(false);
              }}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {!addMarketMode ? (
              <>
                <FlatList
                  data={markets}
                  renderItem={renderMarketItem}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.marketList}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>Nenhum mercado cadastrado</Text>
                    </View>
                  }
                />
                <TouchableOpacity
                  style={styles.addMarketButton}
                  onPress={() => setAddMarketMode(true)}>
                  <Plus size={20} color="#22c55e" />
                  <Text style={styles.addMarketButtonText}>Novo Mercado</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nome do Mercado</Text>
                  <TextInput
                    style={styles.input}
                    value={newMarket.name}
                    onChangeText={(text) =>
                      setNewMarket({ ...newMarket, name: text })
                    }
                    placeholder="Ex: Supermercado ABC"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Localização (opcional)</Text>
                  <TextInput
                    style={styles.input}
                    value={newMarket.location}
                    onChangeText={(text) =>
                      setNewMarket({ ...newMarket, location: text })
                    }
                    placeholder="Ex: Centro, Rua Principal"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <TouchableOpacity style={styles.saveButton} onPress={addMarket}>
                  <Text style={styles.saveButtonText}>Salvar Mercado</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setAddMarketMode(false);
                    setNewMarket({ name: '', location: '' });
                  }}>
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onBarcodeScanned={handleBarcodeScanned}
      />

      <BarcodeScanner
        visible={quickScannerVisible}
        onClose={() => setQuickScannerVisible(false)}
        onBarcodeScanned={handleQuickScan}
      />

      <Modal
        animationType="slide"
        transparent={false}
        visible={purchasesModalVisible}
        onRequestClose={() => setPurchasesModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <Calendar size={16.8} color="#22c55e" />
              <Text style={styles.modalTitle}>Compras Anteriores</Text>
            </View>
            <View style={styles.modalHeaderActions}>
              {purchases.length > 0 && (
                <TouchableOpacity
                  onPress={toggleSelectionMode}
                  style={styles.selectButton}>
                  {selectionMode ? (
                    <CheckSquare size={20} color="#22c55e" />
                  ) : (
                    <Square size={20} color="#6b7280" />
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => {
                setPurchasesModalVisible(false);
                setSelectionMode(false);
                setSelectedPurchases(new Set());
              }}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.purchasesScrollView} contentContainerStyle={{ flexGrow: 1 }}>
            {purchases.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Calendar size={48} color="#9ca3af" />
                <Text style={styles.emptyText}>Nenhuma compra encontrada</Text>
                <Text style={styles.emptySubtext}>
                  Finalize uma compra primeiro para criar listas baseadas no histórico
                </Text>
              </View>
            ) : (
              purchases.map((purchase) => {
                const isExpanded = expandedPurchases.has(purchase.id);
                return (
                  <View key={purchase.id}>
                    <View style={styles.purchaseCard}>
                      {selectionMode && (
                        <TouchableOpacity
                          style={styles.checkboxContainer}
                          onPress={() => togglePurchaseSelection(purchase.id)}>
                          {selectedPurchases.has(purchase.id) ? (
                            <CheckSquare size={24} color="#22c55e" />
                          ) : (
                            <Square size={24} color="#9ca3af" />
                          )}
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[
                          styles.purchaseCardHeader,
                          selectionMode && { paddingLeft: 52 }
                        ]}
                        onPress={() => {
                          if (selectionMode) {
                            togglePurchaseSelection(purchase.id);
                          } else {
                            const newExpanded = new Set(expandedPurchases);
                            if (isExpanded) {
                              newExpanded.delete(purchase.id);
                            } else {
                              newExpanded.add(purchase.id);
                            }
                            setExpandedPurchases(newExpanded);
                          }
                        }}>
                        <View style={styles.purchaseHeader}>
                          <View style={styles.purchaseInfo}>
                            <Calendar size={16} color="#6b7280" />
                            <Text style={styles.purchaseDate}>
                              {new Date(purchase.completed_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </Text>
                          </View>
                          <Text style={styles.purchaseTotal}>
                            {formatCurrency(purchase.total_amount)}
                          </Text>
                        </View>
                        {purchase.market_name && (
                          <View style={styles.purchaseMarket}>
                            <Store size={14} color="#6b7280" />
                            <Text style={styles.purchaseMarketText}>{purchase.market_name}</Text>
                          </View>
                        )}
                        <View style={styles.purchaseItemsCountRow}>
                          <Text style={styles.purchaseItemsCount}>
                            {purchase.items_count} {purchase.items_count === 1 ? 'item' : 'itens'}
                          </Text>
                          <Text style={styles.expandIndicator}>
                            {isExpanded ? '▲' : '▼'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.purchaseItemsList}>
                          {purchase.items.map((item, index) => (
                            <View key={index} style={styles.purchaseItemRow}>
                              <Text style={styles.purchaseItemName}>• {item.name}</Text>
                              <Text style={styles.purchaseItemPrice}>
                                {formatCurrency(item.total_price)}
                              </Text>
                            </View>
                          ))}
                          <TouchableOpacity
                            style={styles.useListButton}
                            onPress={() => createListFromPurchase(purchase)}>
                            <ShoppingCart size={16} color="#22c55e" />
                            <Text style={styles.useListButtonText}>Usar esta lista</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
          {selectionMode && selectedPurchases.size > 0 && (
            <View style={styles.selectionFooter}>
              <Text style={styles.selectionCountText}>
                {selectedPurchases.size} {selectedPurchases.size === 1 ? 'compra selecionada' : 'compras selecionadas'}
              </Text>
              <TouchableOpacity
                style={styles.deleteSelectedButton}
                onPress={deleteSelectedPurchases}>
                <Trash2 size={18} color="#ffffff" />
                <Text style={styles.deleteSelectedButtonText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={confirmModalVisible}
        onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Finalizar Compra</Text>

            <View style={styles.confirmInfo}>
              {selectedMarket && (
                <View style={styles.confirmRow}>
                  <Store size={16} color="#6b7280" />
                  <Text style={styles.confirmLabel}>{selectedMarket.name}</Text>
                </View>
              )}

              <View style={styles.confirmRow}>
                <ShoppingCart size={16} color="#6b7280" />
                <Text style={styles.confirmLabel}>{getCheckedCount} {getCheckedCount === 1 ? 'item selecionado' : 'itens selecionados'}</Text>
              </View>

              <View style={styles.confirmTotalRow}>
                <Text style={styles.confirmTotalLabel}>Total:</Text>
                <Text style={styles.confirmTotalValue}>{formatCurrency(calculateCheckedTotal)}</Text>
              </View>
            </View>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setConfirmModalVisible(false)}>
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmFinishButton}
                onPress={confirmFinalize}>
                <Text style={styles.confirmFinishText}>Finalizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 21,
    paddingBottom: 11.2,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flex: 1,
    marginRight: 8.4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5.6,
    marginBottom: 2.8,
  },
  title: {
    fontSize: 19.012,
    fontWeight: '700',
    color: '#111827',
  },
  itemsCount: {
    fontSize: 9.8,
    fontWeight: '600',
    color: '#22c55e',
  },
  clearButtonContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    flexShrink: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 12.8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9.6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    padding: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  searchScanButton: {
    padding: 6,
    marginLeft: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  topBarContainer: {
    flexDirection: 'row',
    margin: 12.8,
    gap: 8,
  },
  marketSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12.8,
    borderRadius: 9.6,
    gap: 6.4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  quickScanButton: {
    backgroundColor: '#22c55e',
    padding: 12.8,
    borderRadius: 9.6,
    justifyContent: 'center',
    alignItems: 'center',
    width: 48,
    height: 48,
  },
  marketSelectorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  marketLocation: {
    fontSize: 11.2,
    color: '#6b7280',
    marginLeft: 3.2,
  },
  listWrapper: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 11.2,
    borderRadius: 8.4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8.4,
  },
  itemCardChecked: {
    backgroundColor: '#f0fdf4',
    opacity: 0.8,
  },
  checkboxButton: {
    padding: 2.8,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 12.6,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4.2,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: '#6b7280',
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemQuantity: {
    fontSize: 9.8,
    color: '#6b7280',
  },
  itemQuantityChecked: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  itemTotal: {
    fontSize: 11.2,
    fontWeight: '600',
    color: '#22c55e',
  },
  itemTotalChecked: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    zIndex: 10,
    elevation: 10,
  },
  totalContainer: {
    marginBottom: 12.8,
    gap: 6.4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  totalValue: {
    fontSize: 17.92,
    fontWeight: '700',
    color: '#22c55e',
  },
  checkedTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  checkedTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  checkedTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#22d3ee',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 8.4,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8.4,
    borderRadius: 8.4,
    gap: 2.8,
  },
  historyButton: {
    flex: 1,
    backgroundColor: '#fbbf24',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8.4,
    borderRadius: 8.4,
    gap: 2.8,
  },
  finishButton: {
    flex: 1,
    backgroundColor: '#22d3ee',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8.4,
    borderRadius: 8.4,
    gap: 2.8,
  },
  finishButtonDisabled: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8.4,
    borderRadius: 8.4,
    gap: 2.8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 8.4,
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: '#9ca3af',
    fontSize: 8.4,
    fontWeight: '600',
  },
  purchasesScrollView: {
    flex: 1,
    padding: 20,
  },
  purchaseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    position: 'relative',
  },
  purchaseCardHeader: {
    padding: 16,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#22c55e',
  },
  purchaseMarket: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  purchaseMarketText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  purchaseItemsCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  purchaseItemsCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  expandIndicator: {
    fontSize: 12,
    color: '#9ca3af',
  },
  purchaseItemsList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  purchaseItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  purchaseItemName: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  purchaseItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
    marginLeft: 12,
  },
  purchaseItemsMore: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  useListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  useListButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12.8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearHistoryButton: {
    padding: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16.8,
    fontWeight: '700',
    color: '#111827',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectButton: {
    padding: 8,
  },
  checkboxContainer: {
    position: 'absolute',
    left: 12,
    top: 12,
    zIndex: 10,
    padding: 4,
  },
  selectionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  selectionCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  deleteSelectedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  deleteSelectedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  inputWithButton: {
    flexDirection: 'row',
    gap: 8,
  },
  inputFlex: {
    flex: 1,
  },
  scanButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  marketList: {
    paddingBottom: 20,
  },
  marketItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  marketItemSelected: {
    borderColor: '#22c55e',
    borderWidth: 2,
    backgroundColor: '#f0fdf4',
  },
  marketItemContent: {
    flex: 1,
  },
  marketItemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  marketItemLocation: {
    fontSize: 14,
    color: '#6b7280',
  },
  selectedBadge: {
    backgroundColor: '#22c55e',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  addMarketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22c55e',
    gap: 8,
  },
  addMarketButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22c55e',
  },
  cancelButton: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 18,
    fontWeight: '600',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModal: {
    backgroundColor: '#ffffff',
    borderRadius: 12.8,
    padding: 19.2,
    width: '100%',
    maxWidth: 320,
  },
  confirmTitle: {
    fontSize: 19.2,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmInfo: {
    marginBottom: 19.2,
    gap: 9.6,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6.4,
  },
  confirmLabel: {
    fontSize: 12.8,
    color: '#6b7280',
  },
  confirmTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 9.6,
    paddingTop: 12.8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  confirmTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  confirmTotalValue: {
    fontSize: 22.4,
    fontWeight: '700',
    color: '#22c55e',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 9.6,
  },
  confirmCancelButton: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    padding: 12.8,
    borderRadius: 9.6,
    alignItems: 'center',
  },
  confirmCancelText: {
    color: '#6b7280',
    fontSize: 14.4,
    fontWeight: '600',
  },
  confirmFinishButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    padding: 12.8,
    borderRadius: 9.6,
    alignItems: 'center',
  },
  confirmFinishText: {
    color: '#ffffff',
    fontSize: 14.4,
    fontWeight: '600',
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: 200,
    overflow: 'hidden',
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggestionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  suggestionPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22c55e',
    marginLeft: 12,
  },
  loadingIndicatorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  loadingIndicatorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
});
