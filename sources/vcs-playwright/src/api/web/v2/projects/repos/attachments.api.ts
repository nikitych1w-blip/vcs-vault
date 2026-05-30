import { ReactWebApi, RequestClientOptions } from '@vcs-pw/api/client';
import { MultiFileUploadResponseZodType } from '@vcs-pw/api/generated/types/web/bundle/zod.gen';
import { step } from '@vcs-pw/test';
import { RepoOptions } from '@vcs-pw/api/web';

const FILES_FIELD_NAME = 'files';

interface UploadFileRequest {
  fileName: string;
  content: Buffer<ArrayBufferLike>;
}

export class ReposAttachmentsReactWebApi extends ReactWebApi {
  constructor(options: RequestClientOptions) {
    super({
      ...options,
      path: 'web/v2',
    });
  }

  uploadAttachments(
    { projectName, repoName }: RepoOptions,
    request: UploadFileRequest[],
  ): Promise<MultiFileUploadResponseZodType> {
    return step(`Загрузка вложений для репозитория ${repoName}`, async () => {
      const formData = new FormData();
      for (const file of request) {
        const buffer = Buffer.from(file.content);
        formData.append(FILES_FIELD_NAME, new Blob([buffer]), file.fileName);
      }

      const response = await this.post(`repos/${projectName}/${repoName}/attachments`, {
        multipart: formData,
        failOnStatusCode: true,
      });
      return response.json();
    });
  }
}
