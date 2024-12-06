import { AircraftAutopilotAssistantVariables } from "./aircraft-autopilot-assistant-variables.js";
import { AircraftBakeLandingGearVariables } from "./aircraft-brake-landing-gear-variables.js";
import { AircraftControlVariables } from "./aircraft-control-variables.js";
import { AircraftElectricsVariables } from "./aircraft-electrics-variables.js";
import { AircraftEngineVariables } from "./aircraft-engine-variables.js";
import { AircraftFlightModelVariables } from "./aircraft-flight-model-variables.js";
import { AircraftFuelVariables } from "./aircraft-fuel-variables.js";
import { AircraftMiscVariables } from "./aircraft-misc-variables.js";
import { AircraftRadioNavigationVariables } from "./aircraft-radio-navigation-variables.js";
import { AircraftSystemVariables } from "./aircraft-system-variables.js";
import { CameraVariables } from "./camera-variables.js";
import { MiscellaneousVariables } from "./miscellaneous-variables.js";
import { HelicopterVariables } from "./helicopter-variables.js";
import { ServiceVariables } from "./services-variables.js";
import { WASMGaugeAPITokenVariables } from "./wasm-gauge-api-token-variables.js";
import { EnvironmentVariables } from "./environment-variables.js";

export const SimVars = {
  ...AircraftAutopilotAssistantVariables,
  ...AircraftBakeLandingGearVariables,
  ...AircraftControlVariables,
  ...AircraftElectricsVariables,
  ...AircraftEngineVariables,
  ...AircraftFlightModelVariables,
  ...AircraftFuelVariables,
  ...AircraftMiscVariables,
  ...AircraftRadioNavigationVariables,
  ...AircraftSystemVariables,
  ...CameraVariables,
  ...MiscellaneousVariables,
  ...HelicopterVariables,
  ...ServiceVariables,
  ...WASMGaugeAPITokenVariables,
  ...EnvironmentVariables,
} as const;

export * from "./units/index.js";
export * from "./data-types/index.js";
