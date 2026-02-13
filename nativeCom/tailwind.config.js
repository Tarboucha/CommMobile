/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ========== BRAND COLORS (static) ==========
        burgundy: "#7a0000",//#8b0000, #660000
        wine: "#8B3A42",
        "burgundy-light": "#A64D55",
        beige: "#F5E6D3",
        cream: "#FAF7F2",
        "dusty-pink": "#C4A4A4",
        rose: "#B45A69",
        "rose-light": "#E8D5D5",

        // ========== SEMANTIC COLORS (CSS variables) ==========
        background: "var(--background)",
        foreground: "var(--foreground)",

        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },

        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },

        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },

        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },

        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },

        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },

        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },

        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",

        // ========== STATUS COLORS (CSS variables) ==========
        success: {
          DEFAULT: "var(--success)",
        },

        warning: {
          DEFAULT: "var(--warning)",
        },

        error: {
          DEFAULT: "var(--error)",
        },

        info: {
          DEFAULT: "var(--info)",
          background: "var(--info-background)",
          foreground: "var(--info-text)",
        },

        available: {
          DEFAULT: "var(--available)",
          background: "var(--available-background)",
          foreground: "var(--available-text)",
        },

        featured: {
          DEFAULT: "var(--featured)",
          background: "var(--featured-background)",
          foreground: "var(--featured-text)",
        },

        purple: {
          DEFAULT: "var(--purple)",
          background: "var(--purple-background)",
          foreground: "var(--purple-text)",
        },

        notification: {
          DEFAULT: "var(--notification)",
          background: "var(--notification-background)",
          foreground: "var(--notification-text)",
        },
      },

      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        xxl: "48px",
      },

      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },

      fontSize: {
        title: ["32px", { lineHeight: "40px", fontWeight: "700" }],
        subtitle: ["18px", { lineHeight: "24px", fontWeight: "400" }],
        body: ["16px", { lineHeight: "22px", fontWeight: "400" }],
        button: ["16px", { lineHeight: "20px", fontWeight: "600" }],
        caption: ["14px", { lineHeight: "18px", fontWeight: "400" }],
      },
    },
  },
  plugins: [],
};
