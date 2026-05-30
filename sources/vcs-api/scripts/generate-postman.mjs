import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONVERTER_OPTIONS, SURFACES } from './postman-config.mjs';
import { convertSpecToCollection, loadAndPrepareSpec } from './postman-convert.mjs';
import { normalizeCollection, splitCollectionByFolder } from './postman-transform.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  for (const surface of SURFACES) {
    await generateSurfaceCollections(surface);
  }
}

async function generateSurfaceCollections(surface) {
  const specString = await loadAndPrepareSpec(repoRoot, surface);
  const collection = await convertSpecToCollection(specString, CONVERTER_OPTIONS);
  normalizeCollection(collection, surface);

  const splitCollections = splitCollectionByFolder(collection, surface);
  await writeSurfaceCollections(surface, splitCollections);
}

async function writeSurfaceCollections(surface, splitCollections) {
  const outputAbsoluteDir = path.join(repoRoot, surface.outputDir);
  await rm(outputAbsoluteDir, { recursive: true, force: true });
  await mkdir(outputAbsoluteDir, { recursive: true });

  for (const splitEntry of splitCollections) {
    const fileAbsolutePath = path.join(outputAbsoluteDir, splitEntry.folderName, splitEntry.fileName);

    await mkdir(path.dirname(fileAbsolutePath), { recursive: true });
    await writeFile(fileAbsolutePath, `${JSON.stringify(splitEntry.collection, null, 2)}\n`, 'utf8');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
