import { RequestClientOptions, OldWebApi } from '@vcs-pw/api/client';
import { expectNoOneWorkErrors } from '@vcs-pw/api/ow';
import { step } from '@vcs-pw/test';

export interface ProjectOptions {
  tenantKey: string;
  projectKey: string;
}

export interface CreateProjectOptions {
  parentId: string;
  bundleKey: string;
  projectKey: string;
  ownerLogin: string;
  description: string;
  projectName: string;
  tools: { toolKey: string }[];
}

export class ProjectsOneWorkWebApi extends OldWebApi {
  constructor(options: RequestClientOptions) {
    super({
      ...options,
      path: 'ssd-core-data/v3/projects',
    });
  }

  createProject(options: CreateProjectOptions): Promise<void> {
    return step(`Создание проекта ${options.projectName} в OneWork`, async () => {
      const response = await this.post('', {
        data: options,
      });
      const data = await response.json();
      expectNoOneWorkErrors(data);
    });
  }

  deleteProject({ tenantKey, projectKey }: ProjectOptions): Promise<void> {
    return step(`Удаление проекта ${projectKey} в OneWork`, async () => {
      const response = await this.delete('total', {
        params: { projectId: `/${tenantKey}/${projectKey}` },
      });
      const data = await response.json();
      expectNoOneWorkErrors(data);
    });
  }
}
