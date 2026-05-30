import { APIRequestContext, expect } from '@playwright/test';
import { step } from '@vcs-pw/test';

import { ProjectOptions as ProjectOwOptions } from '@vcs-pw/api/ow/v3/projects.api';
import { ProjectOptions, RepoOptions } from '@vcs-pw/api/v3';
import { CacheBackApi } from '@vcs-pw/api/v3/cache.api';
import { ProjectsPrivilegesBackApi } from '@vcs-pw/api/v3/projects/privileges.api';
import { ReposPrivilegesBackApi } from '@vcs-pw/api/v3/repos/privileges.api';
import { Config } from '@vcs-pw/config';
import { ApiRegistry } from '@vcs-pw/services/api.service';

export class PrivilegeService {
  constructor(
    private readonly config: Config,
    private readonly apiRegistry: ApiRegistry,
    private readonly projectsPrivilegesApi: ProjectsPrivilegesBackApi,
    private readonly reposPrivilegesApi: ReposPrivilegesBackApi,
    private readonly cacheApi: CacheBackApi,
  ) {}

  // --- Уровень OneWork проекта ---
  private async applyToOneWorkProject(
    request: APIRequestContext,
    method: 'grantRole' | 'updateRole',
    projectOptions: ProjectOwOptions,
    email: string,
    privilegeGroup: string,
  ) {
    const userRolesApi = new this.apiRegistry.ow.v2.userRoles({
      client: request,
      baseUrl: this.config.ow!.baseUrl,
    });
    await userRolesApi[method]([
      {
        projectId: `/${projectOptions.tenantKey}/${projectOptions.projectKey}`,
        email: email,
        teamRoleName: privilegeGroup,
      },
    ]);
  }

  async grantToOneWorkProject(
    request: APIRequestContext,
    projectOptions: ProjectOwOptions,
    email: string,
    privilegeGroup: string,
  ) {
    await this.applyToOneWorkProject(request, 'grantRole', projectOptions, email, privilegeGroup);
  }

  async updateOneWorkProjectRole(
    request: APIRequestContext,
    projectOptions: ProjectOwOptions,
    email: string,
    privilegeGroup: string,
  ) {
    await this.applyToOneWorkProject(request, 'updateRole', projectOptions, email, privilegeGroup);
  }

  // --- Уровень проекта ---
  async grantToProject(projectOptions: ProjectOptions, username: string, privilegeGroup: string): Promise<void> {
    await step(
      `Выдача пользователю ${username} группы привилегий ${privilegeGroup} на проект ${projectOptions.projectName}`,
      async () => {
        await this.projectsPrivilegesApi.grantPrivilegeGroups(projectOptions, [
          {
            user_name: username,
            privilege_group: privilegeGroup,
          },
        ]);
        await this.resetCache(projectOptions.tenantId);
      },
    );
  }

  async revokeFromProject(projectOptions: ProjectOptions, username: string, privilegeGroup: string): Promise<void> {
    await step(
      `Отзыв у пользователя ${username} группы привилегий ${privilegeGroup} на проект ${projectOptions.projectName}`,
      async () => {
        await this.projectsPrivilegesApi.revokePrivilegeGroups(projectOptions, [
          {
            user_name: username,
            privilege_group: privilegeGroup,
          },
        ]);
        await this.resetCache(projectOptions.tenantId);
      },
    );
  }

  async getProjectPrivilege(projectOptions: ProjectOptions, username: string): Promise<string | null> {
    return await this.projectsPrivilegesApi.getPrivilegeGroup(projectOptions, username);
  }

  async assertProjectPrivilege(
    projectOptions: ProjectOptions,
    username: string,
    privilegeGroup: string | null,
  ): Promise<void> {
    await step(
      `Пользователь ${username} должен иметь группу привилегий ${privilegeGroup} на проект ${projectOptions.projectName}`,
      async () => {
        const actual = await this.getProjectPrivilege(projectOptions, username);
        expect(actual, 'Группа привилегий на проект совпадает с ожидаемой').toEqual(privilegeGroup);
      },
    );
  }

  async waitForProjectPrivilege(
    projectOptions: ProjectOptions,
    username: string,
    privilegeGroup: string | null,
  ): Promise<void> {
    await step(
      `Ожидание, что пользователь ${username} имеет группу привилегий ${privilegeGroup} на проект ${projectOptions.projectName}`,
      async () => {
        await expect
          .poll(
            async () => {
              await this.resetCache(projectOptions.tenantId);
              return await this.getProjectPrivilege(projectOptions, username);
            },
            {
              message: 'Группа привилегий на проект совпадает с ожидаемой',
              timeout: this.config.sc.privilegesPoll.timeout,
              intervals: [this.config.sc.privilegesPoll.interval],
            },
          )
          .toEqual(privilegeGroup);
      },
    );
  }

  // --- Уровень репозитория ---
  async grantToRepo(repoOptions: RepoOptions, username: string, privilegeGroup: string): Promise<void> {
    await step(
      `Выдача пользователю ${username} группы привилегий ${privilegeGroup} на репозиторий ${repoOptions.repoName}`,
      async () => {
        await this.reposPrivilegesApi.grantPrivilegeGroups(repoOptions, [
          {
            user_name: username,
            privilege_group: privilegeGroup,
          },
        ]);
        await this.resetCache(repoOptions.tenantId);
      },
    );
  }

  async revokeFromRepo(repoOptions: RepoOptions, username: string, privilegeGroup: string): Promise<void> {
    await step(
      `Отзыв у пользователя ${username} группы привилегий ${privilegeGroup} на репозиторий ${repoOptions.repoName}`,
      async () => {
        await this.reposPrivilegesApi.revokePrivilegeGroups(repoOptions, [
          {
            user_name: username,
            privilege_group: privilegeGroup,
          },
        ]);
        await this.resetCache(repoOptions.tenantId);
      },
    );
  }

  async getRepoPrivilege(repoOptions: RepoOptions, username: string): Promise<string | null> {
    return await this.reposPrivilegesApi.getPrivilegeGroup(repoOptions, username);
  }

  async assertRepoPrivilege(repoOptions: RepoOptions, username: string, privilegeGroup: string | null): Promise<void> {
    await step(
      `Пользователь ${username} должен иметь группу привилегий ${privilegeGroup} на репозиторий ${repoOptions.repoName}`,
      async () => {
        const actual = await this.getRepoPrivilege(repoOptions, username);
        expect(actual).toEqual(privilegeGroup);
      },
    );
  }

  async waitForRepoPrivilege(repoOptions: RepoOptions, username: string, privilegeGroup: string | null): Promise<void> {
    await step(
      `Ожидание, что пользователь ${username} имеет группу привилегий ${privilegeGroup} на репозиторий ${repoOptions.repoName}`,
      async () => {
        await expect
          .poll(
            async () => {
              await this.resetCache(repoOptions.tenantId);
              return await this.getRepoPrivilege(repoOptions, username);
            },
            {
              message: 'Группа привилегий на репозиторий совпадает с ожидаемой',
              timeout: this.config.sc.privilegesPoll.timeout,
              intervals: [this.config.sc.privilegesPoll.interval],
            },
          )
          .toEqual(privilegeGroup);
      },
    );
  }

  async resetCache(tenantId: string) {
    await this.cacheApi.reset(tenantId);
  }
}
