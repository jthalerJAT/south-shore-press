import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // SSP brand palette — carry forward from v1 so visual identity is
        // continuous when we cut the production domain over.
        'brand-red': {
          DEFAULT: '#c8102e',
          dark: '#a00d24',
        },
        'brand-navy': '#1a2238',
      },
      fontFamily: {
        // Newspaper-style serif for body + headlines, system sans for UI chrome.
        serif: ['Georgia', '"Times New Roman"', 'serif'],
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        headline: ['Georgia', '"Times New Roman"', 'serif'],
      },
      maxWidth: {
        '8xl': '88rem',
      },
    },
  },
  plugins: [],
};

export default config;
