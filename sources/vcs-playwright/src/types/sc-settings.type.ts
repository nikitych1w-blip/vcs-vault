import { DataGenerator } from '@vcs-pw/services/data.service';

export const KILOBYTE = 2 ** 10;
export const MEGABYTE = 2 ** 10 * KILOBYTE;

export const ATTACHMENT_MAX_SIZE_IN_MB = 4;
export const ATTACHMENT_MAX_SIZE = ATTACHMENT_MAX_SIZE_IN_MB * MEGABYTE;
export const ATTACHMENT_MAX_COUNT = 5;

export const generateValidAttachmentSize = (dg: DataGenerator) =>
  dg.faker.number.int({ min: 1, max: ATTACHMENT_MAX_SIZE });

export const ATTACHMENT_ALLOWED_EXTENSIONS = [
  '.csv',
  '.docx',
  '.fodg',
  '.fodp',
  '.fods',
  '.fodt',
  '.gif',
  '.gz',
  '.jpeg',
  '.jpg',
  '.log',
  '.md',
  '.mov',
  '.mp4',
  '.odf',
  '.odg',
  '.odp',
  '.ods',
  '.odt',
  '.patch',
  '.pdf',
  '.png',
  '.pptx',
  '.svg',
  '.tgz',
  '.txt',
  '.webm',
  '.xls',
  '.xlsx',
  '.zip',
] as const;

export const UPLOAD_MAX_SIZE_IN_MB = 3;
export const UPLOAD_MAX_SIZE = UPLOAD_MAX_SIZE_IN_MB * MEGABYTE;
export const UPLOAD_MAX_COUNT = 5;

export const generateValidUploadSize = (dg: DataGenerator) => dg.faker.number.int({ min: 1, max: UPLOAD_MAX_SIZE });

export const UPLOAD_ALLOWED_EXTENSIONS = [
  '.csv',
  '.docx',
  '.fodg',
  '.fodp',
  '.fods',
  '.fodt',
  '.gif',
  '.gz',
  '.jpeg',
  '.jpg',
  '.log',
  '.md',
  '.mov',
  '.mp4',
  '.odf',
  '.odg',
  '.odp',
  '.ods',
  '.odt',
  '.patch',
  '.pdf',
  '.png',
  '.pptx',
  '.svg',
  '.tgz',
  '.txt',
  '.webm',
  '.xls',
  '.xlsx',
  '.zip',
] as const;
