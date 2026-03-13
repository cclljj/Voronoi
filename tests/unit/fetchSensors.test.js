import { describe, it, expect, vi } from "vitest";
import { parseSensorsCsv } from "../../src/data/fetchSensors";

describe("parseSensorsCsv", () => {
  it("parses valid rows", () => {
    const csv = [
      "id,latitude,longitude,name,type,pm25,color,url,label",
      "1,25.1,121.5,SensorA,AirBox,1,00ff00,/sensor/a,ok"
    ].join("\n");

    const rows = parseSensorsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "1",
      latitude: 25.1,
      longitude: 121.5,
      name: "SensorA",
      type: "AirBox",
      pm25: 1,
      color: "00ff00",
      url: "/sensor/a",
      label: "ok"
    });
  });

  it("skips malformed rows and emits warning", () => {
    const warn = vi.fn();
    const csv = [
      "id,latitude,longitude,name,type,pm25,color,url,label",
      "1,25.1,121.5,SensorA,AirBox,1,00ff00,/sensor/a,ok",
      "2,invalid,121.5,SensorB,AirBox,1,00ff00,/sensor/b,ok",
      "3,25.1,121.5,SensorC,AirBox,1,abc,/sensor/c,ok"
    ].join("\n");

    const rows = parseSensorsCsv(csv, { warn });
    expect(rows).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
