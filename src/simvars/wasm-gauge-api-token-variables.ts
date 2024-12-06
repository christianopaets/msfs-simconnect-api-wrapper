import { define } from "./definition/define.js";
import { Radians } from "./units/index.js";
import { Float64 } from "./data-types/index.js";

export const WASMGaugeAPITokenVariables = {
  "TRAILING EDGE FLAPS0 LEFT ANGLE": define(`TESTING`, Radians, Float64),
  "TRAILING EDGE FLAPS0 RIGHT ANGLE": define(`TESTING`, Radians, Float64),
} as const;
