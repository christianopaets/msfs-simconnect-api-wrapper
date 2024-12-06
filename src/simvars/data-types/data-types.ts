import { dataTypeCreate } from "./data-type-create.js";

export const Int32 = dataTypeCreate(`Int32`);
export const SInt32 = dataTypeCreate(`Int32`, true);

export const Float64 = dataTypeCreate(`Float64`);
export const SFloat64 = dataTypeCreate(`Float64`, true);

export const String32 = dataTypeCreate(`String32`);
export const SString32 = dataTypeCreate(`String32`, true);
export const String128 = dataTypeCreate(`String128`);
export const String256 = dataTypeCreate(`String256`);
export const StringV = dataTypeCreate(`StringV`);
