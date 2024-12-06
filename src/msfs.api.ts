import { open, Protocol, RecvEvent, SimConnectConnection, SimConnectPeriod } from "node-simconnect";
// imports used by the API
import { SIMCONNECT_EXCEPTION } from "./exceptions/exceptions";

// Special import for working with airport data
import { ConnectionConfig, EventHandler, EventListeners } from "./types";
import { ConnectionError } from "./errors";
import { ListenerMissingError } from "./errors/listener-missing.error";
import { SystemEvents } from "./system-events/index.js";

export { SimConnectPeriod };

// export the airport db function, so other code can work with it directly.
// export { loadAirportDB } from "./special/airports";

// export const SystemEvents = Object.assign({}, SysEvents, AirportEvents);
export const MSFS_NOT_CONNECTED = `Not connected to MSFS`;
type CodeSafe<T extends string> = T extends `${infer P} ${infer R}` ? `${P}_${CodeSafe<R>}` : T;
type Result<T extends string, A extends T[] = T[]> = {
  [key in CodeSafe<A[number]>]?: unknown;
};
const codeSafe = <T extends string>(value: T): CodeSafe<T> => value.replaceAll(` `, `_`) as CodeSafe<T>;

const defaultConfig: ConnectionConfig = {
  autoReconnect: false,
  retries: 0,
  retryInterval: 2,
  onConnect: () => {},
  onRetry: () => {},
  onException: () => {},
  onError: () => {},
  protocol: Protocol.KittyHawk,
} as const;

export class MsfsApi {
  private readonly config: ConnectionConfig;
  // set up an event/data/request id counter:
  private id = 1;
  private readonly reserved = new Set<number>();

  private connection: SimConnectConnection | undefined;
  private specialGetHandlers: any;
  private readonly eventListeners: EventListeners = {};

  constructor(
    private readonly name: string,
    config: Partial<ConnectionConfig> = {},
  ) {
    this.config = { ...defaultConfig, ...config };
  }

  async connect(): Promise<void> {
    try {
      const { handle } = await open(this.name, this.config.protocol, this.config.connectionOptions);
      if (!handle) {
        throw new Error(`No connection handle to MSFS`);
      }
      this.connection = handle;
      handle.on("event", (event) => this.handleSystemEvent(event));
      handle.on("close", () => this.config.autoReconnect && this.connect());
      handle.on("exception", ({ exception }) => this.config.onException(SIMCONNECT_EXCEPTION[exception]));
      // this.specialGetHandlers = [await getAirportHandler(this, handle)];
      this.config.onConnect(handle);
    } catch (err) {
      this.config.onError(err);
      if (this.config.retries) {
        this.config.retries--;
        this.config.onRetry(this.config.retries, this.config.retryInterval);
        setTimeout(() => this.connect(), 1000 * this.config.retryInterval);
      } else {
        throw new Error(`No connection to MSFS`);
      }
    }
  }

  nextId(): number {
    if (this.id > 900) {
      this.id = 0;
    }
    let id = this.id++;
    while (this.reserved.has(id)) {
      id = this.id++;
    }
    this.reserved.add(id);
    return id;
  }

  private releaseId(id: number): void {
    this.reserved.delete(id);
  }

  addEventListener(eventName: string, eventHandler: EventHandler): void {
    if (!this.connection) {
      throw new ConnectionError();
    }
    if (eventName in this.eventListeners) {
      this.eventListeners[eventName].handlers.push(eventHandler);
      const { data } = this.eventListeners[eventName];
      if (data) {
        eventHandler(data);
      }
      return;
    }
    const eventID = this.nextId();
    this.connection.subscribeToSystemEvent(eventID, eventName);
    this.eventListeners[eventName] = { eventID, eventName, data: undefined, handlers: [eventHandler] };
    this.eventListeners[eventID] = this.eventListeners[eventName];
  }

