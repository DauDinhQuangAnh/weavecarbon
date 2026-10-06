import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const contentHash = file => {
  const bytes = fs.readFileSync(file);
  const content = /\.(ts|tsx|js|mjs|json|css|sql|md|yml|yaml)$/.test(file)
    ? bytes.toString('utf8').replaceAll('\r\n', '\n') : bytes;
  return crypto.createHash('sha256').update(content).digest('hex');
};
export function checkProtectedPages(root, frontendOnly = false) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/protected-pages.snapshot.json'), 'utf8'));
  const errors = [];
  for (const entry of manifest.files) {
    if (frontendOnly && entry.repo !== 'FE') continue;
    const file = path.resolve(entry.repo === 'FE' ? root : path.join(root, '../BE'), entry.path);
    if (!fs.existsSync(file)) errors.push(`Protected file missing: ${entry.repo}/${entry.path}`);
    else if (contentHash(file) !== entry.sha256) errors.push(`Protected file changed: ${entry.repo}/${entry.path}`);
  }
  return { checked: manifest.files.filter(e => !frontendOnly || e.repo === 'FE').length, errors };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const result = checkProtectedPages(root, process.argv.includes('--frontend-only'));
  if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
  else console.log(`Protected pages: ${result.checked} files unchanged from the user-approved baseline.`);
}
