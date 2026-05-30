import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { UserInfoZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { step } from '@vcs-pw/test';

export class UsersBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v3/users',
    });
  }

  getUser(username: string): Promise<UserInfoZodType> {
    return step(`Получение информации о пользователе`, async () => {
      const response = await this.get(username, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }
}
