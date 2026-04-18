import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  enableSpeciesFromPreLoaded,
  loadGenomePropertiesText,
  preloadSpecies,
  removeGenomePropertiesFile,
  FileGetter,
} from "./gp-uploader";

// ────────────────────────────────────────────────────────────
// Shared viewer factory
// ────────────────────────────────────────────────────────────
function makeViewer(overrides = {}) {
  return {
    data: {},
    organisms: [],
    organism_totals: {},
    whitelist: null,
    propsOrder: null,
    gp_hierarchy: {
      get_top_level_gp_by_id: vi.fn(() => []),
    },
    gp_taxonomy: {
      set_organisms_loaded: vi.fn(),
      remove_organism_loaded: vi.fn(),
    },
    update_viewer: vi.fn(),
    ...overrides,
  };
}

// GP data fixture used across multiple tests
function makeGPData() {
  return {
    GenProp0001: {
      property: "GenProp0001",
      values: { TOTAL: { YES: 0, NO: 0, PARTIAL: 0 } },
      steps: [{ step: 1, values: {} }],
      parent_top_properties: null,
      isShowingSteps: false,
    },
    GenProp0002: {
      property: "GenProp0002",
      values: { TOTAL: { YES: 0, NO: 0, PARTIAL: 0 } },
      steps: [
        { step: 1, values: {} },
        { step: 2, values: {} },
      ],
      parent_top_properties: null,
      isShowingSteps: false,
    },
  };
}

