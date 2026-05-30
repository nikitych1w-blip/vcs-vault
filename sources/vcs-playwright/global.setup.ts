import { rm } from 'fs/promises';

const ALLURE_RESULTS_DIR = 'allure-results';

export default async function globalSetup() {
  try {
    await rm(ALLURE_RESULTS_DIR, { recursive: true, force: true });
    console.log('Директория успешно удалена: ' + ALLURE_RESULTS_DIR);
  } catch (_) {}
}
