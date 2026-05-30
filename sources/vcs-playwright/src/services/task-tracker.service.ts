import { APIRequestContext, expect } from '@playwright/test';
import _ from 'lodash';

import { IdDto } from '@vcs-pw/api/tt';
import { PullRequestInfo, TaskTrackerPluginApi } from '@vcs-pw/api/tt/plugin/task-tracker.plugin.api';
import { WorkflowTaskTrackerApi } from '@vcs-pw/api/tt/v1/workflow.api';
import { SpaceTaskTrackerApi } from '@vcs-pw/api/tt/v2/space.api';
import { UnitInfo, UnitOptions, UnitTaskTrackerApi } from '@vcs-pw/api/tt/v2/unit.api';
import { Config } from '@vcs-pw/config';
import { DataGenerator, EntityManager } from '@vcs-pw/services/data.service';
import { getRandomElement, toPrettyJson } from '@vcs-pw/utils/object.util';

const PRIORITY_ATTRIBUTE_NAME = 'Приоритет';
const WORKFLOW_ATTRIBUTE_NAME = 'Статус';
const PRIORITY_MINOR = 'низкий';
const PRIORITY_MEDIUM = 'средний';
const PRIORITY_MAJOR = 'высокий';

type PullRequestStatus = 'OPENED' | 'CLOSED' | 'MERGED';
type GroupedPullRequestInfo = Partial<Record<PullRequestStatus, PullRequestInfo[]>>;

export interface TaskTrackerIntegrationService {
  /**
   * Создание связку проектов SourceControl и TaskTracker для проверки интеграции.
   * Возвращает ключ/имя проекта (совпадают при создании)
   */
  createProject(tenantKey: string): Promise<string>;
}

export class OneWorkTaskTrackerIntegrationService implements TaskTrackerIntegrationService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly owRequest: APIRequestContext,
    private readonly config: NonNullable<Config['ow']>,
  ) {}

  async createProject(tenantKey: string): Promise<string> {
    if (!this.config.tools.tt) {
      throw new Error('Не задан ключ инструмента TaskTracker (ow.tools.tt)');
    }

    const tools = [this.config.tools.sc, this.config.tools.tt];
    const project = await this.entityManager.createOneWorkProject(this.owRequest, tenantKey, tools);
    return project.projectKey;
  }
}

export class StandaloneTrackerIntegrationService implements TaskTrackerIntegrationService {
  private readonly unitApi: UnitTaskTrackerApi;
  private readonly spaceApi: SpaceTaskTrackerApi;

  constructor(
    private readonly entityManager: EntityManager,
    config: NonNullable<Config['tt']>,
  ) {
    this.unitApi = UnitTaskTrackerApi.withBasic(config.admin, {
      baseUrl: config.baseUrl,
    });
    this.spaceApi = SpaceTaskTrackerApi.withBasic(config.admin, {
      baseUrl: config.baseUrl,
    });
  }

  async createProject(tenantKey: string): Promise<string> {
    const project = await this.entityManager.createProjectV2(tenantKey);
    const idData = await this.spaceApi.createSpace({
      code: project.project_key,
      name: project.project_key,
      type: 'RUN',
    });
    this.entityManager.cleanup.push(() => this.unitApi.deleteUnit(idData.id));
    return project.project_key;
  }
}

export class UnitTaskTrackerService {
  private readonly unitApi: UnitTaskTrackerApi;
  private readonly ttPluginApi: TaskTrackerPluginApi;
  private readonly workflowApi: WorkflowTaskTrackerApi;

  constructor(
    private readonly config: NonNullable<Config['tt']>,
    private readonly dataGenerator: DataGenerator,
  ) {
    this.unitApi = UnitTaskTrackerApi.withBasic(config.admin, {
      baseUrl: config.baseUrl,
    });
    this.ttPluginApi = TaskTrackerPluginApi.withBasic(config.admin, {
      baseUrl: config.baseUrl,
    });
    this.workflowApi = WorkflowTaskTrackerApi.withBasic(config.admin, {
      baseUrl: config.baseUrl,
    });
  }

