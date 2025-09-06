/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './index.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        mc: {
          bg: '#0e131f',
          surface: '#131c29',
          text: '#d5e1f5',
          textDim: '#9fb0c7',
          primary: '#2b8280',
          info: '#66c2ff',
          warn: '#dba741',
          purpleAccent: '#C522FF',
          stroke: '#1a2332',
        },
      },
      borderRadius: {
        xl2: '1.25rem',
        xl: "14px",
      },
      boxShadow: {
        soft: '0 8px 24px rgba(0,0,0,0.25)',
        card: '0 4px 12px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.08)',
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      spacing: {
        18: "4.5rem",
      },
    },
  },
  plugins: [],
};
