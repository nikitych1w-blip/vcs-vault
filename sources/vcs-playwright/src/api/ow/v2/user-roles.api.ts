import { RequestClientOptions, OldWebApi } from '@vcs-pw/api/client';
import { expectNoOneWorkErrors } from '@vcs-pw/api/ow';
import { step } from '@vcs-pw/test';

interface UserRole {
  projectId: string;
  email: string;
  teamRoleName: string;
}

export class UserRolesOneWorkWebApi extends OldWebApi {
  constructor(options: RequestClientOptions) {
    super({
      ...options,
      path: 'ssd-role-manager/v2/user_roles',
    });
  }

  grantRole(options: UserRole[]): Promise<void> {
    return step(`Добавление пользователей в проект OneWork`, async () => {
      const response = await this.post('', {
        data: options,
      });
      const data = await response.json();
      expectNoOneWorkErrors(data);
    });
  }

  updateRole(options: UserRole[]): Promise<void> {
    return step(`Обновление роли пользователей в проекте OneWork`, async () => {
      const response = await this.put('', {
        data: options,
      });
      const data = await response.json();
      expectNoOneWorkErrors(data);
    });
  }
}
