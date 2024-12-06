export class ConnectionError extends Error {
  constructor() {
    super("MSFS: Connection is not established");
  }
}
