import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';

interface UserInfo {
  // Не все поля
  username: string;
}

export class UserBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v1/user',
    });
  }

  getAuthenticatedUser(): Promise<UserInfo> {
    return step(`Получение информации об аутентифицированном пользователе`, async () => {
      const response = await this.get('', {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }
}
