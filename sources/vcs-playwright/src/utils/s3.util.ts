import * as crypto from 'crypto';

export const AvatarType = {
  REPO: 'repo',
  USER: 'user',
} as const;

export function avatarKey(
  uniqueID: bigint | number,
  uniqueType: (typeof AvatarType)[keyof typeof AvatarType],
  data: Uint8Array | Buffer,
): string {
  const hash = crypto.createHash('sha256');
  hash.update(uniqueID.toString());
  hash.update('-');
  hash.update(uniqueType);
  hash.update('-');
  hash.update(data);
  return hash.digest('hex');
}

// attachments/temp-upload
export function uploadKey(uuid: string): string {
  return `${uuid[0]}/${uuid[1]}/${uuid}`;
}

export function archiveKey(repoId: number | string, commitSha: string, extension: string): string {
  const shard = commitSha.substring(0, 2);
  return `${repoId}/${shard}/${commitSha}.${extension}`;
}
