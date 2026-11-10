import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const ignored = new Set(['.git', '.github', 'node_modules']);
const extensions = new Set(['.md', '.mjs', '.js', '.ts', '.astro', '.css', '.json', '.yml', '.yaml', '.toml', '.txt', '.html', '.svg', '.xml']);
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
  for (const [label, pattern] of checks) {
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
