import { randomBytes } from 'crypto';
import {
  access,
  constants,
  appendFile as fsAppendFile,
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  mkdir,
  mkdtemp,
  rm,
} from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join, normalize, resolve } from 'path';

const FILE_ENCODING = 'utf8';
const EXT_DELIMITER = '.';

const SCHEMAS_DIR = 'tests/resources/schemas/';
const RESOURCES_DIR = 'tests/resources/';

const DIR_PREFIX = 'vcs-pw-';
const TEMP_DIR_PREFIX = join(tmpdir(), DIR_PREFIX);

export async function createTempDir(): Promise<string> {
  return mkdtemp(TEMP_DIR_PREFIX);
}

export async function deletePath(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

export async function makeDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function readFile(path: string): Promise<string> {
  const isExists = await isFileExists(path);
  if (!isExists) {
    throw new Error(`Не найден файл: ${path}`);
  }
  return fsReadFile(path, { encoding: FILE_ENCODING });
}

export async function writeFile(filePath: string, content: string | Buffer): Promise<void> {
  const dir = dirname(filePath);
  await makeDir(dir);
  await fsWriteFile(filePath, content, { encoding: FILE_ENCODING });
}

export async function appendFile(filePath: string, content: string): Promise<void> {
  await fsAppendFile(filePath, content, { encoding: FILE_ENCODING });
}

export async function generateFile(filePath: string, sizeInBytes: number): Promise<void> {
  const randomData = randomBytes(sizeInBytes);
  await fsWriteFile(filePath, randomData);
}

export async function isFileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveFromResources(filePath: string): string {
  return resolve(RESOURCES_DIR, filePath);
}

export async function getSchema(filePath: string): Promise<Record<string, any>> {
  const path = resolve(SCHEMAS_DIR, filePath);
  const content = await readFile(path);
  return JSON.parse(content);
}

export function toUnixPath(path: string) {
  return normalize(path).replace(/\\/g, '/');
}

export function getFileExt(path: string): string {
  try {
    return path.split(EXT_DELIMITER).pop() ?? '';
  } catch {
    return '';
  }
}

export { join, resolve, basename } from 'path';
