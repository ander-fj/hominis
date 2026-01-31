export const mrsTheme = {
  colors: {
    primary: {
      DEFAULT: '#002b55',
      dark: '#001f3f',
      light: '#003d73',
    },
    secondary: {
      DEFAULT: '#ffcc00',
      dark: '#e6b800',
      light: '#ffd633',
    },
    white: '#ffffff',
    gray: {
      50: '#f8f9fa',
      100: '#f1f3f5',
      200: '#e9ecef',
      300: '#dee2e6',
      400: '#ced4da',
      500: '#adb5bd',
      600: '#6c757d',
      700: '#495057',
      800: '#343a40',
      900: '#212529',
    }
  },
  gradients: {
    primary: 'linear-gradient(135deg, #002b55 0%, #003d73 100%)',
    secondary: 'linear-gradient(135deg, #ffcc00 0%, #ffd633 100%)',
    primaryToSecondary: 'linear-gradient(135deg, #002b55 0%, #ffcc00 100%)',
  }
};

export const getMedalEmoji = (position: number): string => {
  switch (position) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return '';
  }
};

export const getMedalColor = (position: number): string => {
  switch (position) {
    case 1: return 'from-yellow-400 to-yellow-600';
    case 2: return 'from-gray-300 to-gray-500';
    case 3: return 'from-orange-400 to-orange-600';
    default: return 'from-blue-100 to-blue-200';
  }
};
