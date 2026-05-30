import { expect } from '@playwright/test';
import { ContentType } from 'allure-js-commons';

import { AppliedPrivilegeStatusZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { attachment } from '@vcs-pw/test';
import { toPrettyJson } from '@vcs-pw/utils/object.util';

export interface ProjectOptions {
  tenantId: string;
  projectName: string;
}

export interface RepoOptions extends ProjectOptions {
  repoName: string;
}

export async function expectNoApplyPrivilegeErrors(result: AppliedPrivilegeStatusZodType): Promise<void> {
  const errors = result.applied_status?.errors ?? {};
  const grantErrors = errors?.grant ?? [];

  const onlyAllowedErrors = grantErrors.every(
    (grantError) => !grantError.error || grantError.error.includes('already has privilege'),
  );

  if (!onlyAllowedErrors) {
    await attachment('errors', toPrettyJson(errors), ContentType.JSON);
  }

  expect(onlyAllowedErrors, 'Отсутствуют ошибки выдачи групп привилегий').toBeTruthy();
}
