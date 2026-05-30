import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { CreateUserRequestZodType, CreateUserResponseZodType } from '@vcs-pw/api/generated/types/api/v2/zod.gen';
import { step } from '@vcs-pw/test';

export type CreateUserOptions = CreateUserRequestZodType;
type UserInfo = CreateUserResponseZodType;

export class AdminUsersBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v2/admin/users',
    });
  }

  createUser(options: CreateUserRequestZodType): Promise<UserInfo> {
    return step(`Создание пользователя ${options.name}`, async () => {
      const response = await this.post('', options, {
        validateStatus: isStatus(HttpStatusCode.Created),
      });
      return response.data;
    });
  }
}
