import { Severity } from 'allure-js-commons';
import { TestDetailsAnnotation } from '@playwright/test';

const makeAnnotation =
  (type: string) =>
  (value: string): TestDetailsAnnotation => ({
    type: type,
    description: value,
  });

export const AnnotationType = {
  ISSUE: 'issue',
  DESCRIPTION: 'description',
  OWNER: 'allure.label.owner',
} as const;

export const Annotation = Object.fromEntries(
  Object.entries(AnnotationType).map(([key, type]) => [key, makeAnnotation(type)]),
) as {
  [K in keyof typeof AnnotationType]: (value: string) => TestDetailsAnnotation;
};

export const Priority = Object.fromEntries(Object.entries(Severity).map(([key, type]) => [key, `@${type}`])) as {
  [K in keyof typeof Severity]: string;
};
