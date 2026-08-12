/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#000000",
        "on-primary": "#ffffff",
        secondary: "#40674d",
        sage: "#7FA88A",
        "sage-light": "#A8D5BA",
        peach: "#FFDAB9",
        background: "#f9f9f9",
        surface: "#ffffff",
        "surface-low": "#f4f3f3",
        "surface-high": "#e8e8e8",
        "on-surface": "#1a1c1c",
        "on-surface-variant": "#444748",
        outline: "#747878",
        "outline-variant": "#c4c7c7",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
      },
      borderRadius: {
        card: "16px",
        input: "12px",
      },
      spacing: {
        "container-margin": "20px",
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.35s ease-out both",
        "fade-in": "fadeIn 0.25s ease-out both",
        "pop-in": "popIn 0.25s ease-out both",
      },
    },
  },
  plugins: [],
};