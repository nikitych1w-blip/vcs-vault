import { FrameLocator, Locator, Page } from '@playwright/test';

export type ParentType = Page | Locator | FrameLocator;

export function isParentType(obj: any): obj is ParentType {
  return (
    (obj && typeof obj.locator === 'function') ||
    (obj && typeof obj.getByRole === 'function') ||
    (obj && typeof obj.getByTestId === 'function')
  );
}

export interface TimeoutOptions {
  timeout?: number | undefined;
}

export enum Endpoint {
  REPOSITORY_CODE_DEFAULT_BRANCH = "Репозиторий. Вкладка 'Код'. Ветка по умолчанию",
  REPOSITORY_CODE_BRANCH = "Репозиторий. Вкладка 'Код'. Ветка",
  REPOSITORY_CODE_BRANCHES = "Репозиторий. Вкладка 'Код'. Ветки текущего репозитория",
  REPOSITORY_CODE_TAG = "Репозиторий. Вкладка 'Код'. Тег",
  REPOSITORY_CODE_BRANCH_FILE = "Репозиторий. Вкладка 'Код'. Ветка. Файл",
  REPOSITORY_CODE_BRANCH_COMMITS = "Репозиторий. Вкладка 'Код'. Коммиты ветки",
  REPOSITORY_PULL_REQUESTS = "Репозиторий. Вкладка 'Запросы на слияние'",
  REPOSITORY_PULL_REQUEST = "Репозиторий. Вкладка 'Запросы на слияние'. Запрос",
  REPOSITORY_PULL_REQUEST_CHANGED_FILES = "Репозиторий. Вкладка 'Запросы на слияние'. Запрос. Изменённые файлы",
  REPOSITORY_ACTIVITY = "Репозиторий. Вкладка 'Активность'",
  REPOSITORY_SETTINGS = 'Репозиторий. Настройки',
  REPOSITORY_SETTINGS_BRANCH_PROTECTION = 'Репозиторий. Настройки. Защита веток',
  REPOSITORY_SETTINGS_SONARQUBE = 'Репозиторий. Настройки. SonarQube',
  REPOSITORY_SETTINGS_REVIEW = 'Репозиторий. Настройки. Ревью',
  REPOSITORY_SETTINGS_REVIEW_CREATE = 'Репозиторий. Настройки. Ревью. Добавление новой настройки',
  REPOSITORY_SETTINGS_REVIEW_EDIT = 'Репозиторий. Настройки. Редактирование настройки ревью',
  REPOSITORY_SETTINGS_WEBHOOK_SOURCECONTROL = 'Репозиторий. Настройки. Создание веб-хука с типом SourceControl',
  REPOSITORY_UPLOAD_FILE = 'Репозиторий. Загрузить файл',
  PROJECT_NEW_REPOSITORY = 'Проект. Новый репозиторий',
  PROJECT_PROFILE = 'Проект. Профиль',
  PROJECT_PULL_REQUESTS_USER = "Проект. Вкладка 'Все запросы на слияние пользователя'",
  USER_PROFILE = 'Пользователь. Профиль',
  USER_SETTING = 'Пользователь. Настройки',
  EXPLORE_REPOSITORIES = 'Обзор. Репозитории',
}

export const EndpointTemplates: Record<Endpoint, string> = {
  [Endpoint.REPOSITORY_CODE_DEFAULT_BRANCH]: '{project}/{repo}',
  [Endpoint.REPOSITORY_CODE_BRANCH]: '{project}/{repo}/src/branch/{branch}',
  [Endpoint.REPOSITORY_CODE_BRANCHES]: '{project}/{repo}/branches',
  [Endpoint.REPOSITORY_CODE_TAG]: '{project}/{repo}/src/tag/{tag}',
  [Endpoint.REPOSITORY_CODE_BRANCH_FILE]: '{project}/{repo}/src/branch/{branch}/{path}',
  [Endpoint.REPOSITORY_CODE_BRANCH_COMMITS]: '{project}/{repo}/commits/branch/{branch}',
  [Endpoint.REPOSITORY_PULL_REQUESTS]: '{project}/{repo}/pulls',
  [Endpoint.REPOSITORY_PULL_REQUEST]: '{project}/{repo}/pulls/{index}',
  [Endpoint.REPOSITORY_PULL_REQUEST_CHANGED_FILES]: '{project}/{repo}/pulls/{index}/files',
  [Endpoint.REPOSITORY_ACTIVITY]: '{project}/{repo}/activity',
  [Endpoint.REPOSITORY_SETTINGS]: '{project}/{repo}/settings',
  [Endpoint.REPOSITORY_SETTINGS_BRANCH_PROTECTION]: '{project}/{repo}/settings/branches',
  [Endpoint.REPOSITORY_SETTINGS_SONARQUBE]: '{project}/{repo}/settings/sonar',
  [Endpoint.REPOSITORY_SETTINGS_REVIEW]: '{project}/{repo}/settings/review_settings',
  [Endpoint.REPOSITORY_SETTINGS_REVIEW_CREATE]: '{project}/{repo}/settings/review_settings/create',
  [Endpoint.REPOSITORY_SETTINGS_REVIEW_EDIT]:
    '{project}/{repo}/settings/review_settings/edit?setting_name={settingName}',
  [Endpoint.REPOSITORY_SETTINGS_WEBHOOK_SOURCECONTROL]: '{project}/{repo}/settings/hooks/sourcecontrol/new',
  [Endpoint.REPOSITORY_UPLOAD_FILE]: '{project}/{repo}/_upload/{branch}',
  [Endpoint.PROJECT_NEW_REPOSITORY]: 'repo/create?org={projectId}',
  [Endpoint.PROJECT_PROFILE]: '{project}',
  [Endpoint.USER_PROFILE]: '{user}',
  [Endpoint.USER_SETTING]: 'user/settings',
  [Endpoint.EXPLORE_REPOSITORIES]: 'explore/repos',
  [Endpoint.PROJECT_PULL_REQUESTS_USER]: 'pulls',
} as const;
