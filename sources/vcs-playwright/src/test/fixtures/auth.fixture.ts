import { Fixtures, PlaywrightWorkerArgs } from '@playwright/test';
import { Browser } from 'playwright';

import { AuthTestFixture, CleanupTestFixture, ConfigWorkerFixture } from '@vcs-pw/test/fixtures/types';

import {
  AuthService,
  CertificateSessionService,
  KeyCloakSessionService,
  NgamSessionService,
  PlainSessionService,
} from '@vcs-pw/services/auth.service';
import CleanupStack from '@vcs-pw/types/cleanup.type';
import { ACCESS_MANAGEMENT_TYPE, Config } from '@vcs-pw/types/config.type';

export const testFixture: Fixtures<AuthTestFixture & ConfigWorkerFixture & PlaywrightWorkerArgs & CleanupTestFixture> =
  {
    authService: [
      async ({ browser, config, cleanup }, use, testInfo) => {
        const authService = createAuthService(browser, testInfo.project.use, config, cleanup);

        await use(authService);
      },
      { box: true },
    ],

    owCoordinatorRequest: [
      async ({ config, authService }, use) => {
        const owConfig = config.ow;
        if (!owConfig) {
          throw new Error('Интеграция с OW не задана');
        }

        const context = await authService.createAuthenticatedSession(owConfig.coordinator);
        await use(context.request);
      },
      { title: 'Авторизация координатором OW' },
    ],
  };

function createAuthService(
  browser: Browser,
  useConfig: Record<string, any>,
  config: Config,
  cleanup: CleanupStack,
): AuthService {
  if (config.sc.users[0]?.clientCertificate !== undefined) {
    return new CertificateSessionService(browser, useConfig, config.ui.proxiedBaseUrl, cleanup);
  }
  switch (config.ui.auth) {
    case ACCESS_MANAGEMENT_TYPE.NGAM:
      return new NgamSessionService(browser, useConfig, config.ui.proxiedBaseUrl, cleanup);
    case ACCESS_MANAGEMENT_TYPE.KEYCLOAK:
      return new KeyCloakSessionService(browser, useConfig, config.ui.proxiedBaseUrl, cleanup);
    case ACCESS_MANAGEMENT_TYPE.SC:
      return new PlainSessionService(browser, useConfig, `${config.ui.baseUrl}/user/login`, cleanup);
  }
}
