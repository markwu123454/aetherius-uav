/* vite.config.js */
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path";
import cesium from 'vite-plugin-cesium';

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        cesium(),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),       // ✅ Use "@/components/..."
            "src": path.resolve(__dirname, "src"),      // or "src/components/..."
        },
    },
    define: {
        CESIUM_BASE_URL: JSON.stringify('/cesium')
    }
})
