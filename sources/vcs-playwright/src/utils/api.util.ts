import { APIResponse } from '@playwright/test';
import { AxiosResponse } from 'axios';

export type HttpResponse = AxiosResponse | APIResponse;

function isAxiosResponse(response: any): response is AxiosResponse {
  return (
    response &&
    typeof response === 'object' &&
    'config' in response &&
    'data' in response &&
    'status' in response &&
    'headers' in response
  );
}

function isAPIResponse(response: any): response is APIResponse {
  return (
    response &&
    typeof response === 'object' &&
    'ok' in response &&
    'json' in response &&
    'status' in response &&
    'headers' in response
  );
}

export async function getResponseData(response: HttpResponse | Record<string, any>): Promise<any> {
  if (isAxiosResponse(response)) {
    return response.data;
  } else if (isAPIResponse(response)) {
    return await response.json().catch(() => ({}));
  }
  return response;
}

export async function getResponseContent(response: HttpResponse): Promise<string> {
  if (isAxiosResponse(response)) {
    const data = response.data;
    if (data !== undefined && typeof data !== 'string') {
      return String(data);
    }
    return data;
  }
  return await response.text();
}

export function getResponseStatus(response: HttpResponse): number {
  if (isAxiosResponse(response)) {
    return response.status;
  }
  return response.status();
}

export function getResponseHeaders(response: HttpResponse): Record<string, string> {
  const headers: Record<string, string> = {};

  if (isAxiosResponse(response)) {
    for (const [name, value] of Object.entries(response.headers)) {
      if (value !== undefined && value !== null) {
        headers[name.toLowerCase()] = String(value);
      }
    }
  } else if (isAPIResponse(response)) {
    for (const { name, value } of response.headersArray()) {
      headers[name.toLowerCase()] = value;
    }
  }

  return headers;
}

export async function tryToGetJson(response: APIResponse): Promise<object | string> {
  try {
    return await response.json();
  } catch {
    return await response.text();
  }
}
