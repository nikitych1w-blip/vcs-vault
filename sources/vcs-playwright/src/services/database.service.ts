import { expect } from '@playwright/test';
import { Pool, QueryResult, QueryResultRow } from 'pg';

import { RepoOptions } from '@vcs-pw/api/web';
import { log } from '@vcs-pw/logger';
import { step } from '@vcs-pw/test';
import { DatabaseConfig } from '@vcs-pw/types/config.type';

const PULL_CHECKING_STATUS = 1;

function logResult(result: QueryResult<any>) {
  log.info('Результат выполнения', { rows: result.rows });
}

function logQuery(statement: string, parameters: any[] = []) {
  log.info('Выполнение SQL-запроса', {
    statement,
    parameters,
  });
}

function parseUrl(rawUrl: string): [string, number, string] {
  const url = new URL(rawUrl);
  const port = url.port ? parseInt(url.port, 10) : 5432;
  const database = url.pathname.slice(1) || 'postgres';
  const host = url.hostname;
  return [host, port, database];
}

export class DatabasePool {
  private readonly pool: Pool;

  constructor(config: DatabaseConfig) {
    const [host, port, database] = parseUrl(config.url);
    this.pool = new Pool({
      host,
      port,
      database,
      user: config.user.name,
      password: config.user.password,
      options: `-csearch_path=${config.schema}`,
      application_name: 'vcs-pw',
      ssl: false,
      min: 1,
    });
  }

  async query<T extends QueryResultRow>(text: string, params?: any[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export class DatabaseService {
  readonly repos = {
    pulls: new ReposPullsDatabaseService(this),
  };

  constructor(
    private readonly pool: DatabasePool,
    readonly pollConfig: DatabaseConfig['poll'],
  ) {}

  async execute<T extends QueryResultRow = any>(statement: string, parameters: any[] = []): Promise<QueryResult<T>> {
    logQuery(statement, parameters);
    const result = await this.pool.query<T>(statement, parameters);
    logResult(result);
    return result;
  }
}

class ReposPullsDatabaseService {
  constructor(private readonly databaseService: DatabaseService) {}

  async waitForNonCheckingStatus({ projectName, repoName }: RepoOptions, index: number) {
    await step(`БД: Ожидание завершения проверки запроса на слияние #${index}`, () =>
      expect
        .poll(
          async () => {
            const result = await this.databaseService.execute(Query.repos.pulls.getStatusByBaseRepoCoordsAndIndex, [
              projectName,
              repoName,
              index,
            ]);
            return result.rows.length > 0 && result.rows[0].status !== PULL_CHECKING_STATUS;
          },
          {
            message: `БД: Статус запроса на слияние не равен 'Checking'`,
            timeout: this.databaseService.pollConfig.timeout,
            intervals: [this.databaseService.pollConfig.interval],
          },
        )
        .toBe(true),
    );
  }

  async waitForCommitsAheadCount(repoOptions: RepoOptions, index: number, count: number) {
    return this.waitForCommitsCount(repoOptions, index, 'ahead', count);
  }

  async waitForCommitsBehindCount(repoOptions: RepoOptions, index: number, count: number) {
    return this.waitForCommitsCount(repoOptions, index, 'behind', count);
  }

  private async waitForCommitsCount(
    { projectName, repoName }: RepoOptions,
    index: number,
    type: 'ahead' | 'behind',
    count: number,
  ) {
    await step(`БД: Ожидание ${count} ${type} коммитов в запросе на слияние #${index}`, () =>
      expect
        .poll(
          async () => {
            const result = await this.databaseService.execute(
              Query.repos.pulls.getCommitsByBaseRepoCoordsAndIndex(type),
              [projectName, repoName, index],
            );
            return result.rows[0][`commits_${type}`];
          },
          {
            message: `БД: ${type} коммитов — ${count}`,
            timeout: this.databaseService.pollConfig.timeout,
            intervals: [this.databaseService.pollConfig.interval],
          },
        )
        .toBe(count),
    );
  }
}

const Query = {
  repos: {
    pulls: {
      getStatusByBaseRepoCoordsAndIndex: `SELECT pr.status 
        FROM pull_request pr 
        INNER JOIN repository r ON pr.base_repo_id = r.id 
        WHERE r.owner_name = $1 AND r."name" = $2 AND pr.index = $3`,
      getCommitsByBaseRepoCoordsAndIndex: (type: string) => `SELECT pr.commits_${type} 
        FROM pull_request pr 
        INNER JOIN repository r ON pr.base_repo_id = r.id 
        WHERE r.owner_name = $1 AND r."name" = $2 AND pr.index = $3`,
    },
  },
} as const;
