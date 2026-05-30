import { APIRequestContext, APIResponse, Browser, BrowserContext, expect } from '@playwright/test';
import { HTMLElement, parse as parseHTML } from 'node-html-parser';

import { log } from '@vcs-pw/logger';
import { step } from '@vcs-pw/test';
import CleanupStack from '@vcs-pw/types/cleanup.type';
import { SourceControlUser } from '@vcs-pw/types/user.type';
import { safeAttr, safeFind, safeMatch } from '@vcs-pw/utils/dom.util';

const CSRF_TOKEN_REGEX = /csrfToken: '([^']*)'/;
const SET_VALUE_REGEX = /\.value='([^']*)'/;

export abstract class AuthService {
  constructor(
    protected readonly browser: Browser,
    protected readonly contextSettings: Record<string, any>,
    protected readonly authUrl: string,
    protected readonly cleanup: CleanupStack,
  ) {}

  protected abstract login(user: SourceControlUser): Promise<BrowserContext>;

  async createAuthenticatedSession(user: SourceControlUser): Promise<BrowserContext> {
    return await step(`Создание аутентифицированной сессии для пользователя ${user.name}`, async () => {
      log.info('Создание аутентифицированной сессии', { username: user.name, session: this.constructor.name });

      const context = await this.login(user);

      log.info('Аутентификация успешна', { username: user.name });
      return context;
    });
  }

  protected async getLoginPageResponse(request: APIRequestContext): Promise<APIResponse> {
    const response = await request.get(this.authUrl, {
      headers: { Accept: 'text/html' },
    });
    await expect(response, 'Страница логина получена').toBeOK();
    return response;
  }

  protected async createBrowserContext(additionalProps: Record<string, any> = {}): Promise<BrowserContext> {
    const context = await this.browser.newContext({
      ...additionalProps,
      ...this.contextSettings,
    });

    // Не очень пихать сюда еще и отвественность за установку хука,
    // но пока не удалось продумать хорошую архитектуру (из-за необходимости с сертами самим создавать контекст)
    // "И так сойдет!".jpg
    this.cleanup.push(() => context.close());
    return context;
  }
}

export class PlainSessionService extends AuthService {
  protected extractCsrfToken(responseText: string): string {
    const match = responseText.match(CSRF_TOKEN_REGEX);
    if (!match) {
      throw new Error(`Не удалось найти csrfToken на странице`);
    }
    return match[1];
  }

  async login(user: SourceControlUser): Promise<BrowserContext> {
    const context = await this.createBrowserContext();
    const request = context.request;

    const response = await this.getLoginPageResponse(request);

    const responseText = await response.text();
    const csrfToken = this.extractCsrfToken(responseText);

    const data = {
      _csrf: csrfToken,
      user_name: user.name,
      password: user.password,
    };

    const loginResponse = await request.post(response.url(), {
      form: data,
    });
    await expect(loginResponse, 'Запрос на вход выполнен успешно').toBeOK();

    return context;
  }
}

export class KeyCloakSessionService extends AuthService {
  private extractLoginUrl(responseText: string): string {
    const root = parseHTML(responseText);
    const form = safeFind(root, '#kc-form-login', 'Форма логина KeyCloak');
    return safeAttr(form, 'action', 'Форма логина KeyCloak');
  }

  async login(user: SourceControlUser): Promise<BrowserContext> {
    const context = await this.createBrowserContext();
    const request = context.request;

    const response = await this.getLoginPageResponse(request);

    const responseText = await response.text();
    const loginUrl = this.extractLoginUrl(responseText);

    const loginData = {
      username: user.name,
      password: user.password,
      credentialId: '',
    };

    const loginResponse = await request.post(loginUrl, {
      form: loginData,
    });
    await expect(loginResponse, 'Запрос на вход выполнен успешно').toBeOK();

    return context;
  }
}

export class NgamSessionService extends AuthService {
  private extractSwitchFormUrl(root: HTMLElement): string {
    const certificateForm = safeFind(root, '#certificateForm', 'Форма логина СУДИР');
    return safeAttr(certificateForm, 'action', 'Форма логина СУДИР');
  }

  private extractSwitchParams(root: HTMLElement): { buttonValue: string; authenticationExecutionValue: string } {
    const button = safeFind(
      root,
      '#login-by-username-password-ldap-authenticator',
      'Кнопка переключения способа входа',
    );

    const buttonValue = safeAttr(button, 'value', 'Кнопка переключения способа входа');
    const onclick = safeAttr(button, 'onclick', 'Кнопка переключения способа входа');

    const authenticationExecutionValue = safeMatch(onclick, SET_VALUE_REGEX, 'authenticationExecution из onclick');

    return { buttonValue, authenticationExecutionValue };
  }

  private async submitSwitchRequest(
    request: APIRequestContext,
    url: string,
    buttonValue: string,
    authExecutionValue: string,
  ): Promise<string> {
    const response = await request.post(url, {
      form: {
        'login-by-username-password-ldap-authenticator': buttonValue,
        authenticationExecution: authExecutionValue,
      },
    });

    await expect(response, 'Переключение на аутентификацию по логину и паролю').toBeOK();
    return await response.text();
  }

  private async switchToPassAuth(request: APIRequestContext, responseText: string) {
    const root = parseHTML(responseText);

    const switchUrl = this.extractSwitchFormUrl(root);
    const { buttonValue, authenticationExecutionValue } = this.extractSwitchParams(root);

    const updatedHtml = await this.submitSwitchRequest(request, switchUrl, buttonValue, authenticationExecutionValue);
    return updatedHtml;
  }

  private async extractLoginUrl(request: APIRequestContext, responseText: string) {
    const loginPageContext = await this.switchToPassAuth(request, responseText);

    const root = parseHTML(loginPageContext);
    const passForm = safeFind(root, '#loginForm', 'Форма логина СУДИР');
    return safeAttr(passForm, 'action', 'Форма логина СУДИР');
  }

  async login(user: SourceControlUser): Promise<BrowserContext> {
    const context = await this.createBrowserContext();
    const request = context.request;

    const response = await this.getLoginPageResponse(request);

    const responseText = await response.text();
    const loginUrl = await this.extractLoginUrl(request, responseText);

    const loginData = {
      username: user.name,
      password: user.password,
      credentialId: '',
    };

    const loginResponse = await request.post(loginUrl, {
      form: loginData,
    });
    await expect(loginResponse, 'Запрос на вход выполнен успешно').toBeOK();

    return context;
  }
}

export class CertificateSessionService extends AuthService {
  protected login(
    user: Omit<SourceControlUser, 'clientCertificate'> & Required<Pick<SourceControlUser, 'clientCertificate'>>,
  ): Promise<BrowserContext> {
    const cert = Buffer.from(user.clientCertificate.certificate);
    const key = Buffer.from(user.clientCertificate.privateKey);
    const certSettings = user.clientCertificate.origins.map((origin: string) => ({
      origin,
      cert: cert,
      key: key,
    }));
    return this.createBrowserContext({
      clientCertificates: certSettings,
    });
  }
}
