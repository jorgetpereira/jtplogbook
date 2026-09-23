import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// O plugin do Base44 foi retirado: a app já não depende do backend deles
// nem das ferramentas do editor.
export default defineConfig({
  logLevel: 'error',
  plugins: [react()],
})
