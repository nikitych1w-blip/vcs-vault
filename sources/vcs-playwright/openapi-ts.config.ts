import { defineConfig } from '@hey-api/openapi-ts';

const API_TYPE_OUTPUT = './src/api/generated/types';

const specs = {
  './spec/api/openapi/producers/v1/repository.yaml': 'kafka/v1/repo',
  './spec/api/openapi/producers/v2/repository.yaml': 'kafka/v2/repo',
  './spec/api/openapi/producers/v1/pull_request.yaml': 'kafka/elk/pull',
  './spec/api/openapi/producers/elk/commit/commit.yaml': 'kafka/elk/commit',
  './spec/api/openapi/ui/openapi_ui_bundle.yaml': 'web/bundle',
  './spec/api/openapi/http/v3/index.yaml': 'api/v3',
  './spec/api/openapi/http/v2/index.yaml': 'api/v2',
};

export default defineConfig(
  Object.entries(specs).map(([input, outputDir]) => ({
    input,
    output: {
      path: `${API_TYPE_OUTPUT}/${outputDir}`,
      format: 'prettier',
    },
    plugins: [
      {
        name: 'zod',
        definitions: true,
        requests: true,
        responses: true,
        types: {
          infer: true,
        },
      },
    ],
  })),
);
