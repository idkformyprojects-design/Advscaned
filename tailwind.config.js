/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#F5F7FA',
          100: '#E8EDF4',
          200: '#CBD5E1',
          300: '#94A3B8',
          400: '#64748B',
          500: '#475569',
          600: '#334155',
          700: '#1E293B',
          800: '#131C2B',
          900: '#0B1220',
          950: '#060B14',
        },
        brand: {
          50: '#E9FBF6',
          100: '#C7F5E9',
          200: '#8FEAD6',
          300: '#52D9BE',
          400: '#22C3A5',
          500: '#0AA98C',
          600: '#068772',
          700: '#076B5B',
          800: '#08554A',
          900: '#07463E',
        },
        accent: {
          300: '#FFDD7A',
          400: '#FFCC47',
          500: '#FFB703',
          600: '#E09A00',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,18,32,.04), 0 8px 24px -12px rgba(11,18,32,.18)',
        float: '0 12px 40px -12px rgba(11,18,32,.35)',
        glow: '0 8px 28px -8px rgba(10,169,140,.55)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'slide-up': {
          from: { transform: 'translateY(24px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pop-in': {
          '0%': { transform: 'scale(.9)', opacity: '0' },
          '60%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'slide-up': 'slide-up .32s cubic-bezier(.22,1,.36,1) both',
        'fade-in': 'fade-in .25s ease both',
        'pop-in': 'pop-in .28s cubic-bezier(.22,1,.36,1) both',
      },
    },
  },
  plugins: [],
};
