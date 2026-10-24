import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1f2933', soft: '#52606d', faint: '#9aa5b1' },
        paper: { DEFAULT: '#fbfaf7', raised: '#ffffff', sunk: '#f2efe9' },
        line: '#e4e0d8',
        accent: { DEFAULT: '#2f6f73', soft: '#e3f0ef' },
        teacher: { DEFAULT: '#1f6f8b', soft: '#e7f2f6' },
        sample: { DEFAULT: '#6b3fa0', soft: '#f1ebf8' },
        eld: { DEFAULT: '#8a5a00', soft: '#fbf3e2' },
        support: { DEFAULT: '#3f6b2a', soft: '#eef5e9' },
        danger: { DEFAULT: '#b42318', soft: '#fdecea' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
