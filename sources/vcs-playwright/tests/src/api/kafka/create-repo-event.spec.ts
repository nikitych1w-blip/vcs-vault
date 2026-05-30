import { zCreateRepositoryEvent as zCreateRepositoryEventV1 } from '@vcs-pw/api/generated/types/kafka/v1/repo/zod.gen';
import { zCreateRepositoryEvent as zCreateRepositoryEventV2 } from '@vcs-pw/api/generated/types/kafka/v2/repo/zod.gen';
import { step } from '@vcs-pw/test';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';

test.describe(
  'Kafka. Событие создания репозитория',
  {
    tag: [Layer.API, '@kafka', '@create-repo-event'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeAll('Топик для события существует', async ({ kafkaService }) => {
      const topic = kafkaService.topics.repos;
      await kafkaService.expectTopicExists(topic);
    });

    test(
      'Отправка события создания репозитория (v1) — Создание через API v3',
      {
        tag: ['@VCS-3672', Priority.CRITICAL],
      },
      async ({ tenantInfo, entityManager, kafkaService, tuz }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions);

        const topic = kafkaService.topics.repos;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            action: 'create',
            properties: [{ name: 'project-name', value: repoInfo.name }],
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            action: 'create',
            id: expect.uuid(),
            issuer: kafkaService.issuer,
            'project-info': { 'project-id': `/${tenantInfo.name}/${projectInfo.name}/${repoInfo.name}` },
            properties: [
              { name: 'project-name', value: repoInfo.name },
              { name: 'project-description', value: repoInfo.description ?? '' },
              { name: 'uri', value: repoInfo.full_name },
            ],
            'tenant-id': tenantInfo.id,
            timestamp: expect.timestampCloseTo(),
            type: 'node',
            'user-info': { 'user-id': tuz.loginName || tuz.name },
            version: '1.0.0',
          });
          await expect.soft(value).toMatchZodSchema(zCreateRepositoryEventV1);
        });
      },
    );

    test(
      'Отправка события создания репозитория (v2) — Создание через API v3',
      {
        tag: ['@VCS-3673', Priority.CRITICAL],
      },
      async ({ tenantInfo, entityManager, kafkaService, tuz }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions);

        const topic = kafkaService.topics.repos;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            payload: {
              additional_properties: {
                repository_uri: repoInfo.full_name,
              },
            },
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            context: {
              entity_type: 'REPOSITORY',
              event_code: 'CREATE',
              event_createTs: expect.timestampCloseTo(),
              event_id: expect.uuid(),
              tenant_id: tenantInfo.id,
            },
            metadata: {
              message_create_ts: expect.timestampCloseTo(),
              message_id: expect.uuid(),
              producer: { id: kafkaService.issuer },
              version: '2.0.0',
            },
            payload: {
              additional_properties: {
                repository_description: repoInfo.description ?? '',
                repository_uri: repoInfo.full_name,
              },
              initiator_user: { id: tuz.loginName || tuz.name },
              repository_info: {
                project_name: projectInfo.name,
                repository_id: expect.numericString(),
                repository_name: repoInfo.name,
                tenant_name: tenantInfo.name,
              },
            },
          });
          await expect.soft(value).toMatchZodSchema(zCreateRepositoryEventV2);
        });
      },
    );

    test(
      'Отправка события создания репозитория (v2) — Создание через API v2',
      {
        tag: ['@VCS-3674', Priority.NORMAL],
      },
      async ({ tenantInfo, entityManager, kafkaService, tuz }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };
        const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions);

        const topic = kafkaService.topics.repos;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            payload: {
              additional_properties: {
                repository_uri: repoInfo.uri,
              },
            },
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            context: {
              entity_type: 'REPOSITORY',
              event_code: 'CREATE',
              event_createTs: expect.timestampCloseTo(),
              event_id: expect.uuid(),
              tenant_id: tenantInfo.id,
            },
            metadata: {
              message_create_ts: expect.timestampCloseTo(),
              message_id: expect.uuid(),
              producer: { id: kafkaService.issuer },
              version: '2.0.0',
            },
            payload: {
              additional_properties: {
                repository_description: repoInfo.description ?? '',
                repository_uri: repoInfo.uri,
              },
              initiator_user: { id: tuz.loginName || tuz.name },
              repository_info: {
                project_name: projectInfo.name,
                repository_id: repoInfo.id,
                repository_name: repoInfo.name,
                tenant_name: tenantInfo.name,
              },
            },
          });
          await expect.soft(value).toMatchZodSchema(zCreateRepositoryEventV2);
        });
      },
    );

    test(
      'Отправка события создания репозитория (v1) — Создание через API v2',
      {
        tag: ['@VCS-3675', Priority.NORMAL],
      },
      async ({ tenantInfo, entityManager, kafkaService, tuz }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };
        const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions);

        const topic = kafkaService.topics.repos;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            action: 'create',
            properties: [{ name: 'project-name', value: repoInfo.name }],
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            action: 'create',
            id: expect.uuid(),
            issuer: kafkaService.issuer,
            'project-info': { 'project-id': `/${tenantInfo.name}/${projectInfo.name}/${repoInfo.name}` },
            properties: [
              { name: 'project-name', value: repoInfo.name },
              { name: 'project-description', value: repoInfo.description ?? '' },
              { name: 'uri', value: repoInfo.uri },
            ],
            'tenant-id': tenantInfo.id,
            timestamp: expect.timestampCloseTo(),
            type: 'node',
            'user-info': { 'user-id': tuz.loginName || tuz.name },
            version: '1.0.0',
          });
          await expect.soft(value).toMatchZodSchema(zCreateRepositoryEventV1);
        });
      },
    );

    test(
      'Отправка события создания репозитория (v1) — Создание через Web API v1',
      {
        tag: ['@VCS-3679', Priority.NORMAL],
      },
      async ({ tenantInfo, entityManager, kafkaService, user, authService, privilegeService }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);
        const context = await authService.createAuthenticatedSession(user);
        const repoInfo = await entityManager.createRepoWebV1(context.request, {
          ...projectOptions,
          projectId: Number(projectInfo.id),
        });

        const topic = kafkaService.topics.repos;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            action: 'create',
            properties: [{ name: 'project-name', value: repoInfo.name }],
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            action: 'create',
            id: expect.uuid(),
            issuer: kafkaService.issuer,
            'project-info': { 'project-id': `/${tenantInfo.name}/${projectInfo.name}/${repoInfo.name}` },
            properties: [
              { name: 'project-name', value: repoInfo.name },
              { name: 'project-description', value: repoInfo.description ?? '' },
              { name: 'uri', value: `/${projectInfo.name}/${repoInfo.name}` },
            ],
            'tenant-id': tenantInfo.id,
            timestamp: expect.timestampCloseTo(),
            type: 'node',
            'user-info': { 'user-id': user.loginName || user.name },
            version: '1.0.0',
          });
          await expect.soft(value).toMatchZodSchema(zCreateRepositoryEventV1);
        });
      },
    );

    test(
      'Отправка события создания репозитория (v2) — Создание через Web API v1',
      {
        tag: ['@VCS-3676', Priority.NORMAL],
      },
      async ({ tenantInfo, entityManager, kafkaService, user, authService, privilegeService }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);
        const context = await authService.createAuthenticatedSession(user);
        const repoInfo = await entityManager.createRepoWebV1(context.request, {
          ...projectOptions,
          projectId: Number(projectInfo.id),
        });

        const topic = kafkaService.topics.repos;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            payload: {
              additional_properties: {
                repository_uri: `/${projectInfo.name}/${repoInfo.name}`,
              },
            },
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            context: {
              entity_type: 'REPOSITORY',
              event_code: 'CREATE',
              event_createTs: expect.timestampCloseTo(),
              event_id: expect.uuid(),
              tenant_id: tenantInfo.id,
            },
            metadata: {
              message_create_ts: expect.timestampCloseTo(),
              message_id: expect.uuid(),
              producer: { id: kafkaService.issuer },
              version: '2.0.0',
            },
            payload: {
              additional_properties: {
                repository_description: repoInfo.description ?? '',
                repository_uri: `/${projectInfo.name}/${repoInfo.name}`,
              },
              initiator_user: { id: user.loginName || user.name },
              repository_info: {
                project_name: projectInfo.name,
                repository_id: expect.numericString(),
                repository_name: repoInfo.name,
                tenant_name: tenantInfo.name,
              },
            },
          });
          await expect.soft(value).toMatchZodSchema(zCreateRepositoryEventV2);
        });
      },
    );
  },
);
