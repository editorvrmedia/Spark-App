/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // allows manual or system preference toggle
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f3ff',
          100: '#e0e7ff',
          500: '#6366f1', // Sleek indigo/violet primary
          600: '#4f46e5',
          700: '#4338ca',
        },
        dark: {
          surface: '#121212',
          card: '#1e1e1e',
          border: '#2e2e2e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-up': 'scaleUp 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        'drift-slow': 'drift 25s infinite alternate ease-in-out',
        'drift-reverse-slow': 'drift-reverse 20s infinite alternate ease-in-out',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleUp: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        drift: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.95)' },
        },
        'drift-reverse': {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(-40px, 30px) scale(0.9)' },
          '66%': { transform: 'translate(20px, -40px) scale(1.15)' },
        }
      }
    },
  },
  plugins: [],
}
