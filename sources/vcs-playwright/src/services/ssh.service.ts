import ExecRunner from '@vcs-pw/services/exec.service';
import FileSystemService from '@vcs-pw/services/file.service';
import { step } from '@vcs-pw/test';
import { resolve } from '@vcs-pw/utils/file.util';

const SPACE_REGEX = /\s+/;

export const KeyType = {
  RSA: 'ssh-rsa',
  ED25519: 'ssh-ed25519',
  ECDSA_256: 'ecdsa-sha2-nistp256',
  ECDSA_384: 'ecdsa-sha2-nistp384',
  ECDSA_521: 'ecdsa-sha2-nistp521',
} as const;

export interface SshKeygenOptions {
  type?: (typeof KeyType)[keyof typeof KeyType]; // -t
  bits?: number; // -b
  comment?: string; // -C
  dir: string; // -f
}

export interface SshKeyPair {
  privateKeyPath: string;
  publicKeyPath: string;
}

export interface SshConnectionOptions {
  host: string;
  port: number;
  user: string;
}

export class SshKeygen {
  constructor(private readonly execRunner: ExecRunner) {}

  async generate(opts: SshKeygenOptions): Promise<SshKeyPair> {
    const { type = KeyType.ED25519, bits, comment, dir } = opts;

    const privateKeyPath = resolve(dir, `id_${type}`);
    const publicKeyPath = `${privateKeyPath}.pub`;

    const args: string[] = ['ssh-keygen', '-t', type, '-f', `"${privateKeyPath}"`, '-q', '-P', '""'];

    if (bits && type === KeyType.RSA) {
      args.push('-b', String(bits));
    }
    if (comment) {
      args.push('-C', `"${comment}"`);
    }

    const result = await this.execRunner.run(args.join(' '));

    if (result.exitCode !== 0) {
      throw new Error(`ssh-keygen failed with code ${result.exitCode}: ${result.stderr}`);
    }

    return { privateKeyPath, publicKeyPath };
  }

  async convertToPem(publicKeyPath: string): Promise<string> {
    const args = ['ssh-keygen', '-f', `"${publicKeyPath}"`, '-e', '-m', 'pem', '-q'];

    const result = await this.execRunner.run(args.join(' '));

    if (result.exitCode !== 0) {
      throw new Error(`Failed to convert public key to PEM format: ${result.stderr}`);
    }
    return result.stdout.trim();
  }

  /**
   * Получает fingerprint публичного ключа с помощью утилиты ssh-keygen.
   * @param publicKeyPath Путь к публичному ключу.
   * @param execOptions Опции выполнения (cwd, env и т.д.)
   * @returns fingerprint в формате, который выводит ssh-keygen (например, SHA256:XXXXXXXX...).
   */
  async getFingerprint(publicKeyPath: string): Promise<string> {
    const args = ['ssh-keygen', '-l', '-E', 'sha256', '-f', `"${publicKeyPath}"`, '-q'];

    const result = await this.execRunner.run(args.join(' '));

    if (result.exitCode !== 0) {
      throw new Error(`ssh-keygen -l failed: ${result.stderr}`);
    }

    // Пример вывода: "256 SHA256:XXXXXXX ..."
    // Нам нужна только вторая часть (индекс 1)
    const output = result.stdout.trim();
    const fingerprint = output.split(SPACE_REGEX)[1];

    if (!fingerprint || !fingerprint.startsWith('SHA256:')) {
      throw new Error(`Invalid fingerprint format received: ${output}`);
    }

    return fingerprint;
  }
}

export class SshService {
  constructor(private readonly execRunner: ExecRunner) {}

  /**
   * Пытается подключиться по SSH. Не проверяет содержимое ответа!
   * Вызывающий должен сам убедиться, что вывод содержит подтверждение аутентификации.
   * Использует команду: ssh -T -i key -p port user@host
   *
   * @param privateKeyPath Путь к приватному ключу
   * @param options.host Хост (например, portal.works.prod.sbt)
   * @param options.port Порт SSH (например, 7999)
   * @param options.user Пользователь (обычно 'git')
   * @param execOptions Дополнительные опции выполнения (cwd, env и т.д.)
   *
   *  @returns Полный вывод (stdout + stderr)
   */
  async tryAuthenticate(privateKeyPath: string, { host, port, user }: SshConnectionOptions): Promise<string> {
    const args = [
      'ssh',
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      'IdentitiesOnly=yes',
      '-o',
      'BatchMode=yes',
      '-i',
      `"${privateKeyPath}"`,
      '-T',
      '-p',
      String(port),
      `${user}@${host}`,
    ];

    const result = await this.execRunner.run(args.join(' '));

    if (result.exitCode !== 0) {
      throw new Error(`SSH authentication failed (exit code ${result.exitCode}): ${result.stderr}`);
    }

    return (result.stdout + '\n' + result.stderr).trim();
  }
}

export class SshKeyPairService {
  constructor(
    private readonly fileSystemService: FileSystemService,
    private readonly sshKeygen: SshKeygen,
    private readonly sshService: SshService,
  ) {}

  async generateSshKeyPair(type: (typeof KeyType)[keyof typeof KeyType] = KeyType.ED25519): Promise<SshKeyPair> {
    const tempDir = await this.fileSystemService.createTempDir();
    return step(`SSH: Генерация пары ${type} ключей`, () => this.sshKeygen.generate({ type, dir: tempDir }));
  }

  async convertToPem(publicKeyPath: string): Promise<string> {
    return step('SSH: Конвертация публичного ключа в PEM формат', () => this.sshKeygen.convertToPem(publicKeyPath));
  }

  getFingerprint(publicKeyPath: string) {
    return step('SSH: Вычисление отпечатка публичного ключа', () => this.sshKeygen.getFingerprint(publicKeyPath));
  }

  async tryAuthenticate(privateKeyPath: string, connectionOptions: SshConnectionOptions): Promise<string> {
    return step('SSH: Попытка аутентификации по приватному ключу', () =>
      this.sshService.tryAuthenticate(privateKeyPath, connectionOptions),
    );
  }

  removeComment(publicKeyValue: string) {
    const parts = publicKeyValue.trim().split(SPACE_REGEX);
    return `${parts[0]} ${parts[1]}`;
  }

  retrieveKey(publicKeyValue: string) {
    return publicKeyValue.split(SPACE_REGEX)[1];
  }
}
