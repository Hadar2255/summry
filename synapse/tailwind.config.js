/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  // Hover styles only on devices that can hover, so taps on iPad don't leave elements stuck in a hover state.
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        raised: token('raised'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        faint: token('faint'),
        accent: token('accent'),
        'accent-ink': token('accent-ink'),
        good: token('good'),
        warn: token('warn'),
        bad: token('bad')
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.99)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        'flip-in': {
          '0%': { opacity: '0', transform: 'rotateX(-12deg) translateY(6px)' },
          '100%': { opacity: '1', transform: 'rotateX(0) translateY(0)' }
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.55' },
          '50%': { transform: 'scale(1.06)', opacity: '0.9' }
        }
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'rise-in': 'rise-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'flip-in': 'flip-in 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        breathe: 'breathe 6s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
