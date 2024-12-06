import { type ConnectionOptions, type Protocol } from "node-simconnect";

export type ConnectionConfig = {
  autoReconnect: boolean;
  retries: number;
  retryInterval: number;
  protocol: Protocol;
  connectionOptions?: ConnectionOptions;
};
