import Ajv, { ErrorObject } from 'ajv';
import errorsPlugin from 'ajv-errors';
import formatsPlugin from 'ajv-formats';

import { BackApi, ReactWebApi } from '@vcs-pw/api/client';

import { UserRolesOneWorkWebApi } from '@vcs-pw/api/ow/v2/user-roles.api';
import { ProjectsOneWorkWebApi } from '@vcs-pw/api/ow/v3/projects.api';

import { TaskTrackerPluginApi } from '@vcs-pw/api/tt/plugin/task-tracker.plugin.api';
import { WorkflowTaskTrackerApi } from '@vcs-pw/api/tt/v1/workflow.api';
import { SpaceTaskTrackerApi } from '@vcs-pw/api/tt/v2/space.api';
import { UnitTaskTrackerApi } from '@vcs-pw/api/tt/v2/unit.api';

import { ProjectsBackApi as ProjectsInternalBackApi } from '@vcs-pw/api/sbt/internal/projects.api';

import { ArchiveWebApi } from '@vcs-pw/api/web/v1/repo/archive.api';
import { CommentsWebApi } from '@vcs-pw/api/web/v1/repo/comments.api';
import { PullsWebApi } from '@vcs-pw/api/web/v1/repo/pulls.api';
import { RepoWebApi } from '@vcs-pw/api/web/v1/repo/repo.api';
import { ReviewsWebApi } from '@vcs-pw/api/web/v1/repo/reviews.api';
import { SettingsWebApi } from '@vcs-pw/api/web/v1/repo/settings.api';

import { ReposAttachmentsReactWebApi } from '@vcs-pw/api/web/v2/projects/repos/attachments.api';
import { ReposReactWebApi } from '@vcs-pw/api/web/v2/projects/repos/repos.api';

import { OrgsHooksBackApi } from '@vcs-pw/api/v1/orgs/hooks.api';
import { OrgsReposBackApi } from '@vcs-pw/api/v1/orgs/repos.api';
import { ReposCommitsBackApi } from '@vcs-pw/api/v1/repos/commits.api';
import { ReposHooksBackApi } from '@vcs-pw/api/v1/repos/hooks.api';
import { ReposLabelsBackApi } from '@vcs-pw/api/v1/repos/labels.api';
import { ReposMilestonesBackApi } from '@vcs-pw/api/v1/repos/milestones.api';
import { ReposPullsBackApi as ReposPullsBackApiV1 } from '@vcs-pw/api/v1/repos/pulls.api';
import { ReposBackApi as ReposV1BackApi } from '@vcs-pw/api/v1/repos/repos.api';
import { ReposReviewsBackApi } from '@vcs-pw/api/v1/repos/reviews.api';
import { UserBackApi as UserV1BackApi } from '@vcs-pw/api/v1/user.api';
import { UsersTokensBackApi } from '@vcs-pw/api/v1/users/tokens.api';
import { UsersBackApi as UsersV1BackApi } from '@vcs-pw/api/v1/users/users.api';
import { VersionBackApi } from '@vcs-pw/api/v1/version.api';

import { AdminUsersKeysBackApi } from '@vcs-pw/api/v2/admin/users/keys.api';
import { AdminUsersBackApi } from '@vcs-pw/api/v2/admin/users/users.api';
import { ProjectsBackApi } from '@vcs-pw/api/v2/projects/projects.api';
import { ProjectsReposBackApi } from '@vcs-pw/api/v2/projects/repos.api';
import { TenantsBackApi } from '@vcs-pw/api/v2/tenants.api';

