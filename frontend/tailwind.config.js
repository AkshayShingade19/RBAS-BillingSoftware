/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dce7fd',
          200: '#c0d5fc',
          300: '#94b8fa',
          400: '#6291f6',
          500: '#3d6bf0',
          600: '#2749e0',
          700: '#1f38c2',
          800: '#1e329c',
          900: '#1d2f7c',
          950: '#16204c',
        },
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5d9e2',
          300: '#b0b8c8',
          400: '#8591a8',
          500: '#66738e',
          600: '#515c75',
          700: '#434b60',
          800: '#3b4151',
          900: '#242831',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.1)',
        pop: '0 8px 30px rgba(16, 24, 40, 0.16)',
      },
    },
  },
  plugins: [],
};