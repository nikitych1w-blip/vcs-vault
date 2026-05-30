import { OldWebApi, RequestClientOptions } from '@vcs-pw/api/client';
import { RepoOptions } from '@vcs-pw/api/web';
import { step } from '@vcs-pw/test';

interface SettingsOptions extends Record<string, any> {
  action: 'owners' | 'advanced' | 'update';
}

interface CodeOwnerSettingsOptions {
  enabled: boolean;
  approvalCount: number;
}

export class SettingsWebApi extends OldWebApi {
  constructor(options: RequestClientOptions) {
    super(options);
  }

  private async applySettings({ projectName, repoName }: RepoOptions, options: SettingsOptions) {
    const csrf = await this.csrfParam();
    await this.post(`${projectName}/${repoName}/settings`, {
      form: { ...csrf, ...options },
      failOnStatusCode: true,
    });
  }

  applyCodeOwnersSettings(repoOptions: RepoOptions, settingsOptions: CodeOwnerSettingsOptions) {
    return step(`Обновление настроек 'Одобрение владельцев кода' в репозитории ${repoOptions.repoName}`, async () => {
      return this.applySettings(repoOptions, {
        action: 'owners',
        approval_status: this.toCheckboxValue(settingsOptions.enabled),
        amount_users: settingsOptions.approvalCount,
      });
    });
  }
}