  removeEventListener(eventName: string, eventHandler: EventHandler): void {
    if (!this.connection) {
      throw new ConnectionError();
    }
    const listener = this.eventListeners[eventName];
    const pos = listener.handlers.findIndex((handler) => handler === eventHandler);
    if (pos < 0) {
      throw new ListenerMissingError(eventName);
    }
    listener.handlers.splice(pos, 1);
  }

  handleSystemEvent({ clientEventId: eventID, data }: RecvEvent): void {
    if (!this.connection) {
      throw new ConnectionError();
    }
    if (!(eventID in this.eventListeners)) {
      throw new ListenerMissingError(eventID);
    }
    this.eventListeners[eventID].data = data;
    this.eventListeners[eventID].handlers.forEach((handle) => handle(data));
  }

  on(eventDefinition: (typeof SystemEvents)[keyof typeof SystemEvents], eventHandler: EventHandler): () => void {
    if (!this.connection) {
      throw new ConnectionError();
    }
    const { name: eventName } = eventDefinition;
    this.addEventListener(eventName, eventHandler);
    return () => this.off(eventName, eventHandler);
  }

  off(eventName: string, eventHandler: EventHandler): void {
    this.removeEventListener(eventName, eventHandler);
  }

  trigger(name: string, value = 0): void {
    if (!this.connection) {
      throw new ConnectionError();
    }
    const eventID = this.nextId();
    this.connection.mapClientEventToSimEvent(eventID, name);
    try {
      this.connection.transmitClientEvent(
        SimConnectConstants.OBJECT_ID_USER,
        eventID,
        value,
        1, // highest priority
        16, // group id is priority
      );
    } catch (e) {
      console.warn(e);
    }
  }

  /**
   *
   * @param {*} DATA_ID
   * @param {*} propNames
   * @param {*} defs
   */
  addDataDefinitions(DATA_ID, propNames, defs) {
    const { connection } = this;
    propNames.forEach((propName, pos) => {
      const def = defs[pos];
      if (def === undefined) {
        connection.clearDataDefinition(DATA_ID);
        this.releaseId(DATA_ID);
        throw new Error(`Cannot get SimVar: "${propName}" unknown.`);
      }
      connection.addToDataDefinition(DATA_ID, propName, def.units, def.data_type, 0.0, SimConnectConstants.UNUSED);
    });
  }

