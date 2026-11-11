import type { Config } from "tailwindcss";

export default {
  content: ["./src/ui/**/*.{ts,tsx}"],
  prefix: "bd-",
  important: ".budde",
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: Object.fromEntries(["background", "foreground", "card", "muted", "muted-foreground", "border", "input", "primary", "primary-foreground", "primary-hover", "accent", "ring", "scrim"].map(name => [name, `rgb(var(--bd-${name}) / <alpha-value>)`])),
      fontFamily: { sans: ["var(--b3-font-family, 'Segoe UI')", "Microsoft YaHei", "system-ui", "sans-serif"], brand: ["BuddeBrandQuicksand", "system-ui", "sans-serif"] },
      fontSize: { control: ["13px", "20px"] },
      boxShadow: { xs: "0 1px 2px rgb(0 0 0 / 0.04)" },
      transitionDuration: { DEFAULT: "200ms" },
      borderRadius: { lg: "8px", md: "6px", sm: "4px" },
    },
  },
  plugins: [],
} satisfies Config;
