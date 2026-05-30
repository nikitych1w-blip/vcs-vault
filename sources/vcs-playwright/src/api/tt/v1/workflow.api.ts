import { AxiosClientOptions, BackApi, HttpStatusCode, isStatus } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';

interface StatusTypeMetadata {
  style: {
    backgroundColorStatus: string;
    iconColorStatus: string;
    colorByEdsRef: string;
  };
}

interface StatusType {
  code: string;
  name: string;
  deleted: boolean;
  statusTypeMetadata: StatusTypeMetadata;
}

interface Status {
  code: string;
  name: string;
  deleted: boolean;
  exists: boolean;
  statusType: StatusType;
}

interface WorkflowSchemaDto {
  code: string;
  name: string;
  description: string | null;
}

interface Action {
  code: string;
  name: string;
  deleted: boolean;
  exists: boolean;
}

interface UnitWorkflowInfoDto {
  wfSchemaDto: WorkflowSchemaDto;
  currentStatus: Status;
  availableActions: Action[];
  actionsExcludedByCondition: Action[];
}

export class WorkflowTaskTrackerApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'rest/api/workflow/v1/unit',
    });
  }

  changeStatus(code: string, status: string): Promise<UnitWorkflowInfoDto> {
    return step(`TaskTracker: Изменение статуса юнита ${code} на ${status}`, async () => {
      const response = await this.patch(`${code}/status/change/${status}`, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  getStatus(code: string): Promise<UnitWorkflowInfoDto> {
    return step(`TaskTracker: Получение статуса юнита ${code}`, async () => {
      const response = await this.get(`${code}/status/get`, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }
}