  /**
   *
   * @param {*} DATA_ID
   * @param {*} REQUEST_ID
   * @param {*} propNames
   * @param {*} defs
   * @param period
   * @returns
   */
  generateGetPromise<T extends keyof typeof SimVars>(
    DATA_ID: number,
    REQUEST_ID: number,
    propNames: T[],
    defs: (typeof SimVars)[T][],
    period = SimConnectPeriod.ONCE,
  ): Promise<Result<keyof typeof SimVars>> {
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
        this.connection.clearDataDefinition(DATA_ID);
        const result: Result<T> = {};
        propNames.forEach((propName, pos) => {
          result[codeSafe(propName)] = defs[pos].read(data);
        });
        resolve(result);
        this.releaseId(DATA_ID);
      };
      this.connection.on("simObjectData", handleDataRequest);
      this.connection.requestDataOnSimObject(
        REQUEST_ID,
        DATA_ID,
        SimConnectConstants.OBJECT_ID_USER,
        period,
        ...[0, 0, 0, 0],
      );
    });
  }

  /**
   * Get one or more simconnect variable values.
   *
   * @param  {...any} propNames
   * @returns
   */
  get(...propNames: (keyof typeof SimVars)[]): Promise<Result<keyof typeof SimVars>> {
    if (!this.connection) {
      throw new ConnectionError();
    }
    const DATA_ID = this.nextId();
    const REQUEST_ID = DATA_ID;

    if (propNames.length === 1) {
      const [propName] = propNames;
      for (const get of this.specialGetHandlers) {
        if (get.supports(propName)) {
          return get(propName);
        }
      }
    }
    // if not, regular lookup.
    const defs = propNames.map((propName) => SimVars[propName]);
    this.addDataDefinitions(DATA_ID, propNames, defs);
    return this.generateGetPromise(DATA_ID, REQUEST_ID, propNames, defs);
  }

  /**
   * Set a simconnect variable.
   *
   * @param  {...any} propNames
   * @returns
   * @throws
   */
  set(propName, value) {
    if (!this.connected) throw new Error(MSFS_NOT_CONNECTED);
    propName = propName.replaceAll(`_`, ` `);
    if (value == parseFloat(value)) {
      // Extremely intentionally use coercion to see if we're dealing with a number-as-string
      value = parseFloat(value);
    }
    const DATA_ID = this.nextId();
    const def = SimVars[propName];
    if (def === undefined) {
      this.releaseId(DATA_ID);
      throw new Error(`Cannot set SimVar: "${propName}" unknown.`);
    }
    const bufferLength = 100; // TODO: we probably want to allocate only as much buffer as we actually need
    const buffer = def.write(new RawBuffer(bufferLength), value);
    const payload = { buffer, arrayCount: 0, tagged: false };
    this.connection?.addToDataDefinition(DATA_ID, propName, def.units, def.data_type);
    this.connection?.setDataOnSimObject(DATA_ID, SimConnectConstants.OBJECT_ID_USER, payload);
    // cleanup, with *plenty* of time for SimConnect to resolve the data object before clearing it out.
    setTimeout(() => {
      this.releaseId(DATA_ID);
      this.connection?.clearDataDefinition(DATA_ID);
    }, 500);
  }

  /**
   *
   * @param {*} handler
   * @param {*} interval
   * @param  {...any} propNames
   */
  schedule(handler, interval, ...propNames) {
    if (!this.connected) throw new Error(MSFS_NOT_CONNECTED);
    let running = true;
    const run = async () => {
      handler(await this.get(...propNames));
      if (running) setTimeout(run, interval);
    };
    run();
    return () => (running = false);
  }

  /**
   * similar to schedule, but using https://docs.flightsimulator.com/html/Programming_Tools/SimConnect/API_Reference/Structures_And_Enumerations/SIMCONNECT_PERIOD.htm
   */
  periodic<T extends string, A extends T[]>(
    handler: (result: Result<T, A>) => void,
    period = SimConnectPeriod.SIM_FRAME,
    ...propNames: A
  ) {
    if (!this.connected) throw new Error(MSFS_NOT_CONNECTED);

    // Stolen from `get`, DRY this out later.
    const DATA_ID = this.nextId();
    const REQUEST_ID = DATA_ID;
    const mappedPropNames = propNames.map((s) => s.replaceAll(`_`, ` `));

    const defs = mappedPropNames.map((propName) => SimVars[propName]);
    this.addDataDefinitions(DATA_ID, mappedPropNames, defs);

    const { connection } = this;

    const handleDataRequest: SimConnectRecvEvents["simObjectData"] = ({ requestID, data }) => {
      if (requestID === REQUEST_ID) {
        const result: Result<T, A> = {};
        propNames.forEach((propName, pos) => {
          result[codeSafe(propName)] = defs[pos].read(data);
        });
        handler(result);
      }
    };

    connection?.on("simObjectData", handleDataRequest);
    const role = SimConnectConstants.OBJECT_ID_USER;
    connection?.requestDataOnSimObject(REQUEST_ID, DATA_ID, role, period);

    return () => {
      const never = SimConnectPeriod.NEVER;
      connection?.requestDataOnSimObject(REQUEST_ID, DATA_ID, role, never);
      connection?.clearDataDefinition(DATA_ID);
      this.releaseId(DATA_ID);
    };
  }
}

const api = new MsfsApi("My Application", {});
api.connect().then();
// api.get("ACCELERATION BODY X").then((result) => {
//   console.log(result.ACCELERATION_BODY_X);
// });