// ────────────────────────────────────────────────────────────
// enableSpeciesFromPreLoaded
// ────────────────────────────────────────────────────────────
describe("enableSpeciesFromPreLoaded", () => {
  it("pushes numeric taxId to viewer.organisms", () => {
    const viewer = makeViewer();
    enableSpeciesFromPreLoaded(viewer, "9606");
    expect(viewer.organisms).toContain(9606);
  });

  it("keeps taxId as string when it is not a valid number", () => {
    const viewer = makeViewer();
    enableSpeciesFromPreLoaded(viewer, "MyCustomOrganism");
    expect(viewer.organisms).toContain("MyCustomOrganism");
  });

  it("initialises organism_totals for the new taxId", () => {
    const viewer = makeViewer();
    enableSpeciesFromPreLoaded(viewer, "9606");
    expect(viewer.organism_totals[9606]).toEqual({ YES: 0, NO: 0, PARTIAL: 0 });
  });

  it("calls gp_taxonomy.set_organisms_loaded with the resolved taxId and isFromFile", () => {
    const viewer = makeViewer();
    enableSpeciesFromPreLoaded(viewer, "9606", true);
    expect(viewer.gp_taxonomy.set_organisms_loaded).toHaveBeenCalledWith(
      9606,
      true,
    );
  });

  it("calls update_viewer when shouldUpdate is true (default)", () => {
    const viewer = makeViewer();
    enableSpeciesFromPreLoaded(viewer, "9606");
    expect(viewer.update_viewer).toHaveBeenCalledWith(500);
  });

  it("does NOT call update_viewer when shouldUpdate is false", () => {
    const viewer = makeViewer();
    enableSpeciesFromPreLoaded(viewer, "9606", false, false);
    expect(viewer.update_viewer).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────
// loadGenomePropertiesText — JSON path (exercises mergeObjectToData)
// ────────────────────────────────────────────────────────────
describe("loadGenomePropertiesText (JSON path / mergeObjectToData)", () => {
  it("merges species values from JSON into existing viewer.data", () => {
    const viewer = makeViewer({ data: makeGPData() });
    const obj = {
      GenProp0001: {
        property: "GenProp0001",
        values: { 9606: "YES", TOTAL: {} },
        steps: [{ step: 1, values: { 9606: true } }],
      },
      GenProp0002: {
        property: "GenProp0002",
        values: { 9606: "NO", TOTAL: {} },
        steps: [
          { step: 1, values: { 9606: false } },
          { step: 2, values: { 9606: true } },
        ],
      },
    };
    loadGenomePropertiesText(viewer, "test-label", JSON.stringify(obj));
    expect(viewer.data.GenProp0001.values[9606]).toBe("YES");
    expect(viewer.data.GenProp0002.values[9606]).toBe("NO");
  });

  it("merges step values from JSON into existing viewer.data", () => {
    const viewer = makeViewer({ data: makeGPData() });
    const obj = {
      GenProp0001: {
        property: "GenProp0001",
        values: { 9606: "YES", TOTAL: {} },
        steps: [{ step: 1, values: { 9606: true } }],
      },
      GenProp0002: {
        property: "GenProp0002",
        values: { 9606: "NO", TOTAL: {} },
        steps: [
          { step: 1, values: { 9606: false } },
          { step: 2, values: { 9606: true } },
        ],
      },
    };
    loadGenomePropertiesText(viewer, "test-label", JSON.stringify(obj));
    expect(viewer.data.GenProp0001.steps[0].values[9606]).toBe(true);
    expect(viewer.data.GenProp0002.steps[1].values[9606]).toBe(true);
  });

  it("does not copy TOTAL key from merged values", () => {
    const viewer = makeViewer({ data: makeGPData() });
    const obj = {
      GenProp0001: {
        property: "GenProp0001",
        values: { 9606: "YES", TOTAL: { YES: 99 } },
        steps: [{ step: 1, values: { 9606: true } }],
      },
      GenProp0002: {
        property: "GenProp0002",
        values: { 9606: "NO", TOTAL: {} },
        steps: [
          { step: 1, values: { 9606: false } },
          { step: 2, values: { 9606: true } },
        ],
      },
    };
    loadGenomePropertiesText(viewer, "test-label", JSON.stringify(obj));
    // The original TOTAL remains unchanged (not replaced by 99)
    expect(viewer.data.GenProp0001.values.TOTAL).toEqual({
      YES: 0,
      NO: 0,
      PARTIAL: 0,
    });
  });

  it("adds all organisms found in the JSON to viewer.organisms", () => {
    const viewer = makeViewer({ data: makeGPData() });
    const obj = {
      GenProp0001: {
        property: "GenProp0001",
        values: { 9606: "YES", 10090: "NO", TOTAL: {} },
        steps: [{ step: 1, values: { 9606: true, 10090: false } }],
      },
      GenProp0002: {
        property: "GenProp0002",
        values: { 9606: "YES", 10090: "YES", TOTAL: {} },
        steps: [
          { step: 1, values: { 9606: true, 10090: true } },
          { step: 2, values: { 9606: false, 10090: true } },
        ],
      },
    };
    loadGenomePropertiesText(viewer, "test-label", JSON.stringify(obj));
    // The organisms from the FIRST GP's values (after TOTAL filter) are used
    expect(viewer.organisms).toContain(9606);
    expect(viewer.organisms).toContain(10090);
  });
});

// ────────────────────────────────────────────────────────────
// loadGenomePropertiesText — TSV path
// ────────────────────────────────────────────────────────────
describe("loadGenomePropertiesText (TSV path)", () => {
  function makeTsvText(rows) {
    return rows.map((r) => r.join("\t")).join("\n");
  }

  it("parses a valid 3-column TSV and populates viewer.data", () => {
    const viewer = makeViewer();
    const tsv = makeTsvText([
      ["GenProp0001", "Carbon fixation", "YES"],
      ["GenProp0002", "Nitrogen metabolism", "NO"],
    ]);
    loadGenomePropertiesText(viewer, "9606", tsv);
    expect(viewer.data.GenProp0001).toBeDefined();
    expect(viewer.data.GenProp0001.values[9606]).toBe("YES");
    expect(viewer.data.GenProp0002.values[9606]).toBe("NO");
  });

  it("updates TOTAL counts for each value", () => {
    const viewer = makeViewer();
    const tsv = makeTsvText([
      ["GenProp0001", "Carbon fixation", "YES"],
      ["GenProp0002", "Nitrogen metabolism", "NO"],
      ["GenProp0003", "Something", "PARTIAL"],
    ]);
    loadGenomePropertiesText(viewer, "9606", tsv);
    expect(viewer.data.GenProp0001.values.TOTAL.YES).toBe(1);
    expect(viewer.data.GenProp0002.values.TOTAL.NO).toBe(1);
    expect(viewer.data.GenProp0003.values.TOTAL.PARTIAL).toBe(1);
  });

  it("updates organism_totals for the taxId", () => {
    const viewer = makeViewer();
    const tsv = makeTsvText([
      ["GenProp0001", "Carbon fixation", "YES"],
      ["GenProp0002", "Nitrogen metabolism", "NO"],
      ["GenProp0003", "Something", "PARTIAL"],
    ]);
    loadGenomePropertiesText(viewer, "9606", tsv);
    expect(viewer.organism_totals[9606]).toEqual({ YES: 1, NO: 1, PARTIAL: 1 });
  });

  it("calls update_viewer after loading", () => {
    const viewer = makeViewer();
    const tsv = makeTsvText([["GenProp0001", "Carbon fixation", "YES"]]);
    loadGenomePropertiesText(viewer, "9606", tsv);
    expect(viewer.update_viewer).toHaveBeenCalledWith(500);
  });

  it("throws and rolls back when a line has wrong column count", () => {
    const viewer = makeViewer();
    const tsv = makeTsvText([
      ["GenProp0001", "Carbon fixation", "YES"],
      ["GenProp0002", "Only two columns"], // bad line — only 2 cols
    ]);
    expect(() => loadGenomePropertiesText(viewer, "9606", tsv)).toThrow();
    // taxId should be removed from organisms on failure
    expect(viewer.organisms).not.toContain(9606);
  });

  it("respects the whitelist — skips GPs not in whitelist", () => {
    const viewer = makeViewer({ whitelist: ["GenProp0001"] });
    const tsv = makeTsvText([
      ["GenProp0001", "Carbon fixation", "YES"],
      ["GenProp0002", "Nitrogen metabolism", "NO"],
    ]);
    loadGenomePropertiesText(viewer, "9606", tsv);
    expect(viewer.data.GenProp0001).toBeDefined();
    expect(viewer.data.GenProp0002).toBeUndefined();
  });

  it("keeps taxId as string when label is not numeric (isFromFile=true)", () => {
    const viewer = makeViewer();
    const tsv = makeTsvText([["GenProp0001", "Carbon fixation", "YES"]]);
    loadGenomePropertiesText(viewer, "myfile.gp", tsv, true);
    expect(viewer.organisms).toContain("myfile.gp");
  });
});

// ────────────────────────────────────────────────────────────
// preloadSpecies
// ────────────────────────────────────────────────────────────
describe("preloadSpecies", () => {
  it("sets viewer.data to the provided data object", () => {
    const viewer = makeViewer();
    const data = makeGPData();
    preloadSpecies(viewer, data);
    expect(viewer.data).toBe(data);
  });

  it("sets isShowingSteps to false for every GP", () => {
    const viewer = makeViewer();
    const data = makeGPData();
    data.GenProp0001.isShowingSteps = true;
    preloadSpecies(viewer, data);
    expect(viewer.data.GenProp0001.isShowingSteps).toBe(false);
    expect(viewer.data.GenProp0002.isShowingSteps).toBe(false);
  });

  it("calls get_top_level_gp_by_id for every GP and stores the result", () => {
    const viewer = makeViewer();
    viewer.gp_hierarchy.get_top_level_gp_by_id
      .mockReturnValueOnce(["TopA"])
      .mockReturnValueOnce(["TopB"]);
    const data = makeGPData();
    preloadSpecies(viewer, data);
    expect(viewer.data.GenProp0001.parent_top_properties).toEqual(["TopA"]);
    expect(viewer.data.GenProp0002.parent_top_properties).toEqual(["TopB"]);
  });
});

// ────────────────────────────────────────────────────────────
// removeGenomePropertiesFile
// ────────────────────────────────────────────────────────────
describe("removeGenomePropertiesFile", () => {
  it("removes the taxId from viewer.organisms", () => {
    const viewer = makeViewer({
      organisms: [9606, 10090],
      organism_totals: { 9606: {}, 10090: {} },
    });
    removeGenomePropertiesFile(viewer, "9606");
    expect(viewer.organisms).not.toContain(9606);
    expect(viewer.organisms).toContain(10090);
  });

  it("removes organism_totals entry for the taxId", () => {
    const viewer = makeViewer({
      organisms: [9606],
      organism_totals: { 9606: { YES: 1 } },
    });
    removeGenomePropertiesFile(viewer, "9606");
    expect(viewer.organism_totals[9606]).toBeUndefined();
  });

  it("treats non-numeric ids as strings (isFromFile=true path)", () => {
    const viewer = makeViewer({
      organisms: ["myfile.gp"],
      organism_totals: { "myfile.gp": {} },
    });
    removeGenomePropertiesFile(viewer, "myfile.gp");
    expect(viewer.organisms).not.toContain("myfile.gp");
    expect(viewer.gp_taxonomy.remove_organism_loaded).toHaveBeenCalledWith(
      "myfile.gp",
      true,
    );
  });

  it("calls gp_taxonomy.remove_organism_loaded with numeric id and false", () => {
    const viewer = makeViewer({
      organisms: [9606],
      organism_totals: { 9606: {} },
    });
    removeGenomePropertiesFile(viewer, "9606");
    expect(viewer.gp_taxonomy.remove_organism_loaded).toHaveBeenCalledWith(
      9606,
      false,
    );
  });

  it("calls update_viewer after removal", () => {
    const viewer = makeViewer({
      organisms: [9606],
      organism_totals: { 9606: {} },
    });
    removeGenomePropertiesFile(viewer, "9606");
    expect(viewer.update_viewer).toHaveBeenCalledWith(500);
  });
});

// ────────────────────────────────────────────────────────────
// FileGetter — getText / getJSON caching
// ────────────────────────────────────────────────────────────
describe("FileGetter", () => {
  // Minimal D3-like chainable element returned by modal.getContentElement()
  function makeChainable() {
    const el = {};
    el.append = vi.fn(() => el);
    el.attr = vi.fn(() => el);
    el.text = vi.fn(() => el);
    return el;
  }

  function makeMockModal() {
    return {
      showContent: vi.fn(),
      getContentElement: vi.fn(() => makeChainable()),
      setVisibility: vi.fn(),
    };
  }

  // Returns a fetch mock that serves `payload` as JSON, with no streaming body
  // (body: null forces the arrayBuffer() fallback path in getText)
  function makeFetchMock(payload) {
    const buf = new TextEncoder().encode(JSON.stringify(payload)).buffer;
    return vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => String(buf.byteLength) },
      body: null,
      arrayBuffer: vi.fn().mockResolvedValue(buf),
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("getJSON returns parsed JSON on first call", async () => {
    const payload = { GenProp0001: { property: "GenProp0001" } };
    vi.stubGlobal("fetch", makeFetchMock(payload));
    const getter = new FileGetter({ viewer: { modal: makeMockModal() } });

    const result = await getter.getJSON("/data.json");

    expect(result).toEqual(payload);
  });

  it("getJSON returns parsed JSON on a repeated call (cache hit)", async () => {
    const payload = { GenProp0001: { property: "GenProp0001" } };
    vi.stubGlobal("fetch", makeFetchMock(payload));
    const getter = new FileGetter({ viewer: { modal: makeMockModal() } });

    const first = await getter.getJSON("/data.json");
    // Second call hits the cache — this was the regression: it previously
    // returned the raw Response object instead of the parsed data.
    const second = await getter.getJSON("/data.json");

    expect(second).toEqual(payload);
    expect(second).toBe(first);
  });

  it("fetch is called exactly once even when getJSON is called multiple times", async () => {
    const payload = { test: true };
    const mockFetch = makeFetchMock(payload);
    vi.stubGlobal("fetch", mockFetch);
    const getter = new FileGetter({ viewer: { modal: makeMockModal() } });

    await getter.getJSON("/data.json");
    await getter.getJSON("/data.json");
    await getter.getJSON("/data.json");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("getText returns raw text on first call", async () => {
    const content = "hello\tworld\n";
    const buf = new TextEncoder().encode(content).buffer;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => String(buf.byteLength) },
      body: null,
      arrayBuffer: vi.fn().mockResolvedValue(buf),
    });
    vi.stubGlobal("fetch", mockFetch);
    const getter = new FileGetter({ viewer: { modal: makeMockModal() } });

    const result = await getter.getText("/file.tsv");

    expect(result).toBe(content);
  });

  it("getText returns the same text on a repeated call (cache hit)", async () => {
    const content = "hello\tworld\n";
    const buf = new TextEncoder().encode(content).buffer;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => String(buf.byteLength) },
        body: null,
        arrayBuffer: vi.fn().mockResolvedValue(buf),
      }),
    );
    const getter = new FileGetter({ viewer: { modal: makeMockModal() } });

    const first = await getter.getText("/file.tsv");
    const second = await getter.getText("/file.tsv");

    expect(second).toBe(content);
    expect(second).toBe(first);
  });
});
