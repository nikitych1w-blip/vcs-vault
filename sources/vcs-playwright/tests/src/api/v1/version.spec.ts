import { test, expect } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const PATH = '/api/v1/version';

test.describe(
  'GET /api/v1/version',
  {
    tag: [Layer.API, '@v1', '@get-version', '@smoke'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'GET /api/v1/version — 200 OK —  Получение версии SourceControl',
      {
        tag: ['@VCS-15389', Priority.BLOCKER],
      },
      async ({ tuzToken, apiRegistry }) => {
        const apiClient = apiRegistry.client.withToken(tuzToken);
        const response = await apiClient.get(PATH);

        await HttpResponseAssertions.ok(response, {
          data: {
            version: expect.any(String),
          },
        });
      },
    );
  },
);
