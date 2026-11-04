/**
 * Node module hooks used by scripts/sync-e2e.mjs to run the app's TypeScript
 * sources directly: resolves extensionless relative imports to .ts files and
 * injects VITE_* env values where Vite normally would.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, next) {
  if (
    specifier.startsWith('.') &&
    context.parentURL?.endsWith('.ts') &&
    !/\.\w+$/.test(specifier)
  ) {
    for (const ext of ['.ts', '.tsx']) {
      const url = new URL(specifier + ext, context.parentURL);
      if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
    }
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith('.ts') && url.includes('/src/')) {
    const source = readFileSync(fileURLToPath(url), 'utf8').replace(
      /import\.meta\.env\?\.(VITE_[A-Z0-9_]+)/g,
      (_m, name) => JSON.stringify(process.env[name] ?? ''),
    );
    return { format: 'module-typescript', source, shortCircuit: true };
  }
  return next(url, context);
}
