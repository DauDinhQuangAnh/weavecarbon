import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Manrope", "system-ui", "-apple-system", "sans-serif"],
        heading: ["Manrope", "system-ui", "-apple-system", "sans-serif"],
      },

      letterSpacing: {
        tightest: "-0.025em",
        tighter: "-0.01em",
      },

      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",

        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",

        popover: "var(--popover)",
        "popover-foreground": "var(--popover-foreground)",

        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",

        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",

        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",

        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",

        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",

        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",

        forest: {
          dark: "var(--forest-dark, #2C441D)",
          light: "var(--forest-light, #3A7859)",
        },
        earth: {
          warm: "var(--earth-warm, #2F4D1F)",
          light: "var(--earth-light, #DEE9D8)",
        },
        navy: "var(--navy, #17260D)",
        warning: "var(--warning, #DA9B2F)",
        cream: "var(--cream, #F6F8F2)",
        charcoal: "var(--charcoal, #52644A)",

        sidebar: {
          background: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },

      borderRadius: {
        lg: "var(--radius, 0.85rem)",
        md: "calc(var(--radius, 0.85rem) - 2px)",
        sm: "calc(var(--radius, 0.85rem) - 4px)",
      },

      boxShadow: {
        sm: "var(--shadow-sm, 0 2px 8px -5px rgba(23, 38, 13, 0.18))",
        md: "var(--shadow-md, 0 16px 40px -24px rgba(23, 38, 13, 0.36))",
        lg: "var(--shadow-lg, 0 26px 70px -30px rgba(23, 38, 13, 0.42))",
        glow: "var(--shadow-glow, 0 20px 70px -22px rgba(20, 82, 51, 0.42))",
      },

      backgroundImage: {
        "gradient-forest":
          "linear-gradient(135deg, var(--forest-dark, #2C441D), var(--forest-light, #3A7859))",
        "gradient-earth":
          "linear-gradient(135deg, var(--earth-warm, #2F4D1F), var(--earth-light, #DEE9D8))",
        "gradient-hero":
          "radial-gradient(ellipse at 20% 15%, rgba(58, 120, 89, 0.22) 0%, transparent 60%), linear-gradient(180deg, #F6F8F2 0%, #EDF2E8 100%)",
      },

      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)", filter: "blur(5px)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.965)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.72" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },

      animation: {
        "fade-up": "fadeUp 0.72s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "fade-in": "fadeIn 0.52s ease-out forwards",
        "scale-in": "scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        float: "float 7s ease-in-out infinite",
        "pulse-soft": "pulseSoft 3s ease-in-out infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;