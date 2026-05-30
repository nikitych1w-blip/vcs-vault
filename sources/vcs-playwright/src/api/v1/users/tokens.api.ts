import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';

interface CreateTokenOptions {
  name: string;
  scopes: string[];
}

interface TokenInfo {
  id: number;
  name: string;
  scopes: string[];
  sha1: string;
  token_last_eight: string;
}

/**
 * Для вызова этой API использует только (!) basicAuth
 * https://docs.gitea.com/development/api-usage#generating-and-listing-api-tokens
 *
 * Для работы от имени пользователя задается заголовок Sudo — так вызывать имеет право только администратор
 */
export class UsersTokensBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v1/users',
    });
  }

  createToken(username: string, options: CreateTokenOptions): Promise<TokenInfo> {
    return step(
      `Создание токена для пользователя ${username} со скоупами: ${!!options.scopes ? options.scopes : '[]'}`,
      async () => {
        const response = await this.post(`${username}/tokens`, options, {
          headers: this.getSudoHeader(username),
          validateStatus: isStatus(HttpStatusCode.Created),
        });
        return response.data;
      },
    );
  }

  getTokens(username: string): Promise<TokenInfo[]> {
    return step(`Получение токенов пользователя ${username}`, async () => {
      const response = await this.get(`${username}/tokens`, {
        headers: this.getSudoHeader(username),
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  deleteTokenById(username: string, tokenId: number): Promise<void> {
    return step(`Удаление токена пользователя ${username}`, () =>
      this.delete(`${username}/tokens/${tokenId}`, {
        headers: this.getSudoHeader(username),
        validateStatus: isStatus(HttpStatusCode.NoContent),
      }),
    );
  }

  async deleteTokenByName(username: string, tokenName: string): Promise<void> {
    const tokenInfo = await this.getTokenByName(username, tokenName);
    if (tokenInfo) {
      await this.deleteTokenById(username, tokenInfo.id);
    }
  }

  async getTokenByName(username: string, tokenName: string): Promise<TokenInfo | null> {
    const tokens = await this.getTokens(username);
    for (const token of tokens) {
      if (token.name === tokenName) {
        return token;
      }
    }
    return null;
  }
}
