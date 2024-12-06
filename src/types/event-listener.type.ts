export type EventHandler<D = unknown> = (data: D) => void;

export type EventListener<D = unknown> = {
  eventID: number;
  eventName: string;
  data: D;
  handlers: EventHandler<D>[];
};

export type EventListeners = Record<string | number, EventListener>;
