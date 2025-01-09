export const theme = {
  colors: {
    primary: '#FF4D8C',
    primaryLight: '#FF85A1',
    primaryDark: '#E63371',
    secondary: '#6366F1',
    secondaryLight: '#818CF8',
    background: '#FFFFFF',
    gradients: {
      primary: 'linear-gradient(135deg, #FF4D8C, #FF85A1)',
      secondary: 'linear-gradient(135deg, #6366F1, #818CF8)',
      background: 'linear-gradient(135deg, #FDF2F8, #EEF2FF)',
    },
    text: {
      primary: '#111827',
      secondary: '#4B5563',
      light: '#6B7280',
    },
    border: 'rgba(0, 0, 0, 0.1)',
  },
  fonts: {
    body: '"Inter", sans-serif',
    heading: '"Poppins", sans-serif',
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    full: '9999px',
  },
};

export type Theme = typeof theme; 