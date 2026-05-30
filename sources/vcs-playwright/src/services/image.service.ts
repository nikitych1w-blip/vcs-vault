import sharp from 'sharp';

import { step } from '@vcs-pw/test';

const RGB_CHANNELS = 3;
const BYTE_RANGE = 2 ** 8;

const MAX_QUALITY = 100;
const MIN_QUALITY = 1;
const QUALITY_STEP = 5;

const PNG_COMPRESSION_LEVELS = Array.from({ length: 10 }, (_, i) => i).reverse();
const PNG_PALETTE_SIZES = Array.from({ length: 6 }, (_, i) => 2 ** (i + 3));
const GIT_PALETTE_SIZES = Array.from({ length: 7 }, (_, i) => 2 ** (i + 2));

const DEFAULT_AVATAR_SIZE = 256;

export interface ResizeConfig {
  maxWidth: number;
  maxHeight: number;
  maxFileSize: number;
  maxOriginSize: number;
  renderedSizeFactor: number;
}

export interface ImageMeta {
  name: string;
  mimeType: string;
  extension: string;
}

export const ImageFormat = {
  PNG: { name: 'png', mimeType: 'image/png', extension: 'png' },
  JPEG: { name: 'jpeg', mimeType: 'image/jpeg', extension: 'jpg' },
  WEBP: { name: 'webp', mimeType: 'image/webp', extension: 'webp' },
  GIF: { name: 'gif', mimeType: 'image/gif', extension: 'gif' },
} as const satisfies Record<string, ImageMeta>;

export type ImageFormatType = (typeof ImageFormat)[keyof typeof ImageFormat]['name'];

interface GenerateImageOptions {
  width?: number;
  height?: number;
  format: ImageMeta;
  maxSize: number;
  exactSize?: boolean; // true — делать padding, false — вернуть как есть
}

export default class ImageService {
  async generate(options: GenerateImageOptions): Promise<Buffer> {
    const maxSize = options.maxSize;
    const { width, height } = this.calculateDimensions(maxSize, options.width, options.height);
    return step(
      `Генерация изображения ${width}x${height} в формате ${options.format.name} размером до ${maxSize} байт`,
      async () => {
        const raw = this.createNoiseImage(width, height);
        const encoded = await this.encodeClosest(raw, width, height, maxSize, options.format.name);

        if (encoded.length > maxSize) {
          throw new Error(`Не удалось ужать изображение до ${maxSize} байт. Получилось ${encoded.length} байт`);
        }

        if (!options.exactSize) return encoded;

        return this.padToSize(encoded, maxSize, options.format);
      },
    );
  }

  // Адаптированная логика из самой gitea: avatar.go#processAvatarImage
  async resize(data: Buffer, config: ResizeConfig): Promise<Buffer> {
    return step('Сжатие изображения', async () => {
      let image = sharp(data);
      const metadata = await image.metadata();

      const { width, height } = metadata;

      if (width > config.maxWidth) {
        throw new Error(`Ширина изображения слишком велика: ${width} > ${config.maxWidth}`);
      }
      if (height > config.maxHeight) {
        throw new Error(`Высота изображения слишком велика: ${height} > ${config.maxHeight}`);
      }

      if (data.length < config.maxOriginSize) {
        return data;
      }

      // Обрезка до квадрата, если нужно
      if (width !== height) {
        const size = Math.min(width, height);
        const left = Math.floor((width - size) / 2);
        const top = Math.floor((height - size) / 2);

        image = image.extract({ width: size, height: size, left, top });
      }

      // Ресайз до целевого размера
      const targetSize = Math.floor(DEFAULT_AVATAR_SIZE * config.renderedSizeFactor);
      image = image.resize(targetSize, targetSize, { kernel: 'linear' });

      // Энкодим в PNG
      let processedBuffer: Buffer;
      try {
        processedBuffer = await image.png().toBuffer();
      } catch {
        // Если не получилось (например, анимированный webp), возвращаем оригинал
        return data;
      }

      // Если после обработки изображение стало больше — возвращаем оригинал
      if (data.length <= processedBuffer.length) {
        return data;
      }

      return processedBuffer;
    });
  }

  private calculateDimensions(size: number, width?: number, height?: number): { width: number; height: number } {
    if (width && !height) {
      height = this.calculateMaxOtherSize(size, width);
    } else if (!width && height) {
      width = this.calculateMaxOtherSize(size, height);
    } else if (!width && !height) {
      width = height = this.calculateMaxOtherSize(size);
    }

    return { width: width!, height: height! };
  }

