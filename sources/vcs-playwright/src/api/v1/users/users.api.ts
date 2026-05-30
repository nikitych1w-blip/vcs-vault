import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';

interface UserInfo {
  // Не все поля
  email: string;
  full_name: string;
  id: number;
  login: string;
  login_name: string;
  username: string;
}

export class UsersBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v1/users',
    });
  }

  getUser(username: string): Promise<UserInfo> {
    return step(`Получение информации о пользователе ${username}`, async () => {
      const response = await this.get(username, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }
}
