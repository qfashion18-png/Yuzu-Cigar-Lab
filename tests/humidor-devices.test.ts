import assert from "node:assert/strict";
import test from "node:test";

import {
  addHumidorDevice,
  createHumidorDevice,
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
  assert.equal(normalized[0].connection, "Bluetooth");
  assert.deepEqual(normalizeHumidorDevices(null), []);
  assert.deepEqual(normalizeHumidorDevices([{ name: "", connection: "Cellular" }]), []);
});
