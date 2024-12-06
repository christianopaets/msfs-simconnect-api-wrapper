import { RawBuffer, SimConnectDataType } from "node-simconnect";
import { DataSetError, DataTypeError } from "@api/errors";

type CaseInsensitive<T extends string> = T | `${string & {}}`;
type DataTypeName = CaseInsensitive<keyof typeof SimConnectDataType>;

function getSimConnectDataType<T extends DataTypeName>(name: T): SimConnectDataType {
  const key = name.toUpperCase() as keyof typeof SimConnectDataType;
  if (!(key in SimConnectDataType)) {
    throw new DataTypeError(name);
  }
  return SimConnectDataType[key];
}

function booleanCoercion(value: boolean): number;
function booleanCoercion<T>(value: T): T;
function booleanCoercion<T>(value: T): number | T {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  return value;
}

export const dataTypeCreate = <T extends DataTypeName>(name: T, settable = false) => {
  return {
    data_type: getSimConnectDataType(name),
    read: (data: RawBuffer) => data[`read${name}` as unknown as "readInt32"](),
    write: settable
      ? (buffer: Record<`write${typeof name}`, (value: unknown) => void>, value: unknown) => {
          value = booleanCoercion(value);
          buffer[`write${name}`](value);
          return buffer;
        }
      : () => {
          throw new DataSetError(name);
        },
    settable,
  };
};

export type DataType = ReturnType<typeof dataTypeCreate>;
