import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-export-template',
      configureServer(server) {
        // Serve dist-template/index.html at /dist-template/index.html in dev
        server.middlewares.use('/dist-template/index.html', (_req, res) => {
          const templatePath = path.resolve(__dirname, 'dist-template/index.html');
          if (fs.existsSync(templatePath)) {
            res.setHeader('Content-Type', 'text/html');
            res.end(fs.readFileSync(templatePath, 'utf-8'));
          } else {
            res.statusCode = 404;
            res.end('Template not found. Run: npm run build:template');
          }
        });
      },
    },
  ],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-reconciler'],
  },
})
