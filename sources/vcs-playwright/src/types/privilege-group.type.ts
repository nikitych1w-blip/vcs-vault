export const PrivilegeGroup = {
  NONE: null,
  OWNER: 'owner',
  MANAGER: 'manager',
  WRITER: 'writer',
  READER: 'reader',
  // Динамические группы привилегий
  READ_CREATE: 'readcreate',
  READ_MERGE: 'readmerge',
  READ_APPROVE: 'readapprove',
} as const;
