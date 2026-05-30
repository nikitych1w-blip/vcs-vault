import { Fixtures } from '@playwright/test';
import { Severity, severity, tms } from 'allure-js-commons';

import { AllureTestFixture } from '@vcs-pw/test/fixtures/types';

const SPACE = 'VCS';
const TAG_PREFIX_SIZE = 1;
const UNIT_CODE_TEMPLATE = '^(%s-\\d+)$';
const PRIORITY_VALUES = Object.values(Severity);

export const testFixture: Fixtures<AllureTestFixture> = {
  allureAttributes: [
    async ({}, use, testInfo) => {
      // Заполняем приоритет/tms в Allure-отчете на основе тега (вместо дублирования в аннтотации)
      const slicedTags = testInfo.tags.map((tag) => tag.slice(TAG_PREFIX_SIZE));

      const priority = extractPriorityTag(slicedTags, PRIORITY_VALUES);
      if (priority) {
        await severity(priority);
      }

      const tmsTag = extractCodeTag(slicedTags, SPACE);
      if (tmsTag) {
        await tms(tmsTag);
      }

      await use();
    },
    { box: true, auto: true },
  ],
};

function extractPriorityTag(tags: string[], priorityValues: string[]): string | undefined {
  for (const tag of tags) {
    if (priorityValues.includes(tag)) {
      return tag;
    }
  }
  return;
}

function extractCodeTag(tags: string[], space: string): string | undefined {
  const regex = new RegExp(UNIT_CODE_TEMPLATE.replace('%s', space));
  for (const tag of tags) {
    const match = tag.match(regex);
    if (match) {
      return match[1];
    }
  }
  return;
}
