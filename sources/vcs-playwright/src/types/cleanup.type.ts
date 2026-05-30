type CleanupFunc = () => Promise<any> | any;

export default class CleanupStack {
  private stack: CleanupFunc[] = [];

  push(func: CleanupFunc) {
    this.stack.push(func);
  }

  pop(): CleanupFunc | undefined {
    return this.stack.pop();
  }

  length(): number {
    return this.stack.length;
  }
}
