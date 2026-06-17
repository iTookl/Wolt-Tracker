/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Акцент в духе Wolt (голубой)
        brand: {
          DEFAULT: '#00a6e0',
          400: '#22b8f0',
          500: '#00a6e0',
          600: '#0089bd',
        },
        ink: {
          950: '#0a0f1a',
          900: '#0f1626',
          800: '#172033',
          700: '#202b42',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
