import { BackApi, isStatus, HttpStatusCode, AxiosClientOptions } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';

interface ProjectOptions {
  project_key: string;
  org_key: string;
}

export class ProjectsBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'sbt/api/internal/projects',
    });
  }

  deleteProject(options: ProjectOptions): Promise<void> {
    return step(`Удаление проекта по ключу ${options.project_key}`, () =>
      this.delete('delete', {
        data: options,
        validateStatus: isStatus(HttpStatusCode.Ok),
      }),
    );
  }
}
