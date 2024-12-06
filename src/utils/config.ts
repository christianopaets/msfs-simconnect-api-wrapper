import { type ConnectionConfig } from "@api/types";
import { Protocol } from "node-simconnect";

export const DEFAULT_CONFIG: ConnectionConfig = {
  autoReconnect: false,
  retries: 0,
  retryInterval: 2,
  protocol: Protocol.KittyHawk,
} as const;
