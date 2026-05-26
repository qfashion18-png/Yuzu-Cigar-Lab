import assert from "node:assert/strict";
import test from "node:test";

import {
  addHumidorDevice,
  applyHumidorDeviceDiscovery,
  createHumidorDevice,
  defaultHumidorDeviceForm,
  discoverAvailableHumidorDevice,
  getConnectedHumidorDeviceReading,
  getHumidorDeviceClimateAlerts,
  normalizeHumidorDevices,
  type HumidorDeviceInput,
} from "../src/lib/humidor-devices";

const bluetoothInput: HumidorDeviceInput = {
  name: "Govee Smart Hygrometer",
  location: "Home Cabinet",
  connection: "Bluetooth",
  identifier: "BLE-GV-5075",
  humidity: "68",
  temperature: "70",
  syncInterval: "15",
};

test("creates a Bluetooth hygrometer thermometer device with a device climate reading", () => {
  const result = createHumidorDevice(bluetoothInput, "May 6, 2026 9:30 AM");

  assert.equal(result.status, "created");
  assert.equal(result.device?.connection, "Bluetooth");
  assert.equal(result.device?.name, "Govee Smart Hygrometer");
  assert.equal(result.device?.location, "Home Cabinet");
  assert.equal(result.device?.humidity, 68);
  assert.equal(result.device?.temperature, 70);
  assert.equal(result.device?.syncIntervalMinutes, 15);
  assert.equal(result.reading?.source, "Device");
  assert.match(result.reading?.note ?? "", /Bluetooth hygrometer thermometer/i);
});

test("adds WiFi hygrometer thermometer devices without mutating existing devices", () => {
  const existing = normalizeHumidorDevices([
    {
      name: "Home Cabinet Sensor",
      location: "Home Cabinet",
      connection: "WiFi",
      identifier: "192.168.1.30",
      humidity: 69,
      temperature: 70,
      syncIntervalMinutes: 15,
      status: "Connected",
      lastSyncedAt: "May 6, 2026 9:00 AM",
    },
  ]);
  const result = addHumidorDevice(existing, {
    name: "SensorPush Gateway",
    location: "Lounge Locker",
    connection: "WiFi",
    identifier: "192.168.1.44",
    humidity: "66",
    temperature: "69",
    syncInterval: "10",
  }, "May 6, 2026 10:00 AM");

  assert.equal(result.status, "created");
  assert.equal(existing.length, 1);
  assert.equal(result.devices.length, 2);
  assert.equal(result.devices[0].connection, "WiFi");
  assert.equal(result.devices[0].identifier, "192.168.1.44");
  assert.equal(result.reading?.location, "Lounge Locker");
});

test("creates a WiFi HUMIDIFIER device with a device climate reading", () => {
  const result = createHumidorDevice({
    name: "Smart Cabinet Humidifier",
    location: "Walk-in Humidor",
    deviceType: "HUMIDIFIER",
    connection: "WiFi",
    identifier: "HUM-192-168-1-88",
    humidity: "69",
    temperature: "70",
    syncInterval: "20",
  }, "May 13, 2026 9:45 AM");

  assert.equal(result.status, "created");
  assert.equal(result.device?.deviceType, "HUMIDIFIER");
  assert.equal(result.device?.name, "Smart Cabinet Humidifier");
  assert.equal(result.device?.connection, "WiFi");
  assert.equal(result.device?.syncIntervalMinutes, 20);
  assert.match(result.reading?.note ?? "", /WiFi humidifier/i);
});

test("applies an available device reading to the pairing form without replacing member location settings", () => {
  const form = applyHumidorDeviceDiscovery(
    {
      ...defaultHumidorDeviceForm,
      location: "Locker A / Drawer 2",
      syncInterval: "20",
    },
    {
      name: "Govee Smart Hygrometer",
      identifier: "BLE-GV-5075",
      connection: "Bluetooth",
      deviceType: "HYGROMETER_THERMOMETER",
      humidity: 67.7,
      temperature: 70.2,
    },
  );

  assert.equal(form.name, "Govee Smart Hygrometer");
  assert.equal(form.identifier, "BLE-GV-5075");
  assert.equal(form.connection, "Bluetooth");
  assert.equal(form.deviceType, "HYGROMETER_THERMOMETER");
  assert.equal(form.humidity, "67.7");
  assert.equal(form.temperature, "70.2");
  assert.equal(form.location, "Locker A / Drawer 2");
  assert.equal(form.syncInterval, "20");
});

