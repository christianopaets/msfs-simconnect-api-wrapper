import type { Unit } from "./unit.type.js";
import type { DataType } from "../simvars/data-types/index.js";

export type Definition = { description: string } & Unit & DataType;
