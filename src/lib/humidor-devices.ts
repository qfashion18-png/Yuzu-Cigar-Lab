export type HumidorDeviceType = "HYGROMETER_THERMOMETER" | "HUMIDIFIER";
export type HumidorDeviceConnection = "Bluetooth" | "WiFi";
export type HumidorDeviceStatus = "Connected" | "Ready to sync";

export type HumidorDeviceInput = {
  name: string;
  location: string;
  deviceType?: HumidorDeviceType;
  connection: HumidorDeviceConnection;
  identifier: string;
  humidity: string;
  temperature: string;
  syncInterval: string;
};

export type HumidorSensorDevice = {
  id: string;
  name: string;
  location: string;
  deviceType: HumidorDeviceType;
  connection: HumidorDeviceConnection;
  identifier: string;
  humidity: number;
  temperature: number;
  syncIntervalMinutes: number;
  status: HumidorDeviceStatus;
  lastSyncedAt: string;
};

export type HumidorDeviceReading = {
  id: string;
  location: string;
  humidity: number;
  temperature: number;
  source: "Device";
  recordedAt: string;
  note: string;
};

export type HumidorDeviceResult =
  | {
      status: "created";
      device: HumidorSensorDevice;
      reading: HumidorDeviceReading;
    }
  | {
      status: "missing_name" | "missing_identifier" | "invalid_climate";
      device: null;
      reading: null;
    };

export type AddHumidorDeviceResult = HumidorDeviceResult & {
  devices: HumidorSensorDevice[];
};

export const defaultHumidorDeviceForm: HumidorDeviceInput = {
  name: "",
  location: "",
  deviceType: "HUMIDIFIER",
  connection: "Bluetooth",
  identifier: "",
  humidity: "",
  temperature: "",
  syncInterval: "15",
};

export const humidorDeviceTypeLabels: Record<HumidorDeviceType, string> = {
  HYGROMETER_THERMOMETER: "Hygrometer thermometer",
  HUMIDIFIER: "HUMIDIFIER",
};

export const humidorClimateAlertTarget = {
  maxHumidity: 72,
  maxTemperature: 74,
  minHumidity: 65,
  minTemperature: 64,
};

export type HumidorDeviceClimateAlert = {
  deviceId: string;
  deviceName: string;
  humidityOutOfRange: boolean;
  location: string;
  message: string;
  temperatureOutOfRange: boolean;
};

export function createHumidorDevice(input: HumidorDeviceInput, nowLabel = "Just now"): HumidorDeviceResult {
  const name = input.name.trim();
  const location = input.location.trim();
  const deviceType = normalizeDeviceType(input.deviceType) || "HYGROMETER_THERMOMETER";
  const identifier = input.identifier.trim();
  const humidity = Number(input.humidity);
  const temperature = Number(input.temperature);
  const syncIntervalMinutes = Math.max(5, Math.min(120, Math.round(Number(input.syncInterval) || 15)));

  if (!name || !location) {
    return { status: "missing_name", device: null, reading: null };
  }

  if (!identifier) {
    return { status: "missing_identifier", device: null, reading: null };
  }

  if (!isValidClimate(humidity, temperature)) {
    return { status: "invalid_climate", device: null, reading: null };
  }

  const device: HumidorSensorDevice = {
    id: buildDeviceId(deviceType, input.connection, name, location, identifier),
    name,
    location,
    deviceType,
    connection: input.connection,
    identifier,
    humidity,
    temperature,
    syncIntervalMinutes,
    status: "Connected",
    lastSyncedAt: nowLabel,
  };

  return {
    status: "created",
    device,
    reading: {
      id: `reading-${device.id}`,
      location,
      humidity,
      temperature,
      source: "Device",
      recordedAt: nowLabel,
      note: `${input.connection} ${formatDeviceType(deviceType)} synced from ${name}.`,
    },
  };
}

