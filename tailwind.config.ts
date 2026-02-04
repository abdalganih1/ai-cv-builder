import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: "#1e3a5f",
                    dark: "#0d1f3c",
                    light: "#2d4a6f",
                },
                accent: {
                    DEFAULT: "#0891b2",
                    dark: "#0e7490",
                    light: "#22d3ee",
                },
            },
            fontFamily: {
                sans: ["IBM Plex Sans Arabic", "system-ui", "sans-serif"],
                arabic: ["IBM Plex Sans Arabic", "sans-serif"],
            },
        },
    },
    plugins: [],
};

export default config;
