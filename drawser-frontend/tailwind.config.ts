import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        slateNight: '#0B111A',
        steel: '#172334',
        ink: '#EAF2FF',
        aqua: '#3CD2D1',
        ember: '#FF8A4C',
        moss: '#6EBA7E'
      },
      boxShadow: {
        glass: '0 10px 30px rgba(0, 0, 0, 0.25)'
      },
      animation: {
        fadeIn: 'fadeIn 450ms ease-out',
        riseIn: 'riseIn 500ms ease-out',
        pulseSoft: 'pulseSoft 1.4s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        riseIn: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        pulseSoft: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.75' },
          '50%': { transform: 'scale(1.03)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
};

export default config;
