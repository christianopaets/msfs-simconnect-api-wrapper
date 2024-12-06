export class DataTypeError extends Error {
  constructor(name: string) {
    super(`SimConnectDataType ${name} does not exist`);
  }
}
