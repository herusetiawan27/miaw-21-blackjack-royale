// Entrypoint for the Miaw 21 entry (Node 22+, standard library only).
// The game itself is static files under game/; this program hands them in:
// it mirrors game/ and screenshots/ into the output directory and writes
// dossier.json, the summary the judge reads, using the vendored make.fun
// dossier builder. Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The grader runs it with /output as the target instead.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Caps the scorer enforces: keep the entry inside them or it is refused.
// text_max_bytes bounds the dossier text; screenshots are capped at 4 images
// of 256 KiB each; game/ is capped at 993 files and 48 MiB in total, with no
// single game path longer than 1000 bytes. A line on stdout confirms the
// dossier landed where the grader expects it.
const dossierPath = join(out, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`dossier written to ${dossierPath}`);
