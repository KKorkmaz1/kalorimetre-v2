/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        // Dark-mode surface palette  (use as: dark:bg-night-bg, dark:border-night-border …)
        night: {
          bg:     '#0C0F1A',
          card:   '#161B2E',
          border: '#1E2640',
          muted:  '#2D3652',
          text:   '#C4CDD8',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      maxWidth: {
        app: '480px',
      },
      boxShadow: {
        emerald: '0 4px 24px -4px rgba(16,185,129,0.30)',
        card:    '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px 0 rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
}