  async createUnit(space: string): Promise<UnitOptions & IdDto> {
    const payload: UnitOptions = {
      space,
      suit: this.config.suits.task,
      summary: this.dataGenerator.faker.lorem.sentence(),
      attributes: {
        workflow_status: {
          command: 'NEW',
        },
      },
    };
    const idData = await this.unitApi.createUnit(payload);
    return { ...payload, id: idData.id };
  }

  getUnit(code: string) {
    return this.unitApi.getUnit(code);
  }

  changePriority(code: string, priority: string | null) {
    const toUpdate = { attributes: { priority } };
    return this.unitApi.updateUnit(code, toUpdate);
  }

  async createUnits(space: string, count: number): Promise<UnitInfo[]> {
    const units: UnitInfo[] = [];
    for (let i = 0; i < count; i++) {
      const createdUnitInfo = await this.createUnit(space);
      const unitInfo = await this.getUnit(createdUnitInfo.id);
      units.push(unitInfo);
    }
    return units;
  }

  async changeStatusToRandomAvailable(code: string, iterationCount: number) {
    for (let i = 0; i < iterationCount; i++) {
      const statusInfo = await this.workflowApi.getStatus(code);
      const targetStatus = getRandomElement(statusInfo.availableActions)?.code;
      if (!targetStatus) {
        return;
      }
      await this.workflowApi.changeStatus(code, targetStatus);
    }
  }

  getUnitState(unitInfo: UnitInfo): string | undefined {
    return this.getUnitAttributeValueName(unitInfo, WORKFLOW_ATTRIBUTE_NAME);
  }

  getUnitPriority(unitInfo: UnitInfo): string | undefined {
    return this.getUnitAttributeValueName(unitInfo, PRIORITY_ATTRIBUTE_NAME);
  }

  priorityToIconClass(priority: string | undefined): string {
    if (!priority) {
      return 'normal';
    }

    switch (priority.toLowerCase().trim()) {
      case PRIORITY_MAJOR:
        return 'major';
      case PRIORITY_MEDIUM:
        return 'normal';
      case PRIORITY_MINOR:
        return 'minor';
      default:
        return 'normal';
    }
  }

  private getUnitAttributeValueName(unitInfo: UnitInfo, attribute: string): string | undefined {
    return unitInfo.attributes.filter((value) => value.name === attribute)[0]?.value?.name;
  }

  async getUnitPulls(code: string) {
    const data = await this.ttPluginApi.getPulls(code);
    return data.content;
  }

  async expectUnitPullsCount(code: string, count: number): Promise<PullRequestInfo[]> {
    let pulls: PullRequestInfo[] = [];
    await expect
      .poll(
        async () => {
          pulls = await this.getUnitPulls(code);
          return pulls.length;
        },
        {
          message: `У юнита ${code} количество связанных PR: ${count}`,
          timeout: this.config.poll.timeout,
          intervals: [this.config.poll.interval],
        },
      )
      .toEqual(count);
    return pulls;
  }

  async expectUnitPullsCountByStatus(
    code: string,
    filter: Partial<Record<PullRequestStatus, number>>,
  ): Promise<GroupedPullRequestInfo> {
    let pulls: GroupedPullRequestInfo = {};
    await expect
      .poll(
        async () => {
          const unitPulls = await this.getUnitPulls(code);
          pulls = _.groupBy(unitPulls, 'status');
          const counts = _.mapValues(pulls, (items: PullRequestInfo[]) => items.length);
          return counts;
        },
        {
          message: `У юнита ${code} количество связанных PR: ${toPrettyJson(filter)}`,
          timeout: this.config.poll.timeout,
          intervals: [this.config.poll.interval],
        },
      )
      .toEqual(filter);
    return pulls;
  }
}