  private calculateMaxOtherSize(size: number, dimension = 0): number {
    return Math.floor(Math.sqrt((size - dimension * RGB_CHANNELS) / RGB_CHANNELS));
  }

  private createNoiseImage(width: number, height: number): Buffer {
    const buffer = Buffer.alloc(width * height * RGB_CHANNELS);

    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * BYTE_RANGE);
    }

    return buffer;
  }

  private async encodeClosest(
    raw: Buffer,
    width: number,
    height: number,
    targetBytes: number,
    format: string,
  ): Promise<Buffer> {
    switch (format) {
      case 'jpeg':
        return this.encodeJpeg(raw, width, height, targetBytes);
      case 'webp':
        return this.encodeWebp(raw, width, height, targetBytes);
      case 'png':
        return this.encodePng(raw, width, height, targetBytes);
      case 'gif':
        return this.encodeGif(raw, width, height, targetBytes);
      default:
        throw new Error(`Формат ${format} не поддерживается`);
    }
  }

  private baseSharp(raw: Buffer, width: number, height: number) {
    return sharp(raw, {
      raw: {
        width,
        height,
        channels: RGB_CHANNELS,
      },
    });
  }

  private async encodeJpeg(raw: Buffer, width: number, height: number, targetBytes: number): Promise<Buffer> {
    const generator = function* () {
      for (let quality = MAX_QUALITY; quality >= MIN_QUALITY; quality -= QUALITY_STEP) {
        yield { quality };
      }
    };

    return this.findClosestEncoding(targetBytes, generator, (opts) => this.baseSharp(raw, width, height).jpeg(opts));
  }
  private async encodeWebp(raw: Buffer, width: number, height: number, targetBytes: number): Promise<Buffer> {
    const generator = function* () {
      for (let quality = MAX_QUALITY; quality >= MIN_QUALITY; quality -= QUALITY_STEP) {
        yield { quality };
      }
    };

    return this.findClosestEncoding(targetBytes, generator, (opts) => this.baseSharp(raw, width, height).webp(opts));
  }

  private async encodePng(raw: Buffer, width: number, height: number, targetBytes: number): Promise<Buffer> {
    const generator = function* () {
      for (const compressionLevel of PNG_COMPRESSION_LEVELS) {
        for (const colors of PNG_PALETTE_SIZES) {
          yield { compressionLevel, palette: true, colors } as const;
        }
      }
    };

    return this.findClosestEncoding(targetBytes, generator, (opts) => this.baseSharp(raw, width, height).png(opts));
  }

  private async encodeGif(raw: Buffer, width: number, height: number, targetBytes: number): Promise<Buffer> {
    const generator = function* () {
      for (const colors of GIT_PALETTE_SIZES) {
        yield { colors };
      }
    };

    return this.findClosestEncoding(targetBytes, generator, (opts) => this.baseSharp(raw, width, height).gif(opts));
  }

  private async findClosestEncoding<T>(
    targetBytes: number,
    optionsGenerator: () => IterableIterator<T>,
    encoder: (options: T) => sharp.Sharp,
  ): Promise<Buffer> {
    let best: Buffer | null = null;

    for (const options of optionsGenerator()) {
      const buffer = await encoder(options).toBuffer();

      // Точное совпадение — выходим сразу
      if (buffer.length === targetBytes) {
        return buffer;
      }

      best = this.pickBetter(best, buffer, targetBytes);

      // Если ушли ниже цели — дальше только хуже (при порядке от лучшего к худшему)
      if (buffer.length < targetBytes) {
        break;
      }
    }

    return best!;
  }

  private pickBetter(current: Buffer | null, next: Buffer, targetBytes: number): Buffer {
    if (!current) return next;

    const currentDiff = Math.abs(current.length - targetBytes);
    const nextDiff = Math.abs(next.length - targetBytes);

    return nextDiff < currentDiff ? next : current;
  }

  private padToSize(buffer: Buffer, targetBytes: number, format: ImageMeta): Buffer {
    if (buffer.length === targetBytes) {
      return buffer;
    }

    const missing = targetBytes - buffer.length;
    if (missing < 0) {
      throw new Error('buffer уже больше targetBytes');
    }

    const pad = Buffer.alloc(missing);
    const mark = Buffer.from(`PAD_${format.name}`);
    mark.copy(pad, 0, 0, Math.min(mark.length, pad.length));

    return Buffer.concat([buffer, pad]);
  }
}
