import { log } from '@vcs-pw/logger';
import { DataGenerator } from '@vcs-pw/services/data.service';
import { step } from '@vcs-pw/test';
import CleanupStack from '@vcs-pw/types/cleanup.type';
import {
  createTempDir,
  deletePath,
  resolve,
  resolveFromResources,
  readFile as utilReadFile,
  writeFile,
} from '@vcs-pw/utils/file.util';
import { getByteLength } from '@vcs-pw/utils/string.util';

interface FileInfo {
  relativePath: string;
  absolutePath: string;
}

export default class FileSystemService {
  constructor(
    private readonly cleanup: CleanupStack,
    private readonly dataGenerator: DataGenerator,
  ) {}

  async createTempDir(): Promise<string> {
    return await step('Создание временной директории', async () => {
      const dir = await createTempDir();
      this.cleanup.push(() => deletePath(dir));
      log.info('Создана директория', { dir });
      return dir;
    });
  }

  async readFile(path: string): Promise<string> {
    return await step(`Чтение содержимого файла ${path}`, () => utilReadFile(path));
  }

  async generateRandomFile(baseDir: string, postfix?: string): Promise<FileInfo> {
    const relativePath = `${this.dataGenerator.filePath()}${!!postfix ? postfix : ''}`;
    const absolutePath = await this.createOrOverrideFile(relativePath, baseDir);
    return { relativePath, absolutePath };
  }

  async generateBinaryFile(
    baseDir: string,
    postfix?: string,
    sizeInBytes?: number,
  ): Promise<FileInfo & { content: Buffer<ArrayBufferLike> }> {
    return step('Генерация бинарного файла', async () => {
      const relativePath = `${this.dataGenerator.filePath()}${!!postfix ? postfix : ''}`;
      const content = this.dataGenerator.binaryContent(sizeInBytes);
      const absolutePath = await this.createOrOverrideFile(relativePath, baseDir, content);
      return { relativePath, absolutePath, content };
    });
  }

  async generateFileFromResource(
    baseDir: string,
    resourcePath: string,
    ext?: string,
  ): Promise<FileInfo & { content: string }> {
    return step(`Генерация файла с содержимым из ${resourcePath}`, async () => {
      const relativePath = this.dataGenerator.filePath() + (ext ?? '');
      const resourceAbsPath = resolveFromResources(resourcePath);
      const content = await utilReadFile(resourceAbsPath);
      const absolutePath = await this.createOrOverrideFile(relativePath, baseDir, content);
      return { relativePath, absolutePath, content };
    });
  }

  async createOrOverrideFile(filePath: string, baseDir?: string, content?: string | Buffer) {
    const toWrite = content ?? this.dataGenerator.stringContent();
    const absolutePath = baseDir ? resolve(baseDir, filePath) : filePath;
    await writeFile(absolutePath, toWrite);
    log.info('Записан файл', { absolutePath, size: getByteLength(toWrite) });
    return absolutePath;
  }

  async generateRandomFiles(baseDir: string, count: number) {
    return await step('Создание случайных файлов', async () => {
      const promises = Array.from({ length: count }, () => this.generateRandomFile(baseDir));
      return Promise.all(promises);
    });
  }
}
