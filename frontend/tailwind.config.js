import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          900: '#0b1120',
        },
      },
      boxShadow: {
        card: '0 10px 40px -15px rgba(15, 23, 42, 0.3)',
        toast: '0 8px 20px -15px rgba(15, 23, 42, 0.4)',
      },
      borderRadius: {
        xl: '1rem',
      },
      animation: {
        'toast-in': 'toast-in 0.2s ease-out',
        'toast-out': 'toast-out 0.2s ease-in forwards',
      },
      keyframes: {
        'toast-in': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0px)', opacity: '1' },
        },
        'toast-out': {
          '0%': { transform: 'translateY(0px)', opacity: '1' },
          '100%': { transform: 'translateY(12px)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
