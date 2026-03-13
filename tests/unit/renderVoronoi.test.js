import { describe, it, expect, vi } from "vitest";
import { buildVoronoiCells, getPm25Color } from "../../src/voronoi/renderVoronoi";

describe("buildVoronoiCells", () => {
  it("creates cells for normal point sets", () => {
    const points = [
      { id: "a", x: 10, y: 10 },
      { id: "b", x: 90, y: 10 },
      { id: "c", x: 50, y: 90 }
    ];

    const cells = buildVoronoiCells(points, [0, 0, 100, 100]);
    expect(cells.length).toBe(3);
    expect(cells[0].polygon.length).toBeGreaterThan(2);
  });

  it("handles overlapping points without throwing", () => {
    const points = [
      { id: "a", x: 40, y: 40 },
      { id: "b", x: 40, y: 40 },
      { id: "c", x: 70, y: 70 }
    ];

    expect(() => buildVoronoiCells(points, [0, 0, 100, 100])).not.toThrow();
  });

  it("returns empty array for empty point sets", () => {
    expect(buildVoronoiCells([], [0, 0, 100, 100])).toEqual([]);
  });
});

describe("getPm25Color", () => {
  it("maps valid buckets and warns on out-of-range", () => {
    const warn = vi.fn();

    expect(getPm25Color(1)).toBe("#FFFF00");
    expect(getPm25Color(7, { warn })).toBe("#CE30FF");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
