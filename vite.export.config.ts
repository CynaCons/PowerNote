import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import fs from 'fs'
import path from 'path'

/**
 * Plugin to inline the favicon as a data URI so the exported HTML is fully standalone.
 */
function inlineFavicon(): Plugin {
  return {
    name: 'inline-favicon',
    transformIndexHtml(html) {
      const faviconPath = path.resolve(__dirname, 'public/favicon.svg');
      if (fs.existsSync(faviconPath)) {
        const svg = fs.readFileSync(faviconPath, 'utf-8');
        const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
        return html.replace(
          /<link rel="icon"[^>]*\/>/,
          `<link rel="icon" type="image/svg+xml" href="${dataUri}" />`
        );
      }
      return html;
    },
  };
}

/**
 * Plugin to post-process the final HTML:
 * 1. Remove type="module" so file:// protocol works (no CORS)
 * 2. Move the main app script from <head> to after <div id="root"> so DOM is ready
 */
function fixForStandalone(): Plugin {
  return {
    name: 'fix-for-standalone',
    enforce: 'post',
    closeBundle() {
      const outPath = path.resolve(__dirname, 'dist-template/index.html');
      if (fs.existsSync(outPath)) {
        let html = fs.readFileSync(outPath, 'utf-8');

        // Remove crossorigin attribute (not needed for inlined scripts)
        html = html.replace(/ crossorigin/g, '');

        // Find the main app script tag
        const scriptStart = html.indexOf('<script type="module">');
        const scriptTagEnd = scriptStart + '<script type="module">'.length;
        // The real </script> is at the very end of the file (last occurrence)
        const scriptCloseStart = html.lastIndexOf('</script>');
        const scriptEnd = scriptCloseStart + '</script>'.length;

        if (scriptStart >= 0 && scriptCloseStart > scriptStart) {
          // Extract the JS content between the script tags
          let jsContent = html.substring(scriptTagEnd, scriptCloseStart);

          // CRITICAL: Escape </script and <script inside the JS bundle.
          // The minified JS contains literal HTML strings (from marked library,
          // serialization code, etc.) that the browser's HTML parser would
          // interpret as actual tags, breaking the script.
          jsContent = jsContent.replace(/<\/script/gi, '<\\/script');
          jsContent = jsContent.replace(/<script/gi, '\\x3cscript');

          const appScript = `<script type="module">${jsContent}</script>`;
          const before = html.substring(0, scriptStart);
          const after = html.substring(scriptEnd);

          // Move script to before </body>
          const lastBodyClose = after.lastIndexOf('</body>');
          if (lastBodyClose >= 0) {
            const afterBefore = after.substring(0, lastBodyClose);
            const afterAfter = after.substring(lastBodyClose);
            html = before + afterBefore + appScript + '\n' + afterAfter;
          } else {
            html = before + appScript + after;
          }
        }

        fs.writeFileSync(outPath, html, 'utf-8');
      }
    },
  };
}

/**
 * Vite config for building the self-contained export template.
 * Produces a single HTML file with all JS/CSS/assets inlined.
 * This template is used by the export function to inject user data.
 */
export default defineConfig({
  plugins: [react(), viteSingleFile(), inlineFavicon(), fixForStandalone()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-reconciler'],
  },
  build: {
    outDir: 'dist-template',
    emptyOutDir: true,
    assetsInlineLimit: Infinity,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
