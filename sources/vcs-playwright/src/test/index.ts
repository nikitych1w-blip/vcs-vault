import { test } from '@playwright/test';
import { AttachmentOptions, ContentType, step as allureStep, attachment as allureAttachment } from 'allure-js-commons';

// Для избегания ошибок в worker фикстурах: can only be called while test is running
const isInsideTest = (): boolean => {
  try {
    return !!test.info()?.testId;
  } catch (_) {
    return false;
  }
};

export const step = async <T>(name: string, func: () => Promise<T>): Promise<T> => {
  if (isInsideTest()) {
    return allureStep(name, func);
  }
  return func();
};

export const attachment = async (
  name: string,
  content: string | Buffer<ArrayBufferLike>,
  options: ContentType | string | AttachmentOptions,
): Promise<void> => {
  const func = () => allureAttachment(name, content, options);
  if (isInsideTest()) {
    return func();
  }
};
