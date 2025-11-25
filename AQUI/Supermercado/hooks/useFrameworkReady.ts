import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

export function useFrameworkReady() {
  const [isReady, setIsReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.frameworkReady) {
        window.frameworkReady();
      }
      setIsReady(true);
    }
  }, []);

  return isReady;
}
