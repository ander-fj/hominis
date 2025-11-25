import React, { useState, useEffect } from 'react';
import { View, Button, Alert, Modal, StyleSheet } from 'react-native';
import { CameraView, Camera } from 'expo-camera/next';

export default function ProductScanner({ onProductScanned }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [isScannerVisible, setScannerVisible] = useState(false);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = async ({ data }) => {
    setScanned(true);
    setScannerVisible(false);

    let barcode = data;
    if (data.includes('openfoodfacts.org')) {
      const urlParts = data.split('/');
      barcode = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
    }
    
    // **** DEBUG 1: VER O QUE ESTAMOS TENTANDO BUSCAR ****
    console.log(`--- ProductScanner: Tentando buscar o código: ${barcode} ---`);

    try {
      const response = await fetch(`https://br.openfoodfacts.org/api/v2/product/${barcode}`);
      const json = await response.json();
      
      // **** DEBUG 2: VER A RESPOSTA COMPLETA DA API ****
      console.log('--- ProductScanner: Resposta recebida da API: ---');
      console.log(JSON.stringify(json, null, 2)); // Imprime o objeto JSON de forma legível

      let productName = null;
      if (json.status === 1 && json.product?.product_name) {
        productName = json.product.product_name_pt || json.product.product_name;
      }
      
      // **** DEBUG 3: VER O QUE ESTAMOS ENVIANDO PARA A TELA PAI ****
      console.log(`--- ProductScanner: Enviando para a tela pai: { barcode: '${barcode}', name: '${productName}' } ---`);

      if (onProductScanned) {
        onProductScanned({ barcode: barcode, name: productName });
      }

    } catch (error) {
      console.error('--- ProductScanner: ERRO DE REDE ---', error);
      Alert.alert('Erro de Rede', 'Não foi possível conectar à API do Open Food Facts.');
      if (onProductScanned) {
        onProductScanned({ barcode: barcode, name: null });
      }
    }
  };

  return (
    <View>
      <Modal visible={isScannerVisible} onRequestClose={() => setScannerVisible(false)}>
        <CameraView
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "qr"] }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.closeButtonContainer}>
          <Button title="Fechar" onPress={() => setScannerVisible(false)} color="#fff" />
        </View>
      </Modal>

      <Button
        title="Escanear Código para Preencher"
        onPress={() => {
          if (hasPermission) {
            setScanned(false);
            setScannerVisible(true);
          } else {
            Alert.alert("Sem permissão", "A permissão da câmera é necessária para escanear.");
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  closeButtonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});