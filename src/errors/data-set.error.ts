export class DataSetError extends Error {
  constructor(name: string) {
    super(`SimVar "${name}" is not settable`);
  }
}
