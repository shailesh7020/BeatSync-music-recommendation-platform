/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        spotify: {
          green: "#1DB954",
          greenHover: "#1ed760",
          black: "#121212",
          surface: "#181818",
          card: "#242424",
          cardHover: "#2a2a2a",
          muted: "#a7a7a7",
          divider: "#282828",
        },
      },
    },
  },
  plugins: [],
};
