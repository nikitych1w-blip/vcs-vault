import { log } from '@vcs-pw/logger';

export default class ItemPool<T> {
  private entries: T[];

  constructor(entries: T[]) {
    this.entries = [...entries];
  }

  get(): T {
    if (this.entries.length === 0) {
      throw new Error(`Нет доступных объектов для выдачи`);
    }

    // Случайный элемент из оставшихся
    const selectedIndex = Math.floor(Math.random() * this.entries.length);
    const selected = this.entries[selectedIndex];

    this.entries.splice(selectedIndex, 1);

    log.debug('Выбран элемент', { entry: selected });
    return selected;
  }
}
