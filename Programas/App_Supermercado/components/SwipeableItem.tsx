import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

interface SwipeableItemProps {
  children: ReactNode;
  onDelete: () => void;
}

export default function SwipeableItem({ children, onDelete }: SwipeableItemProps) {
  return (
    <View style={styles.container}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 12,
  },
  deleteBackground: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
  },
});
