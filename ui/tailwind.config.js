/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        xs: '320px', // Extra small screen breakpoint
        sm: '344px', // Small screen breakpoint
        base: '768px',
        md: '960px',
        lg: '1440px',
      },
      fontSize: {
        xs: ['0.6rem', { lineHeight: '1rem' }], // Extra small screen font size
        sm: ['0.875rem', { lineHeight: '1.25rem' }], // Small screen font size
        base: ['0.9rem', { lineHeight: '1.5rem' }], // Base font size
        lg: ['1.125rem', { lineHeight: '1.75rem' }], // Large screen font size
        xl: ['1.25rem', { lineHeight: '1.75rem' }], // Extra large screen font size
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0 },
        },
        loadingBar: {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        streamReveal: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        streamFade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        blink: 'blink 1s step-start infinite',
        loadingBar: 'loadingBar 2s ease-in-out infinite',
        'stream-reveal': 'streamReveal 420ms ease-out both',
        'stream-fade': 'streamFade 300ms ease-out both',
      },
    },
  },

  variants: {
    extend: {
      visibility: ['group-hover'],
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
