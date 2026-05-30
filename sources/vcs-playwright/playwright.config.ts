import { defineConfig, devices } from '@playwright/test';

import { config } from '@vcs-pw/config';
import { isTrue } from '@vcs-pw/utils/env.utils';

const VIEW_PORT = { width: 1920, height: 1080 } as const;

export default defineConfig({
  timeout: 3 * 60 * 1000,
  globalSetup: './global.setup.ts',
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: 1,
  reporter: [
    ['list', { printSteps: true }],
    [
      'allure-playwright',
      {
        detail: true,
        outputFolder: 'allure-results',
        suiteTitle: false,
        links: {
          issue: {
            nameTemplate: 'issue %s',
            urlTemplate: 'https://portal.works.prod.sbt/swtr/units/current/unit/%s',
          },
          tms: {
            nameTemplate: 'tms %s',
            urlTemplate: 'https://portal.works.prod.sbt/swtr/tms/unitCodeCase=%s',
          },
        },
        environmentInfo: {
          stand: config.sc.name,
        },
        categories: [
          {
            name: 'API: Проверка ответа',
            matchedStatuses: ['failed'],
            traceRegex: '.*api/assert.type.ts.*',
          },
          {
            name: 'API: Ошибка вызова',
            matchedStatuses: ['failed'],
            messageRegex: '.*Request failed with status code.*',
          },
          {
            name: 'API: Ошибка вызова',
            matchedStatuses: ['failed'],
            traceRegex: '.*request.*api/base.*',
          },
          {
            name: 'API: Группа привилегий',
            matchedStatuses: ['failed'],
            traceRegex: '.*privilege.service.*',
          },
          {
            name: 'TaskTracker: Не выполнено условие',
            matchedStatuses: ['failed'],
            traceRegex: '.*Timeout.*task-tracker.service.*',
          },
          {
            name: 'TaskTracker: Не выполнено условие',
            matchedStatuses: ['failed'],
            traceRegex: '.*Timeout.*expectIssuesCount.*',
          },
          {
            name: 'Kafka: Не выполнено условие',
            matchedStatuses: ['failed'],
            traceRegex: '.*Timeout.*kafka.service.*|.*expect.*api/kafka.*',
          },
          {
            name: 'Git: Не выполнено условие',
            matchedStatuses: ['failed'],
            messageRegex: '.*Git-операция*',
          },
        ],
      },
    ],
    [
      '@vcs/test-culture-playwright-reporter',
      {
        enabled: isTrue('TEST_CULTURE_ENABLED'),
        client: {
          url: 'https://portal.works.prod.sbt/swtr',
          auth: {
            user: {
              name: process.env.TEST_CULTURE_USERNAME,
              password: process.env.TEST_CULTURE_PASSWORD,
            },
          },
        },
        space: 'VCS',
        testCase: {
          enabled: isTrue('TEST_CULTURE_TEST_CASE_ENABLED'),
          updateOnlyMetadata: true,
          attributes: {
            test_case_status: 'relevant',
            pmi: 'not',
            automated: 'yes',
            component_code: 'GITT',
            product_code: 'VCS',
            type_of_testing: 'regress',
            Automation_framework: 'playwright',
            test_type: 'other_type',
          },
        },
        testRun: {
          uploadAttachmentsOnFailure: true,
        },
        testCycle: {
          enabled: isTrue('TEST_CULTURE_TEST_CYCLE_ENABLED'),
          summary: `AT — ${new Date().toLocaleString('ru-RU')} — ${config.sc.name}`,
          code: process.env.TEST_CULTURE_TEST_CYCLE_CODE,
          attributes: {
            cycle_automated: 'yes',
            cycles_number: '1',
            release_name: process.env.TEST_CULTURE_TEST_CYCLE_RELEASE ?? 'Не задан',
          },
        },
      },
    ],
  ],

  use: {
    baseURL: config.ui.baseUrl,
    actionTimeout: 10_000,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    headless: !!process.env.CI,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    colorScheme: 'light',
    locale: 'ru_RU',
    timezoneId: 'Europe/Moscow',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        viewport: VIEW_PORT,
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: VIEW_PORT },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: VIEW_PORT },
    },
  ],
});
