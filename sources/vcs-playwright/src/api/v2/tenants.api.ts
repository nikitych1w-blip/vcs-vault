import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';
import {
  CreateTenantOptionsZodType,
  DeleteTenantOptionsZodType,
  TenantZodType,
} from '@vcs-pw/api/generated/types/api/v2/zod.gen';

export type TenantOptions = DeleteTenantOptionsZodType;
export type CreateTenantOptions = CreateTenantOptionsZodType;
export type TenantInfo = TenantZodType;

export class TenantsBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v2/tenants',
    });
  }

  getTenant(options: TenantOptions): Promise<TenantInfo> {
    return step(`Получение тенанта по ключу ${options.tenant_key}`, async () => {
      const response = await this.get('', {
        params: options,
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  deleteTenant(options: TenantOptions): Promise<void> {
    return step(`Удаление тенанта по ключу ${options.tenant_key}`, () =>
      this.delete('', {
        params: options,
        validateStatus: isStatus(HttpStatusCode.NoContent),
      }),
    );
  }

  createTenant(options: CreateTenantOptions): Promise<TenantInfo> {
    return step(`Создание тенанта с ключом ${options.tenant_key}`, async () => {
      const response = await this.post('', options, {
        validateStatus: isStatus(HttpStatusCode.Created),
      });
      return response.data;
    });
  }
}
