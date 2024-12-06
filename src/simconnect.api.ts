import type { Definition, SimconnectApiEvents as Events } from "@api/types";
import { type ConnectionConfig } from "@api/types";
import { codeSafe, CodeSafe, DEFAULT_CONFIG, UniqueId } from "@api/utils";
import {
  open,
  Protocol,
  type RecvEvent,
  type SimConnectConnection,
  SimConnectConstants,
  SimConnectPeriod,
  SimConnectRecvEvents,
} from "node-simconnect";
import { EventEmitter } from "node:events";
import { SIMCONNECT_EXCEPTION } from "@api/exceptions";
import { ConnectionError } from "@api/errors";
import { SimVarKey, SimVars } from "@api/simvars";

export class SimconnectApi extends EventEmitter {
  private readonly config: ConnectionConfig;
  private readonly uniqueId = new UniqueId();
  private connection: SimConnectConnection | undefined;

  constructor(
    private readonly name: string,
    config: Partial<ConnectionConfig> = {},
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public override on<U extends keyof Events>(event: U, listener: Events[U]): this {
    return super.on(event, listener);
  }

  public override once<U extends keyof Events>(event: U, listener: Events[U]): this {
    return super.once(event, listener);
  }

  public override off<U extends keyof Events>(event: U, listener: Events[U]): this {
    return super.off(event, listener);
  }

  public override removeAllListeners<U extends keyof Events>(event: U): this {
    return super.removeAllListeners(event);
  }

  public override removeListener = this.off;

  public override addListener = this.on;

  public override emit<U extends keyof Events>(event: U, ...args: Parameters<Events[U]>): boolean {
    return super.emit(event, ...args);
  }

  public async connect(): Promise<void> {
    try {
      const { handle } = await open(this.name, this.config.protocol, this.config.connectionOptions);
      this.connection = handle;
      this.connection.on("exception", ({ exception }) => {
        if (!SIMCONNECT_EXCEPTION[exception]) {
          return;
        }
        this.emit("exception", SIMCONNECT_EXCEPTION[exception]);
      });
      this.emit("connected", this.connection);
      this.connection.on("event", (event) => this.handleSystemEvent(event));
      this.connection.on("close", () => {
        if (!this.config.autoReconnect) {
          return;
        }
        this.connect();
      });
      // this.specialGetHandlers = [await getAirportHandler(this, handle)];
    } catch (err) {
      this.emit("error", err);
      if (!this.config.retries) {
        const error = new ConnectionError();
        this.emit("error", error);
        throw error;
      }
      this.config.retries--;
      this.emit("retry", this.config.retries, this.config.retryInterval);
      setTimeout(() => this.connect(), 1000 * this.config.retryInterval);
    }
  }

  private handleSystemEvent(event: RecvEvent): void {
    console.log(event);
    console.log(this.uniqueId);
  }

  public get(...propNames: SimVarKey[]): Promise<unknown> {
    if (!this.connection) {
      throw new ConnectionError();
    }
    const DATA_ID = this.uniqueId.next();
    const REQUEST_ID = DATA_ID;

    const defs = propNames.map((propName) => SimVars[propName]);
    this.addDataDefinitions(DATA_ID, propNames, defs);
    return this.generateGetPromise(DATA_ID, REQUEST_ID, propNames, defs);
  }

  periodic(handler: (result: unknown) => void, period = SimConnectPeriod.SIM_FRAME, ...propNames: SimVarKey[]) {
    if (!this.connection) {
      throw new ConnectionError();
    }

    const DATA_ID = this.uniqueId.next();
    const REQUEST_ID = DATA_ID;

    const defs = propNames.map((propName) => SimVars[propName]);
    this.addDataDefinitions(DATA_ID, propNames, defs);
    console.log(DATA_ID, REQUEST_ID, propNames, defs);
    const handleDataRequest: SimConnectRecvEvents["simObjectData"] = ({ requestID, data }) => {
      console.log(requestID, DATA_ID, REQUEST_ID, propNames, defs);
      if (requestID === REQUEST_ID) {
        const result: Partial<Record<CodeSafe<SimVarKey>, unknown>> = {};
        propNames.forEach((propName, pos) => {
          result[codeSafe(propName)] = defs?.[pos]?.read(data);
        });
        handler(result);
      }
    };

    this.connection?.on("simObjectData", handleDataRequest);
    const role = SimConnectConstants.OBJECT_ID_USER;
    this.connection?.requestDataOnSimObject(REQUEST_ID, DATA_ID, role, period);

    return () => {
      const never = SimConnectPeriod.NEVER;
      this.connection?.requestDataOnSimObject(REQUEST_ID, DATA_ID, role, never);
      this.connection?.clearDataDefinition(DATA_ID);
      this.uniqueId.release(DATA_ID);
    };
  }

  private addDataDefinitions(id: number, propNames: SimVarKey[], defs: Definition[]) {
    if (!this.connection) {
      throw new ConnectionError();
    }
    propNames.forEach((propName, pos) => {
      const def = defs[pos];
      if (def === undefined) {
        this.connection?.clearDataDefinition(id);
        this.uniqueId.release(id);
        throw new Error(`Cannot get SimVar: "${propName}" unknown.`);
      }
      this.connection?.addToDataDefinition(id, propName, def.units, def.data_type, 0.0, SimConnectConstants.UNUSED);
    });
  }

  private generateGetPromise(
    id: number,
    REQUEST_ID: number,
    propNames: SimVarKey[],
    defs: Definition[],
    period = SimConnectPeriod.ONCE,
  ): Promise<unknown> {
    if (!this.connection) {
      throw new ConnectionError();
    }
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new ConnectionError());
        return;
      }
      const handleDataRequest: SimConnectRecvEvents["simObjectData"] = ({ requestID, data }) => {
        if (!this.connection) {
          throw new ConnectionError();
        }
        if (requestID !== REQUEST_ID) {
          return;
        }
        this.connection.off("simObjectData", handleDataRequest);
        this.connection.clearDataDefinition(id);
        const result: Partial<Record<CodeSafe<SimVarKey>, unknown>> = {};
        propNames.forEach((propName, pos) => {
          console.log(propName, pos, data, defs);
          result[codeSafe(propName)] = defs?.[pos]?.read(data);
        });
        resolve(result);
        this.uniqueId.release(id);
      };
      this.connection.on("simObjectData", handleDataRequest);
      this.connection.requestDataOnSimObject(REQUEST_ID, id, SimConnectConstants.OBJECT_ID_USER, period);
    });
  }
}

const sim = new SimconnectApi("New App", {
  autoReconnect: true,
  protocol: Protocol.FSX_SP2,
  retries: Infinity,
  retryInterval: 5,
});

sim.on("connected", (connection: SimConnectConnection) => console.log(connection));
sim.on("error", (error) =>
  error instanceof Error ? console.warn(`Error occured: ${error.message}`) : console.warn(`Error occured: ${error}`),
);
await sim.connect();
sim.periodic((res) => console.log(res), SimConnectPeriod.SIM_FRAME, "AUTOPILOT ALTITUDE LOCK VAR");

// function a(...values: string[]): Record<string, string> {
//   const result: Record<string, string> = {};
//   for (const value of values) {
//     result[value] = value;
//   }
//   return result;
// }
//
// const b = a("a", "b", "c");
