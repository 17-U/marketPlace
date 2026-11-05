import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf4ee",
          100: "#faf0da",
          200: "#f4d9b0",
          300: "#eabd7e",
          400: "#de9a52",
          500: "#cf7a33",
          600: "#b35f27",
          700: "#8f4821",
          800: "#733a20",
          900: "#5f311d",
        },
        clay: {
          50: "#f7f5f2",
          100: "#eee9e2",
          500: "#7a6a58",
          700: "#4f4438",
          900: "#2c2620",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
