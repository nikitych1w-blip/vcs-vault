import { test, expect } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const toPath = (username: string) => `/api/v1/users/${username}`;

test.describe(
  'GET /api/v1/users/:username',
  {
    tag: [Layer.API, '@v1', '@get-user'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'GET /api/v1/users/:username — 200 OK — Получение информации о пользователе по имени',
      {
        tag: ['@VCS-15560', Priority.CRITICAL],
      },
      async ({ user, admin, apiRegistry }) => {
        const path = toPath(user.name);
        const apiClient = apiRegistry.client.withBasic(admin);
        const response = await apiClient.get(path);

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
