/**
 * Разделено для избегания циклических импортов.
 * Данные расширенные test, expect должны использовать в tests/
 * В src/ используется expect по возможности без расширения фикстур и матчеров (дефолтный от pw)
 */
import { expect as baseExpect, test as baseTest, mergeExpects } from '@playwright/test';

import { apiMatcher } from '@vcs-pw/test/matchers/api.matcher';
import { gitMatcher } from '@vcs-pw/test/matchers/git.matcher';

import {
  AllureTestFixture,
  ApiWorkerFixture,
  AuthTestFixture,
  CleanupTestFixture,
  ConfigWorkerFixture,
  DataTestFixture,
  DataWorkerFixture,
  KafkaWorkerFixture,
  PageWorkerFixture,
  S3WorkerFixture,
  UserTestFixture,
  UserWorkerFixture,
} from '@vcs-pw/test/fixtures/types';

import { testFixture as allureTestFixture } from '@vcs-pw/test/fixtures/allure.fixture';
import { workerFixture as apiWorkerFixture } from '@vcs-pw/test/fixtures/api.fixture';
import { testFixture as authTestFixture } from '@vcs-pw/test/fixtures/auth.fixture';
import { testFixture as cleanupTestFixture } from '@vcs-pw/test/fixtures/cleanup.fixture';
import { workerFixture as configWorkerFixture } from '@vcs-pw/test/fixtures/config.fixture';
import { testFixture as dataTestFixture, workerFixture as dataWorkerFixture } from '@vcs-pw/test/fixtures/data.fixture';
import { workerFixture as kafkaWorkerFixture } from '@vcs-pw/test/fixtures/kafka.fixture';
import { workerFixture as pageWorkerFixture } from '@vcs-pw/test/fixtures/page.fixture';
import { workerFixture as s3WorkerFixture } from '@vcs-pw/test/fixtures/s3.fixture';
import { testFixture as userTestFixture, workerFixture as userWorkerFixture } from '@vcs-pw/test/fixtures/user.fixture';
import { extendAsymmetricMatchers } from '@vcs-pw/test/matchers/asymmetric.matcher';

const flat = (...entries: Record<string, any>[]) => entries.reduce((acc, entry) => ({ ...acc, ...entry }), {});

export const test = baseTest
  // Фикстуры уровня test (создаются на каждый тест)
  .extend<AuthTestFixture & CleanupTestFixture & DataTestFixture & UserTestFixture>(
    flat(authTestFixture, cleanupTestFixture, dataTestFixture, userTestFixture),
  )
  // Фикстуры уровня worker (создаются один раз на воркера)
  .extend<
    object,
    AllureTestFixture &
      ApiWorkerFixture &
      ConfigWorkerFixture &
      DataWorkerFixture &
      KafkaWorkerFixture &
      S3WorkerFixture &
      PageWorkerFixture &
      UserWorkerFixture
  >(
    flat(
      allureTestFixture,
      apiWorkerFixture,
      configWorkerFixture,
      dataWorkerFixture,
      kafkaWorkerFixture,
      s3WorkerFixture,
      pageWorkerFixture,
      userWorkerFixture,
    ),
  );

export const expect = extendAsymmetricMatchers(
  mergeExpects(baseExpect.extend(apiMatcher), baseExpect.extend(gitMatcher)),
);

export const expectNoSoftFailure = () => expect(test.info().errors, 'Нет ошибок').toHaveLength(0);
