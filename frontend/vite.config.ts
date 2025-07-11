import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import cesium from 'vite-plugin-cesium'
import path from 'path'
import fs from 'fs'
import os from 'os'

function getLocalIp(): string {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address
            }
        }
    }
    return '127.0.0.1'
}

const ip = getLocalIp()
const certPath = `../${ip}.pem`
const keyPath = `../${ip}-key.pem`

const useHttps = fs.existsSync(certPath) && fs.existsSync(keyPath)
const httpsOptions = useHttps
    ? {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
    }
    : undefined

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "src": path.resolve(__dirname, "src"),
            cesium: 'cesium',
        },
    },
    plugins: [
        tailwindcss(),
        react(),
        cesium(),
    ],
    server: {
        host: ip,
        https: httpsOptions,
    },
    define: {
        CESIUM_BASE_URL: JSON.stringify('/cesium')
    }
})
