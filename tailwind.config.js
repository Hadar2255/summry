/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Assistant', 'Heebo', 'system-ui', 'sans-serif']
      },
      colors: {
        sapphire: {
          DEFAULT: '#0F2042',
          800: '#152a5a',
          700: '#1f3a73'
        }
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        'ring-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.6)' },
          '50%': { boxShadow: '0 0 0 14px rgba(239,68,68,0)' }
        }
      },
      animation: {
        'slide-up': 'slide-up 0.25s ease-out',
        'ring-pulse': 'ring-pulse 1.6s ease-out infinite'
      }
    }
  },
  plugins: []
};
