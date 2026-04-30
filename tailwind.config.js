/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{ts,tsx}',
    '!./node_modules/**',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#002349',
        gold: '#B89C47',
        'afh-navy': '#002349',
        'afh-navy-dark': '#001A36',
        'afh-gold': '#B89C47',
        'afh-gold-light': '#D4BC6A',
        'navy-sidebar': '#002349',
        'background-light': '#F8F7F4',
        'background-dark': '#0A1A2F',
      },
      fontFamily: {
        sans: ['"Benton Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Mercury Display"', '"Freight Big Pro"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
};
