import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    // Team colors
    "bg-blue-900", "text-white", "bg-purple-600", "bg-blue-300", "text-blue-900", "bg-stone-200", "text-stone-700", "bg-white", "text-blue-600",
    // Match card backgrounds
    "bg-green-50", "border-green-100", "hover:border-green-200", "text-green-700",
    "bg-gray-50", "border-gray-100", "hover:border-gray-200", "text-gray-600",
    // Stats section backgrounds
    "bg-blue-50", "bg-stone-50", "bg-white",
  ],
  theme: {
    extend: {
      colors: {
        handball: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
