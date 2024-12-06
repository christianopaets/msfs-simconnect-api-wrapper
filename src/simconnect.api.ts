import type { SimconnectApiEvents as Events } from "@api/types";
import { type ConnectionConfig } from "@api/types";
import { DEFAULT_CONFIG, UniqueId } from "@api/utils";
import { open, type RecvEvent, type SimConnectConnection } from "node-simconnect";
import { EventEmitter } from "node:events";
import { SIMCONNECT_EXCEPTION } from "@api/exceptions";
import { ConnectionError } from "@api/errors";

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
}

const sim = new SimconnectApi("New App");
await sim.connect();
sim.on("connected", (connection: SimConnectConnection) => console.log(connection));
