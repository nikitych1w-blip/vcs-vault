import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { UserKeyCreateZodType, UserKeyZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { step } from '@vcs-pw/test';

export class UserKeysBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v3/user',
    });
  }

  addKey(options: UserKeyCreateZodType): Promise<UserKeyZodType> {
    return step(`Добавление SSH-ключа ${options.title}`, async () => {
      const response = await this.post('keys', options, {
        validateStatus: isStatus(HttpStatusCode.Created),
      });
      return response.data;
    });
  }
}
