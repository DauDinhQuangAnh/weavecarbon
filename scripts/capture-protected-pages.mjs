// One-time creation for the user's freeze rule. Refuses to replace a baseline.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { contentHash } from './check-protected-pages.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'docs/protected-pages.snapshot.json');
if (fs.existsSync(destination)) throw new Error('Protection baseline already exists. Do not refresh it to hide changes.');
const paths = ['/overview', '/products', '/logistics', '/carbon-calculator', '/evidence', '/export', '/reports', '/audit-trail', '/billing'];
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(directory, e.name)) : [path.join(directory, e.name)]);
const seen = new Set();
const allowedSidebar = path.join(root, 'components/dashboard/DashboardSidebar.tsx');
const resolve = (from, specifier) => {
  const candidate = specifier.startsWith('@/') ? path.join(root, specifier.slice(2)) : specifier.startsWith('.') ? path.resolve(path.dirname(from), specifier) : null;
  if (!candidate) return null;
  return ['', '.ts', '.tsx', '.js', '.mjs', '.json', '.css', '/index.ts', '/index.tsx', '/index.js'].map(ext => candidate + ext).find(file => fs.existsSync(file) && fs.statSync(file).isFile());
};
function visit(file) {
  if (file === allowedSidebar || seen.has(file)) return;
  seen.add(file);
  if (!/\.(ts|tsx|js|mjs)$/.test(file)) return;
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function inspect(node) {
    const literal = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier :
      ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require') ? node.arguments[0] : null;
    if (literal && ts.isStringLiteral(literal)) { const dependency = resolve(file, literal.text); if (dependency) visit(dependency); }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
}
for (const route of paths) for (const base of ['app/(dashboard)', 'app/demo']) {
  const directory = path.join(root, base, route.slice(1));
  if (!fs.existsSync(directory)) throw new Error(`Missing protected route: ${directory}`);
  walk(directory).forEach(visit);
}
['app/layout.tsx', 'app/(dashboard)/layout.tsx', 'app/demo/layout.tsx', 'app/globals.css', 'proxy.ts',
 'package.json', 'package-lock.json', 'next.config.mjs', 'tsconfig.json'].forEach(rel => { if (fs.existsSync(path.join(root, rel))) visit(path.join(root, rel)); });
walk(path.join(root, 'locales')).forEach(visit);
// Match the routing-related families that open from the existing protected pages.
for (const family of ['assessment', 'summary', 'transport', 'track-shipment', 'calculation-history', 'cbam-report', 'audit']) {
  for (const base of ['app/(dashboard)', 'app/demo']) { const dir = path.join(root, base, family); if (fs.existsSync(dir)) walk(dir).forEach(visit); }
}
const files = [...seen].sort().map(file => ({ repo: 'FE', path: path.relative(root, file).replaceAll('\\', '/'), sha256: contentHash(file) }));
const backend = path.resolve(root, '../BE');
// Freeze backend behavior for this first navigation increment. New isolated modules can be added later.
for (const directory of ['src', 'migrations']) for (const file of walk(path.join(backend, directory))) files.push({ repo: 'BE', path: path.relative(backend, file).replaceAll('\\', '/'), sha256: contentHash(file) });
fs.writeFileSync(destination, JSON.stringify({ schemaVersion: '1.0', capturedOn: '2026-10-06', protectedRoutes: paths,
  policy: 'User freeze. Existing working content including prior local changes. EOL-normalized text SHA-256; binary files use raw SHA-256. Sidebar navigation is the explicitly allowed exception; protected descriptors are tested separately.', files }, null, 2) + '\n');
console.log(`Captured ${files.length} protected files. No application file changed.`);
