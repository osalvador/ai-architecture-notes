import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const ignored = new Set(['.git', '.github', 'node_modules']);
const extensions = new Set(['.md', '.mjs', '.js', '.ts', '.astro', '.css', '.json', '.yml', '.yaml', '.toml', '.txt', '.html', '.svg', '.xml']);
// Pagefind ships translator credits containing email addresses. Exempt only these
// exact, reviewed bundle bytes; any change requires review and fails closed.
const reviewedEmailBundles = new Map([
  ['public-site/_astro/ui-core.Bq6MWQL3.js', '283ac15cb9d1d01d1b17d29649d9f214bdcf0f5554353aae3dfdc2a83fb5f858'],
  ['public-site/pagefind/pagefind-component-ui.js', 'f7a4ba1403c0dfb23e84e18b4480f95785035d21e5b45a05a08191bd87c84944'],
  ['public-site/pagefind/pagefind-ui.js', '07b2a55750c180546523435461fd44f0612531bcdc0e8a069fe00eef7741d1f7'],
]);
const checks = [
  ['email address', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ['credential URL', /https?:\/\/[^/\s:@]+:[^/\s@]+@/i],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub access token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
];

async function files(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.isDirectory() && ignored.has(item.name)) continue;
    const full = path.join(directory, item.name);
    if (item.isDirectory()) result.push(...await files(full));
    else if (extensions.has(path.extname(item.name).toLowerCase())) result.push(full);
  }
  return result;
}

const violations = [];
for (const file of await files(root)) {
  const text = await readFile(file, 'utf8');
  const relativeFile = path.relative(root, file).split(path.sep).join('/');
  const digest = createHash('sha256').update(text).digest('hex');
  for (const [label, pattern] of checks) {
    if (label === 'email address' && reviewedEmailBundles.get(relativeFile) === digest) continue;
    if (pattern.test(text)) violations.push(`${path.relative(root, file)}: contains a ${label}`);
  }
}

if (violations.length) {
  console.error('Public-site boundary check failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log('Public-site boundary check passed.');
}
