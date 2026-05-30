import { APIRequestContext } from '@playwright/test';

import { ProjectsBackApi as ProjectsInternalBackApi } from '@vcs-pw/api/sbt/internal/projects.api';

import { UsersTokensBackApi } from '@vcs-pw/api/v1/users/tokens.api';

import { AdminUsersKeysBackApi } from '@vcs-pw/api/v2/admin/users/keys.api';
import { AdminUsersBackApi } from '@vcs-pw/api/v2/admin/users/users.api';

import { ProjectsBackApi } from '@vcs-pw/api/v2/projects/projects.api';
import { ProjectsReposBackApi } from '@vcs-pw/api/v2/projects/repos.api';
import { TenantInfo, TenantsBackApi } from '@vcs-pw/api/v2/tenants.api';

import { CacheBackApi } from '@vcs-pw/api/v3/cache.api';
import { ProjectsPrivilegesBackApi } from '@vcs-pw/api/v3/projects/privileges.api';
import { ReposPrivilegesBackApi } from '@vcs-pw/api/v3/repos/privileges.api';
import { ReposBackApi as ReposV3BackApi } from '@vcs-pw/api/v3/repos/repos.api';

import { ApiRegistry } from '@vcs-pw/services/api.service';
import { AuthService } from '@vcs-pw/services/auth.service';
import { DataGenerator, EntityManager } from '@vcs-pw/services/data.service';
import { DatabaseService } from '@vcs-pw/services/database.service';
import FileSystemService from '@vcs-pw/services/file.service';
import GitService from '@vcs-pw/services/git.service';
import ImageService from '@vcs-pw/services/image.service';
import { KafkaService } from '@vcs-pw/services/kafka.service';
import { PageRegistry } from '@vcs-pw/services/page.service';
import { PrivilegeService } from '@vcs-pw/services/privilege.service';
import { S3Service } from '@vcs-pw/services/s3.service';
import { SshKeyPairService } from '@vcs-pw/services/ssh.service';
import { TaskTrackerIntegrationService, UnitTaskTrackerService } from '@vcs-pw/services/task-tracker.service';

import CleanupStack from '@vcs-pw/types/cleanup.type';
import { Config } from '@vcs-pw/types/config.type';
import ItemPool from '@vcs-pw/types/pool.type';
import { SourceControlUser, User } from '@vcs-pw/types/user.type';

export type TestContext = Record<string, unknown> & {
  put: (this: TestContext, params: Record<string, unknown>) => void;
};

export interface KafkaWorkerFixture {
  kafkaService: KafkaService;
}

export interface S3WorkerFixture {
  s3Service: S3Service;
}

export interface PageWorkerFixture {
  pageRegistry: PageRegistry;
}

export interface DataTestFixture {
  testContext: TestContext;

  entityManager: EntityManager;

  taskTrackerIntegrationService: TaskTrackerIntegrationService;
  unitTaskTrackerService: UnitTaskTrackerService;

  gitService: GitService;
  fileSystemService: FileSystemService;
  sshKeyPairService: SshKeyPairService;
}

export interface DataWorkerFixture {
  dataGenerator: DataGenerator;

  tuzToken: string;
  adminToken: string;
  tenantInfo: TenantInfo;

  getUserInfo: () => void;

  imageService: ImageService;
  databaseService: DatabaseService;
}

export interface ConfigWorkerFixture {
  config: Config;
}

export interface CleanupTestFixture {
  cleanup: CleanupStack;
}

export interface AuthTestFixture {
  authService: AuthService;

  owCoordinatorRequest: APIRequestContext;
}

/**
 * В фикстуру вынесены самые часто используемые API (работа с проектами/репозиториями, токенами и привилегиями)
 * В тестах для получения класса API достаточно использовать фикстуру apiRegistry
 * Например: const api = new apiRegistry.v1.version({ baseUrl: config.api.baseUrl });
 * Если API требует авторизацию, то дополнительно в конфиге передавать auth.
 */
export interface ApiWorkerFixture {
  apiRegistry: ApiRegistry;
  privilegeService: PrivilegeService;
  projectsInternalApi: ProjectsInternalBackApi;

  usersTokensV1Api: UsersTokensBackApi;

  tenantsV2Api: TenantsBackApi;
  projectsV2Api: ProjectsBackApi;
  projectsReposV2Api: ProjectsReposBackApi;
  adminUsersKeysV2Api: AdminUsersKeysBackApi;
  adminUsersV2Api: AdminUsersBackApi;

  projectsPrivilegesV3Api: ProjectsPrivilegesBackApi;
  reposPrivilegesV3Api: ReposPrivilegesBackApi;
  reposV3Api: ReposV3BackApi;

  cacheApi: CacheBackApi;
}

export interface UserTestFixture {
  userPool: ItemPool<SourceControlUser>;
  user: SourceControlUser;
}

export interface UserWorkerFixture {
  tuz: SourceControlUser;
  localAdmin: User;
  admin: SourceControlUser;
}

export interface AllureTestFixture {
  allureAttributes: void;
}
