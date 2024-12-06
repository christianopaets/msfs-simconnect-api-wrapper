import { type SimConnectConnection } from "node-simconnect";
import { type SIMCONNECT_EXCEPTION } from "@api/exceptions";

export type SimconnectApiEvents = {
  connected: (connection: SimConnectConnection) => void;
  exception: (exception: (typeof SIMCONNECT_EXCEPTION)[number]) => void;
  error: (error: unknown) => void;
  retry: (retries: number, interval: number) => void;
};
