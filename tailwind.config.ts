import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Paleta corporativa BaldeCash
        blue: {
          100: '#D6DCED', 200: '#98A9DF', 300: '#6873D7', 400: '#4453A0',
          500: '#31359C', 600: '#212469', 700: '#151744',
        },
        aqua: {
          100: '#E0F1F3', 200: '#BEF7F3', 300: '#A9DAE6', 400: '#5CBFBE',
          500: '#36B7B3', 600: '#00A29B', 700: '#007974',
        },
        gold: {
          100: '#FFF7E6', 200: '#FFEABB', 300: '#FEDD90', 400: '#FDCA56',
          500: '#D1A646', 600: '#987933', 700: '#4D3D1C',
        },
        // Neutros derivados
        ink:    '#0E1228',
        ink2:   '#2E3358',
        muted:  '#6B7197',
        muted2: '#9CA3C5',
        line:   '#E4E7F2',
        line2:  '#CDD3E5',
        bg:     '#F5F6FB',
        surface:'#FFFFFF',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(21,23,68,.04), 0 1px 2px 0 rgba(21,23,68,.04)',
        cardHover: '0 4px 20px -4px rgba(21,23,68,.10)',
      },
    },
  },
  plugins: [],
};

export default config;
