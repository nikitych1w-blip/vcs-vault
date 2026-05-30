import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { CreateSshKeyRequestZodType, CreateSshKeyResponseZodType } from '@vcs-pw/api/generated/types/api/v2/zod.gen';
import { step } from '@vcs-pw/test';

type AddKeyOptions = CreateSshKeyRequestZodType;
type KeyInfo = CreateSshKeyResponseZodType;

export class AdminUsersKeysBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v2/admin/users/keys',
    });
  }

  addKey(userKey: string, options: AddKeyOptions): Promise<KeyInfo> {
    return step(`Добавление SSH-ключа ${options.title}`, async () => {
      const response = await this.post('', options, {
        params: { user_key: userKey },
        validateStatus: isStatus(HttpStatusCode.Created),
      });
      return response.data;
    });
  }

  deleteKey(userKey: string, title: string): Promise<void> {
    return step(`Удаление SSH-ключа ${title}`, () =>
      this.delete('', {
        params: { user_key: userKey, title },
        validateStatus: isStatus(HttpStatusCode.Ok),
      }),
    );
  }
}
