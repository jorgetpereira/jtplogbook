import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// O plugin do Base44 foi retirado: a app já não depende do backend deles.
// O atalho "@" para a pasta src era fornecido por esse plugin, por isso
// passa a ser declarado aqui.
export default defineConfig({
  logLevel: 'error',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
