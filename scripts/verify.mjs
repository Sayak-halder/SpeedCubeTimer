// Runs the cube model checks. Node's type stripping needs explicit extensions
// on relative imports, so the sources are copied into a temp dir with the
// imports rewritten, then executed.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'cube-verify-'));
for (const name of ['facelet', 'cubie', 'scramble', 'verify']) {
  const from = name === 'verify' ? 'src/lib/cube/verify.ts' : `src/lib/cube/${name}.ts`;
  const text = readFileSync(from, 'utf8').replace(
    /from '\.\/(facelet|cubie|scramble)'/g,
    "from './$1.ts'",
  );
  writeFileSync(join(dir, `${name}.ts`), text);
}
await import(pathToFileURL(join(dir, 'verify.ts')).href);
