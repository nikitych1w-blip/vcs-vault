import { readFile } from 'node:fs/promises';
import path from 'node:path';

import Converter from 'openapi-to-postmanv2';
import YAML from 'yaml';

export async function loadAndPrepareSpec(repoRoot, surface) {
  const bundleAbsolutePath = path.join(repoRoot, surface.bundlePath);
  const rawSpec = await readFile(bundleAbsolutePath, 'utf8');
  const spec = YAML.parse(rawSpec);

  if (surface.policy?.removeSwaggerPath && spec.paths?.['/swagger']) {
    delete spec.paths['/swagger'];
  }

  return YAML.stringify(spec);
}

export function convertSpecToCollection(specString, converterOptions) {
  return new Promise((resolve, reject) => {
    Converter.convert(
      { type: 'string', data: specString },
      converterOptions,
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result?.result) {
          reject(new Error(`OpenAPI conversion failed: ${JSON.stringify(result)}`));
          return;
        }

        const collection = result.output?.find((entry) => entry.type === 'collection')?.data;

        if (!collection) {
          reject(new Error('OpenAPI conversion did not return a Postman collection.'));
          return;
        }

        resolve(collection);
      }
    );
  });
}