import { CacheBackApi } from '@vcs-pw/api/v3/cache.api';
import { ProjectsPrivilegesBackApi } from '@vcs-pw/api/v3/projects/privileges.api';
import { ReposArchiveBackApi } from '@vcs-pw/api/v3/repos/archive.api';
import { ReposBranchProtectionsBackApi } from '@vcs-pw/api/v3/repos/branch-protections.api';
import { ReposBranchesBackApi } from '@vcs-pw/api/v3/repos/branches.api';
import { ReposCommitsStatusesBackApi } from '@vcs-pw/api/v3/repos/commits/statuses.api';
import { ReposContentsFileBackApi } from '@vcs-pw/api/v3/repos/contents/file.api';
import { ReposPrivilegesBackApi } from '@vcs-pw/api/v3/repos/privileges.api';
import { ReposPullsCommentsBackApi } from '@vcs-pw/api/v3/repos/pulls/comments.api';
import { ReposPullsBackApi as ReposPullsBackApiV3 } from '@vcs-pw/api/v3/repos/pulls/pulls.api';
import { ReposBackApi as ReposV3BackApi } from '@vcs-pw/api/v3/repos/repos.api';
import { ReposReviewSettingsBackApi } from '@vcs-pw/api/v3/repos/review-settings.api';
import { UserKeysBackApi } from '@vcs-pw/api/v3/user/keys.api';
import { UsersBackApi } from '@vcs-pw/api/v3/users/users.api';

interface ValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

export class ApiRegistry {
  readonly client = BackApi;

  readonly internal = {
    projects: ProjectsInternalBackApi,
  };

  readonly v1 = {
    users: { tokens: UsersTokensBackApi, users: UsersV1BackApi },
    user: UserV1BackApi,
    version: VersionBackApi,
    repos: {
      repos: ReposV1BackApi,
      commits: ReposCommitsBackApi,
      hooks: ReposHooksBackApi,
      reviews: ReposReviewsBackApi,
      pulls: ReposPullsBackApiV1,
      milestones: ReposMilestonesBackApi,
      labels: ReposLabelsBackApi,
    },
    orgs: {
      repos: OrgsReposBackApi,
      hooks: OrgsHooksBackApi,
    },
  };

  readonly v2 = {
    projects: { projects: ProjectsBackApi, repos: ProjectsReposBackApi },
    admin: { users: { users: AdminUsersBackApi, keys: AdminUsersKeysBackApi } },
    tenants: TenantsBackApi,
  };

  readonly v3 = {
    repos: {
      commits: { statuses: ReposCommitsStatusesBackApi },
      repos: ReposV3BackApi,
      privileges: ReposPrivilegesBackApi,
      branches: ReposBranchesBackApi,
      pulls: { pulls: ReposPullsBackApiV3, comments: ReposPullsCommentsBackApi },
      reviewSettings: ReposReviewSettingsBackApi,
      branchProtections: ReposBranchProtectionsBackApi,
      archive: ReposArchiveBackApi,
      contents: { file: ReposContentsFileBackApi },
    },
    projects: {
      privileges: ProjectsPrivilegesBackApi,
    },
    cache: CacheBackApi,
    user: {
      keys: UserKeysBackApi,
    },
    users: UsersBackApi,
  };

  readonly web = {
    client: ReactWebApi, // web v1 не тестируем, так что v2 по умолчанию
    v1: {
      repo: {
        repo: RepoWebApi,
        pulls: PullsWebApi,
        comments: CommentsWebApi,
        reviews: ReviewsWebApi,
        archive: ArchiveWebApi,
        settings: SettingsWebApi,
      },
    },
    v2: {
      projects: {
        repos: { repos: ReposReactWebApi, attachments: ReposAttachmentsReactWebApi },
      },
    },
  };

  readonly ow = {
    v2: { userRoles: UserRolesOneWorkWebApi },
    v3: { projects: ProjectsOneWorkWebApi },
  };
  readonly tt = {
    v2: { unit: UnitTaskTrackerApi, space: SpaceTaskTrackerApi },
    v1: { workflow: WorkflowTaskTrackerApi },
    plugin: { taskTracker: TaskTrackerPluginApi },
  };
}

class SchemaValidator {
  private readonly ajv: Ajv;
  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: true,
      verbose: true,
    });
    formatsPlugin(this.ajv);
    errorsPlugin(this.ajv);
  }

  validate(schema: object, data: object): ValidationResult {
    const validate = this.ajv.compile(schema);
    const isValid = validate(data);

    return {
      valid: isValid,
      errors: validate.errors ?? [],
    };
  }
}

export const schemaValidator = new SchemaValidator();
