import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export default function Watermark() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Image
        source={require('@/assets/images/icone.png')}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  image: {
    width: 320,
    height: 320,
    opacity: 0.20,
  },
});