export function addHumidorDevice(
  currentDevices: HumidorSensorDevice[],
  input: HumidorDeviceInput,
  nowLabel = "Just now",
): AddHumidorDeviceResult {
  const result = createHumidorDevice(input, nowLabel);

  if (result.status !== "created") {
    return { ...result, devices: currentDevices };
  }

  const devices = [
    result.device,
    ...currentDevices.filter((device) => device.identifier.toLowerCase() !== result.device.identifier.toLowerCase()),
  ];

  return {
    ...result,
    devices,
  };
}

export function normalizeHumidorDevices(value: unknown): HumidorSensorDevice[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const devices = value.flatMap<HumidorSensorDevice>((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const deviceType = normalizeDeviceType(record.deviceType) || "HYGROMETER_THERMOMETER";
    const connection = normalizeConnection(record.connection);
    const name = normalizeText(record.name);
    const location = normalizeText(record.location);
    const identifier = normalizeText(record.identifier);
    const humidity = normalizeNumber(record.humidity);
    const temperature = normalizeNumber(record.temperature);

    if (!connection || !name || !location || !identifier || !isValidClimate(humidity, temperature)) {
      return [];
    }

    const syncIntervalMinutes = Math.max(5, Math.min(120, Math.round(normalizeNumber(record.syncIntervalMinutes) || 15)));
    const status: HumidorDeviceStatus = record.status === "Ready to sync" ? "Ready to sync" : "Connected";
    const lastSyncedAt = normalizeText(record.lastSyncedAt) || "Just now";

    return [
      {
        id: normalizeText(record.id) || buildDeviceId(deviceType, connection, name, location, identifier),
        name,
        location,
        deviceType,
        connection,
        identifier,
        humidity,
        temperature,
        syncIntervalMinutes,
        status,
        lastSyncedAt,
      },
    ];
  });

  return devices;
}

export function getHumidorDeviceClimateAlerts(devices: HumidorSensorDevice[]): HumidorDeviceClimateAlert[] {
  return devices.flatMap((device) => {
    const alert = getHumidorDeviceClimateAlert(device);
    return alert ? [alert] : [];
  });
}

export function getHumidorDeviceClimateAlert(device: HumidorSensorDevice): HumidorDeviceClimateAlert | null {
  const humidityOutOfRange = device.humidity < humidorClimateAlertTarget.minHumidity || device.humidity > humidorClimateAlertTarget.maxHumidity;
  const temperatureOutOfRange =
    device.temperature < humidorClimateAlertTarget.minTemperature || device.temperature > humidorClimateAlertTarget.maxTemperature;

  if (!humidityOutOfRange && !temperatureOutOfRange) {
    return null;
  }

  const issues = [];
  if (humidityOutOfRange) {
    issues.push(`humidity is ${device.humidity}% RH`);
  }

  if (temperatureOutOfRange) {
    issues.push(`temperature is ${device.temperature} F`);
  }

  return {
    deviceId: device.id,
    deviceName: device.name,
    humidityOutOfRange,
    location: device.location,
    message: `${device.name} at ${device.location}: ${issues.join(" and ")}.`,
    temperatureOutOfRange,
  };
}

function normalizeDeviceType(value: unknown): HumidorDeviceType | null {
  if (value === "HUMIDIFIER" || value === "HYGROMETER_THERMOMETER") {
    return value;
  }

  const normalized = normalizeText(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "humidifier") {
    return "HUMIDIFIER";
  }

  if (normalized === "hygrometer" || normalized === "hygrometer_thermometer") {
    return "HYGROMETER_THERMOMETER";
  }

  return null;
}

function normalizeConnection(value: unknown): HumidorDeviceConnection | null {
  return value === "Bluetooth" || value === "WiFi" ? value : null;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

function isValidClimate(humidity: number, temperature: number) {
  return Number.isFinite(humidity) && humidity >= 1 && humidity <= 100 && Number.isFinite(temperature) && temperature >= 40 && temperature <= 95;
}

function formatDeviceType(deviceType: HumidorDeviceType) {
  return humidorDeviceTypeLabels[deviceType].toLowerCase();
}

function buildDeviceId(deviceType: HumidorDeviceType, connection: HumidorDeviceConnection, name: string, location: string, identifier: string) {
  return `device-${deviceType}-${connection}-${name}-${location}-${identifier}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
