import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Kitchen chalkboard backdrop
        board: {
          DEFAULT: "#1B2420",
          light: "#232F29",
        },
        // Order-ticket paper
        paper: "#F7F3E8",
        // "Gold" — literal reference to برند بنیتاگلد
        gold: {
          DEFAULT: "#C9A227",
          soft: "#E4C860",
        },
        // Open / accepting orders
        open: "#5C8A5C",
        // Closed / outside window
        closed: "#B23A2E",
        ink: "#20261F",
      },
      fontFamily: {
        vazir: ["Vazirmatn", "system-ui", "sans-serif"],
      },
      boxShadow: {
        ticket: "0 18px 45px -18px rgba(0,0,0,0.55)",
      },
    },
  },
  plugins: [],
};

export default config;
