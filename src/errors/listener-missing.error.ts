export class ListenerMissingError extends Error {
  constructor(eventName: string | number) {
    super(`No handler listener found for event ${eventName}`);
  }
}
