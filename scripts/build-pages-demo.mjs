import fs from 'node:fs';
import path from 'node:path';

const [templatePath, workspacePath, outputPath] = process.argv.slice(2);
if (!templatePath || !workspacePath || !outputPath) {
  throw new Error('Usage: node build-pages-demo.mjs TEMPLATE WORKSPACE OUTPUT');
}

const template = fs.readFileSync(templatePath, 'utf8');
const workspace = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
const safeJson = JSON.stringify(workspace, null, 2).replace(/</g, '\\u003c');
const data = `<script id="powernote-data" type="application/json">\n${safeJson}\n</script>`;
const existing = /<script id="powernote-data"[^>]*>[\s\S]*?<\/script>/;
const output = existing.test(template)
  ? template.replace(existing, data)
  : template.replace('</head>', `${data}\n</head>`);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output);
