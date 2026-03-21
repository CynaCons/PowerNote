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

        // Move the main app script from <head> to <body>.
        // CRITICAL: We cannot use string .replace() because the minified JS
        // contains HTML-like strings (</body>, <div id="root">, etc.) in
        // template literals. Any replace would corrupt the bundle.
        //
        // Instead: find the script's byte positions and surgically splice.
        const scriptStart = html.indexOf('<script type="module">');
        const scriptEnd = html.indexOf('</script>', scriptStart) + '</script>'.length;

        if (scriptStart >= 0 && scriptEnd > scriptStart) {
          const appScript = html.substring(scriptStart, scriptEnd);
          const before = html.substring(0, scriptStart);
          const after = html.substring(scriptEnd);

          // Find the LAST </body> tag (the real one, at the end of the file)
          const lastBodyClose = after.lastIndexOf('</body>');
          if (lastBodyClose >= 0) {
            const afterBefore = after.substring(0, lastBodyClose);
            const afterAfter = after.substring(lastBodyClose);
            html = before + afterBefore + appScript + '\n' + afterAfter;
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
