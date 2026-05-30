import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import {
  CreateProjectRequestZodType,
  ProjectZodType,
  V2GetProjectDataZodType,
} from '@vcs-pw/api/generated/types/api/v2/zod.gen';
import { step } from '@vcs-pw/test';

export type ProjectOptions = V2GetProjectDataZodType['query'];
export type CreateProjectOptions = CreateProjectRequestZodType;
export type ProjectInfo = ProjectZodType;

export const Visibility = {
  LIMITED: 1,
  PRIVATE: 2,
} as const;

export class ProjectsBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v2/projects',
    });
  }

  getProject(options: ProjectOptions): Promise<ProjectInfo> {
    return step(`Получение проекта по ключу ${options.project_key}`, async () => {
      const response = await this.get('', {
        params: options,
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  createProject(options: CreateProjectOptions): Promise<ProjectInfo> {
    return step(
      `Создание ${this.getVisibilityGenitiveLabel(options.visibility!)} проекта ${options.name}`,
      async () => {
        const response = await this.post('create', options, {
          validateStatus: isStatus(HttpStatusCode.Created),
        });
        return response.data;
      },
    );
  }

  private getVisibilityGenitiveLabel(visibility: number): string {
    switch (visibility) {
      case Visibility.LIMITED:
        return 'ограниченного';
      case Visibility.PRIVATE:
        return 'приватного';
      default:
        throw new Error(`Неподдерживаемая видимость: ${visibility}`);
    }
  }
}
