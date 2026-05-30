import { expect } from '@playwright/test';

interface HttpStatusWrap {
  value: number;
  reasonPhrase: string;
  error: boolean;
}

interface ServiceResponseError {
  message: string;
  code: number;
  serviceStatusError: string;
}

export interface OneWorkResponse<T = any> {
  httpStatusWrap: HttpStatusWrap;
  serviceResponseError?: ServiceResponseError | null;
  returned: T;
}

export function expectNoOneWorkErrors(response: OneWorkResponse): void {
  if (response.httpStatusWrap.error) {
    expect(response.serviceResponseError).toBeUndefined();
  }
}
