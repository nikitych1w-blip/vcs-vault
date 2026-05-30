import { config } from '@vcs-pw/config';
import { step } from '@vcs-pw/test';
import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';
import UploadPreview from '@vcs-pw/ui/components/repo/upload-preview.component';

const BOX_OFFSET = 10;
const UPLOAD_FILE_PATH = '/upload-file';
const UPLOAD_ATTACHMENT_PATH = '/issues/attachments';

export default class UploadDropzone extends Element {
  readonly uploadPreview: UploadPreview;
  readonly message: Element;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Область загрузки файла',
        locator: base.locator('.dropzone[data-upload-url]'),
      });
    } else {
      super(base);
    }

    this.uploadPreview = new UploadPreview(this.raw);
    this.message = this.child('Сообщение', '.dz-message');
  }

  async chooseFiles(files: string[]) {
    await step(`Загрузка ${files.length} файлов(-а)`, async () => {
      // Выбираем точку в правом верхнем углу: BOX_OFFSETpx от правого края, BOX_OFFSETpx от верха
      // Кликаем не по центру, потому что добавленные файлы могут его перекрывать => клик не срабатывает
      const box = await this.boundingBox();
      const clickPosition = box
        ? {
            x: box!.width - BOX_OFFSET,
            y: BOX_OFFSET,
          }
        : undefined;

      const [fileChooser] = await Promise.all([
        this.raw.page().waitForEvent('filechooser'),
        this.click({ position: clickPosition }),
      ]);

      await fileChooser.setFiles(files);
    });
  }

  async waitForUpload(file: string) {
    return step('Ожидание загрузки файла', async () => {
      const responsePromise = this.raw
        .page()
        .waitForResponse(
          (resp) =>
            (resp.url().includes(UPLOAD_FILE_PATH) || resp.url().includes(UPLOAD_ATTACHMENT_PATH)) &&
            resp.status() === 200 &&
            resp.request().method() === 'POST',
          { timeout: config.ui.responseTimeout },
        );
      await this.chooseFiles([file]);

      const response = await responsePromise;
      const responseJson = await response.json();
      return responseJson.uuid;
    });
  }
}
