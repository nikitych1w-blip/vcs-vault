import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SURFACES } from './postman-config.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const errors = [];

  for (const surface of SURFACES) {
    const outputAbsoluteDir = path.join(repoRoot, surface.outputDir);
    const jsonFiles = await collectJsonFiles(outputAbsoluteDir);

    if (jsonFiles.length === 0) {
      errors.push(`No generated collections found in ${surface.outputDir}`);
      continue;
    }

    for (const filePath of jsonFiles) {
      const collection = JSON.parse(await readFile(filePath, 'utf8'));
      validateCollection(collection, filePath, errors);
    }
  }

  if (errors.length > 0) {
    console.error('Generated Postman collections validation failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Generated Postman collections validation passed.');
}

async function collectJsonFiles(targetDir) {
  const dirents = await readdir(targetDir, { withFileTypes: true });
  const jsonFiles = [];

  for (const dirent of dirents) {
    const absolutePath = path.join(targetDir, dirent.name);

    if (dirent.isDirectory()) {
      jsonFiles.push(...(await collectJsonFiles(absolutePath)));
      continue;
    }

    if (dirent.isFile() && absolutePath.endsWith('.json')) {
      jsonFiles.push(absolutePath);
    }
  }

  return jsonFiles;
}

function validateCollection(collection, filePath, errors) {
  const topLevelKeys = Object.keys(collection);
  if (topLevelKeys[0] !== 'info' || topLevelKeys[1] !== 'item') {
    errors.push(`${filePath}: top-level keys must start with "info", "item"`);
  }

  if (collection.variable !== undefined) {
    errors.push(`${filePath}: top-level "variable" must be absent`);
  }

  if (collection.auth?.type !== 'basic') {
    errors.push(`${filePath}: collection auth must be basic`);
  }

  if (!Array.isArray(collection.item) || collection.item.length === 0) {
    errors.push(`${filePath}: collection must contain items`);
    return;
  }

  for (const item of collection.item) {
    validateItem(item, filePath, errors);
  }
}

function validateItem(item, filePath, errors) {
  if (item.id !== undefined) {
    errors.push(`${filePath}: item.id must be absent`);
  }

  if (Array.isArray(item.event) && item.event.length === 0) {
    errors.push(`${filePath}: empty item.event must be removed`);
  }

  if (item.protocolProfileBehavior !== undefined) {
    errors.push(`${filePath}: protocolProfileBehavior must be absent`);
  }

  if (Array.isArray(item.item)) {
    for (const child of item.item) {
      validateItem(child, filePath, errors);
    }
  }

  if (item.request) {
    validateRequest(item.request, filePath, errors);
  }

  if (Array.isArray(item.response)) {
    for (const response of item.response) {
      validateResponse(response, filePath, errors);
    }
  }
}

function validateRequest(request, filePath, errors) {
  if (request.name !== undefined) {
    errors.push(`${filePath}: request.name must be absent`);
  }

  if (request.auth === null) {
    errors.push(`${filePath}: request.auth must not be null`);
  }

  if (request.url && request.url.raw === undefined) {
    errors.push(`${filePath}: request.url.raw must be present`);
  }
}

function validateResponse(response, filePath, errors) {
  if (response.id !== undefined) {
    errors.push(`${filePath}: response.id must be absent`);
  }

  if (response.originalRequest?.url && response.originalRequest.url.raw === undefined) {
    errors.push(`${filePath}: originalRequest.url.raw must be present`);
  }

  const originalRequestBody = response.originalRequest?.body;
  if (
    originalRequestBody &&
    typeof originalRequestBody === 'object' &&
    Object.keys(originalRequestBody).length === 0
  ) {
    errors.push(`${filePath}: empty originalRequest.body must be absent`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