test("discovers an available humidor device reading for the selected connection", async () => {
  await assert.rejects(
    () => discoverAvailableHumidorDevice({ ...defaultHumidorDeviceForm, connection: "Bluetooth", deviceType: "HUMIDIFIER" }),
    /Search WiFi for HUMIDIFIER devices/i,
  );

  const discovery = await discoverAvailableHumidorDevice({
    ...defaultHumidorDeviceForm,
    connection: "WiFi",
    deviceType: "HUMIDIFIER",
  });

  assert.equal(discovery.connection, "WiFi");
  assert.equal(discovery.deviceType, "HUMIDIFIER");
  assert.ok(discovery.name);
  assert.ok(discovery.identifier);
  assert.ok(Number(discovery.humidity) >= 1);
  assert.ok(Number(discovery.temperature) >= 40);
});

test("detects paired device readings that should trigger climate phone alerts", () => {
  const devices = normalizeHumidorDevices([
    {
      name: "Smart Cabinet Humidifier",
      location: "Walk-in Humidor",
      deviceType: "HUMIDIFIER",
      connection: "WiFi",
      identifier: "HUM-192-168-1-88",
      humidity: 61,
      temperature: 70,
      syncIntervalMinutes: 20,
      status: "Connected",
      lastSyncedAt: "May 13, 2026 9:45 AM",
    },
    {
      name: "Balanced Sensor",
      location: "Locker A",
      deviceType: "HYGROMETER_THERMOMETER",
      connection: "Bluetooth",
      identifier: "BLE-BALANCED",
      humidity: 69,
      temperature: 70,
      syncIntervalMinutes: 15,
      status: "Connected",
      lastSyncedAt: "May 13, 2026 9:45 AM",
    },
  ]);

  const alerts = getHumidorDeviceClimateAlerts(devices);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].deviceId, devices[0].id);
  assert.equal(alerts[0].location, "Walk-in Humidor");
  assert.match(alerts[0].message, /humidity is 61% RH/i);
  assert.equal(alerts[0].humidityOutOfRange, true);
  assert.equal(alerts[0].temperatureOutOfRange, false);
});

test("selects the connected paired device reading for the overview dashboard", () => {
  const devices = normalizeHumidorDevices([
    {
      id: "ready-device",
      name: "Ready Sensor",
      location: "Locker B",
      deviceType: "HYGROMETER_THERMOMETER",
      connection: "Bluetooth",
      identifier: "BLE-READY",
      humidity: 66,
      temperature: 69,
      syncIntervalMinutes: 15,
      status: "Ready to sync",
      lastSyncedAt: "May 26, 8:00 AM",
    },
    {
      id: "connected-device",
      name: "Smart Cabinet Humidifier",
      location: "Main Cabinet",
      deviceType: "HUMIDIFIER",
      connection: "WiFi",
      identifier: "HUM-192-168-1-88",
      humidity: 68.4,
      temperature: 70.2,
      syncIntervalMinutes: 15,
      status: "Connected",
      lastSyncedAt: "May 26, 9:15 AM",
    },
  ]);

  const reading = getConnectedHumidorDeviceReading(devices);

  assert.equal(reading?.id, "connected-device");
  assert.equal(reading?.humidity, 68.4);
  assert.equal(reading?.temperature, 70.2);
});

test("rejects incomplete device names and unsafe climate readings", () => {
  assert.equal(createHumidorDevice({ ...bluetoothInput, name: " " }).status, "missing_name");
  assert.equal(createHumidorDevice({ ...bluetoothInput, identifier: "" }).status, "missing_identifier");
  assert.equal(createHumidorDevice({ ...bluetoothInput, humidity: "0" }).status, "invalid_climate");
  assert.equal(createHumidorDevice({ ...bluetoothInput, temperature: "102" }).status, "invalid_climate");
});

test("normalizes stored humidor devices without seeding device fixtures", () => {
  const normalized = normalizeHumidorDevices([
    {
      id: "stored-device",
      name: "Stored Bluetooth Sensor",
      location: "Travel Case",
      connection: "Bluetooth",
      identifier: "BLE-STORED",
      humidity: 64,
      temperature: 68,
      syncIntervalMinutes: 20,
      status: "Connected",
      lastSyncedAt: "Yesterday",
    },
  ]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].name, "Stored Bluetooth Sensor");
  assert.equal(normalized[0].deviceType, "HYGROMETER_THERMOMETER");
  assert.equal(normalized[0].connection, "Bluetooth");
  assert.deepEqual(normalizeHumidorDevices(null), []);
  assert.deepEqual(normalizeHumidorDevices([{ name: "", connection: "Cellular" }]), []);
});
