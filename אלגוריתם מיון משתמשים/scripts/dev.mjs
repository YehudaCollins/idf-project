#!/usr/bin/env node
/**
 * מפעיל dev עם ניקוי cache אוטומטי ומגבלת זיכרון.
 * מונע הצטברות cache של Vite / Next.js שגורמת ל-CPU ו-RAM גבוהים.
 */
import { spawn } from 'node:child_process';
import { rmSync, statSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_CACHE_BYTES = 1 * 1024 * 1024 * 1024; // 1GB
const NODE_MAX_OLD_SPACE = '4096'; // 4GB

const CACHE_PATHS = [
  join(ROOT, 'frontend', 'node_modules', '.vite'),
  join(ROOT, '.next', 'dev', 'cache'),
  join(ROOT, 'frontend', '.next', 'dev', 'cache'),
];

function dirSizeBytes(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) total += dirSizeBytes(p);
      else total += statSync(p).size;
    }
  } catch {
    /* ignore permission errors */
  }
  return total;
}

function formatBytes(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)}GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(0)}MB`;
  return `${(n / 1024).toFixed(0)}KB`;
}

function cleanCaches() {
  for (const p of CACHE_PATHS) {
    if (!existsSync(p)) continue;
    const size = dirSizeBytes(p);
    if (size >= MAX_CACHE_BYTES) {
      console.log(`[dev] מוחק cache גדול (${formatBytes(size)}): ${p}`);
      rmSync(p, { recursive: true, force: true });
    }
  }
}

cleanCaches();

const env = {
  ...process.env,
  NODE_OPTIONS: [
    process.env.NODE_OPTIONS,
    `--max-old-space-size=${NODE_MAX_OLD_SPACE}`,
  ]
    .filter(Boolean)
    .join(' '),
};

console.log(`[dev] מפעיל backend + frontend (זיכרון מקסימום: ${NODE_MAX_OLD_SPACE}MB)`);

const child = spawn(
  'npx',
  ['concurrently', 'npm run dev:backend', 'npm run dev:frontend'],
  { cwd: ROOT, env, stdio: 'inherit' }
);

child.on('exit', (code) => process.exit(code ?? 0));
