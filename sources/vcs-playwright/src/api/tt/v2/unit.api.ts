import { AxiosClientOptions, BackApi, HttpStatusCode, isStatus } from '@vcs-pw/api/client';
import { IdDto } from '@vcs-pw/api/tt';
import { step } from '@vcs-pw/test';

interface UnitAttributes extends Record<string, any> {
  workflow_status?: { command: 'NEW' };
}

export interface UnitOptions {
  summary: string;
  space: string;
  suit: string;
  deleted?: boolean;
  attributes: UnitAttributes;
}

export interface UnitInfo {
  // Не все поля
  code: string;
  summary: string;
  attributes: UnitAttributeCodeValueInfo[];
}

interface UnitAttributeCodeValueInfo {
  code: string;
  name: string;
  value: {
    code: string;
    name: string;
  } | null;
  valueAsString: string;
}

export class UnitTaskTrackerApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'rest/api/unit/v2',
    });
  }

  getUnit(code: string): Promise<UnitInfo> {
    return step(`TaskTracker: Получение информации о юните ${code}`, async () => {
      const response = await this.get(code, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  createUnit(options: UnitOptions): Promise<IdDto> {
    return step(`TaskTracker: Создание юнита с типом ${options.suit}`, async () => {
      const response = await this.post(`${options.suit}/create`, options, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  updateUnit(code: string, options: Partial<UnitOptions>): Promise<IdDto> {
    return step(`TaskTracker: Обновлению юнита ${code}`, async () => {
      const response = await this.patch(`update/${code}`, options, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  deleteUnit(code: string): Promise<IdDto> {
    return this.updateUnit(code, { deleted: true });
  }
}
