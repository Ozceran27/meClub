/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta meClub (dark)
        mc: {
          bg: "#0e131f",
          surface: "#131c29",
          text: "#d5e1f5",
          textDim: "#9fb0c7",
          primary: "#2b8280",   // botones/acciones (verde esmeralda)
          info: "#66c2ff",      // celeste para títulos/indicadores
          warn: "#dba741",      // dorado para highlights/eventos
          stroke: "#1a2332",
          card: "#151e2d",
        },
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        soft: "0 8px 24px rgba(0,0,0,0.25)",
      },
      fontFamily: {
        inter: ["Inter_400Regular", "Inter_600SemiBold", "Inter_700Bold"],
      },
    },
  },
  plugins: [],
};
