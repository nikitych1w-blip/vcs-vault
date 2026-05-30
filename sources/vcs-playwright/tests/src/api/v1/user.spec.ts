import { test, expect } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const PATH = '/api/v1/user';

test.describe(
  'GET /api/v1/user',
  {
    tag: [Layer.API, '@v1', '@get-current-user'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'GET /api/v1/user — 200 OK — Получение информации о текущем пользователе',
      {
        tag: ['@VCS-15550', Priority.CRITICAL],
      },
      async ({ user, apiRegistry }) => {
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(PATH);

        await HttpResponseAssertions.ok(response, {
          data: {
            id: user.id,
            login: user.name,
            login_name: user.loginName,
            full_name: user.fullName,
            email: user.email,
            avatar_url: expect.stringContaining('avatars'),
            language: '',
            is_admin: false,
            last_login: expect.stringIso(),
            created: expect.stringIso(),
            restricted: false,
            active: true,
            prohibit_login: false,
            location: '',
            website: '',
            description: '',
            visibility: 'public',
            followers_count: expect.any(Number),
            following_count: expect.any(Number),
            starred_repos_count: expect.any(Number),
            username: user.name,
          },
        });
      },
    );
  },
);
