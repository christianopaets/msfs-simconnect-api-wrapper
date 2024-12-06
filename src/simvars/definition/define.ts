import type { Definition, Unit } from "@api/types";
import type { DataType } from "../data-types/index.js";

export function define(description: string, unit: Unit, type: DataType): Definition {
  return { description, ...unit, ...type };
}
