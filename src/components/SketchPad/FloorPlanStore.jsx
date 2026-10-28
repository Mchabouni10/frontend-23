// src/components/SketchPad/FloorPlanStore.jsx
// ───────────────────────────────────────────────────────────
// FILE 1 / 3 — STATE & LOGIC  (no drawing, no UI panels)
//   • constants, fixture/furniture presets, small utilities
//   • React context: pages, elements, selection, undo/redo, layers,
//     settings, save/load JSON, PNG export, take-off CSV
//   • <Provider> wraps the whole designer and exposes useC()
// ───────────────────────────────────────────────────────────

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_SETTINGS,
  PPF,
  bboxOf,
  computeTakeoff,
  roomPoints,
  rotateCabinet,
  toCsv,
  uid,
} from "./takeoff";

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════
export const DEF_WALL_T = 12; // default wall thickness px (~7 inches)
const ROOM_COLORS = [
  "#dbeafe",
  "#dcfce7",
  "#fef9c3",
  "#fce7f3",
  "#e0f2fe",
  "#f3e8ff",
  "#ffedd5",
  "#ecfdf5",
  "#fee2e2",
  "#cffafe",
];

// ═══════════════════════════════════════════════════════════
// ELEMENT PRESETS — fixtures & furniture (dimensions in px)
// ═══════════════════════════════════════════════════════════
export const PRESETS = {
  // Bathroom
  toilet: {
    w: 56,
    h: 72,
    layer: "fixtures",
    fill: "#dbeafe",
    stroke: "#3b82f6",
    label: "Toilet",
    sym: "toilet",
  },
  sink: {
    w: 56,
    h: 52,
    layer: "fixtures",
    fill: "#dbeafe",
    stroke: "#3b82f6",
    label: "Sink",
    sym: "sink",
  },
  bathtub: {
    w: 70,
    h: 140,
    layer: "fixtures",
    fill: "#dbeafe",
    stroke: "#3b82f6",
    label: "Bathtub",
    sym: "bathtub",
  },
  shower: {
    w: 80,
    h: 80,
    layer: "fixtures",
    fill: "#e0f2fe",
    stroke: "#0284c7",
    label: "Shower",
    sym: "shower",
  },
  // Kitchen
  counter: {
    w: 160,
    h: 50,
    layer: "fixtures",
    fill: "#fef9c3",
    stroke: "#ca8a04",
    label: "Counter",
    sym: "counter",
  },
  island: {
    w: 120,
    h: 80,
    layer: "fixtures",
    fill: "#fef9c3",
    stroke: "#ca8a04",
    label: "Island",
    sym: "box",
  },
  stove: {
    w: 60,
    h: 60,
    layer: "fixtures",
    fill: "#fef9c3",
    stroke: "#ca8a04",
    label: "Stove",
    sym: "stove",
  },
  fridge: {
    w: 60,
    h: 70,
    layer: "fixtures",
    fill: "#e2e8f0",
    stroke: "#64748b",
    label: "Fridge",
    sym: "fridge",
  },
  // Living / Bedroom
  sofa: {
    w: 200,
    h: 90,
    layer: "furniture",
    fill: "#fce7f3",
    stroke: "#db2777",
    label: "Sofa",
    sym: "sofa",
  },
  loveseat: {
    w: 140,
    h: 90,
    layer: "furniture",
    fill: "#fce7f3",
    stroke: "#db2777",
    label: "Loveseat",
    sym: "sofa",
  },
  armchair: {
    w: 80,
    h: 80,
    layer: "furniture",
    fill: "#fce7f3",
    stroke: "#db2777",
    label: "Armchair",
    sym: "chair",
  },
  bed_q: {
    w: 160,
    h: 200,
    layer: "furniture",
    fill: "#f3e8ff",
    stroke: "#9333ea",
    label: "Queen Bed",
    sym: "bed",
  },
  bed_t: {
    w: 100,
    h: 200,
    layer: "furniture",
    fill: "#f3e8ff",
    stroke: "#9333ea",
    label: "Twin Bed",
    sym: "bed",
  },
  desk: {
    w: 140,
    h: 70,
    layer: "furniture",
    fill: "#dcfce7",
    stroke: "#16a34a",
    label: "Desk",
    sym: "box",
  },
  table_d: {
    w: 160,
    h: 100,
    layer: "furniture",
    fill: "#fef3c7",
    stroke: "#d97706",
    label: "Dining Table",
    sym: "table",
  },
  table_c: {
    w: 100,
    h: 60,
    layer: "furniture",
    fill: "#fef3c7",
    stroke: "#d97706",
    label: "Coffee Table",
    sym: "box",
  },
  dresser: {
    w: 120,
    h: 50,
    layer: "furniture",
    fill: "#f3e8ff",
    stroke: "#9333ea",
    label: "Dresser",
    sym: "dresser",
  },
  wardrobe: {
    w: 120,
    h: 60,
    layer: "furniture",
    fill: "#f3e8ff",
    stroke: "#9333ea",
    label: "Wardrobe",
    sym: "box",
  },
};

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════
export const toFt = (px) => {
  const totalIn = Math.round((Math.abs(px) / PPF) * 12);
  const ft = Math.floor(totalIn / 12);
  const inches = totalIn % 12;
  if (ft === 0) return `${inches}"`;
  if (inches === 0) return `${ft}'`;
  return `${ft}' ${inches}"`;
};

export const snapV = (v, g) => Math.round(v / g) * g;

// Moves any element type (rect, line, polygon, freehand, text) by (dx, dy).
export const translateEl = (el, dx, dy) => {
  const n = { ...el };
  if (n.x !== undefined) {
    n.x += dx;
    n.y += dy;
  }
  if (n.start) {
    n.start = { x: n.start.x + dx, y: n.start.y + dy };
    n.end = { x: n.end.x + dx, y: n.end.y + dy };
  }
  if (n.points) n.points = n.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  return n;
};

const downloadBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
};

// Heights (inches) of fixtures in the 3-D preview
export const PRESET_H_IN = {
  toilet: 16,
  sink: 34,
  bathtub: 20,
  shower: 3,
  counter: 36,
  stove: 36,
  fridge: 70,
  sofa: 34,
  chair: 32,
  bed: 24,
  dresser: 34,
  table: 30,
  box: 30,
};

// ═══════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════
const Ctx = createContext(null);
export const useC = () => useContext(Ctx);

const MAX_HISTORY = 100;
const mkPage = (id, name) => ({ id, name, elements: [] });
const DEFAULT_LAYERS = [
  { id: "walls", name: "Walls & openings", visible: true },
  { id: "rooms", name: "Rooms & finishes", visible: true },
  { id: "fixtures", name: "Fixtures", visible: true },
  { id: "cabinets", name: "Cabinets", visible: true },
  { id: "furniture", name: "Furniture", visible: true },
  { id: "annotations", name: "Annotations", visible: true },
];

export const Provider = ({
  children,
  initialDoc,
  onChange,
  onTakeoffChange,
  onSendToEstimate,
}) => {
  // The whole project (pages + project settings) lives in one history stack,
  // so undo/redo also covers page add/remove and settings changes.
  const [hs, setHs] = useState(() => ({
    past: [],
    future: [],
    present: {
      pages: initialDoc?.pages?.length
        ? initialDoc.pages
        : [mkPage(1, "Floor 1")],
      settings: { ...DEFAULT_SETTINGS, ...initialDoc?.settings },
    },
  }));
  const [pid, setPid] = useState(() => initialDoc?.pages?.[0]?.id ?? 1);
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#2c3e50");
  const [fillColor, setFillColor] = useState(ROOM_COLORS[0]);
  const [strokeW, setStrokeW] = useState(2);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selId, setSelId] = useState(null);
  const [view, setView] = useState("2d");
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [curLayer, setCurLayer] = useState("walls");
  const [sideTab, setSideTab] = useState("props"); // 'props'|'layers'|'pages'|'estimate'

  const doc = hs.present;
  const pages = doc.pages;
  const settings = doc.settings;
  const page = pages.find((p) => p.id === pid) || pages[0];
  const selEl = page.elements.find((e) => e.id === selId) || null;
  const visLayers = useMemo(
    () => new Set(layers.filter((l) => l.visible).map((l) => l.id)),
    [layers],
  );
  const takeoff = useMemo(
    () => computeTakeoff(pages, settings),
    [pages, settings],
  );

  const pushPast = (h) => [...h.past.slice(-(MAX_HISTORY - 1)), h.present];
  const commit = (fn) =>
    setHs((h) => ({ past: pushPast(h), present: fn(h.present), future: [] }));

  // addHist=false → live update while dragging (see beginLive / endLive)
  const setEls = (newEls, addHist = true) => {
    const apply = (d) => ({
      ...d,
      pages: d.pages.map((p) =>
        p.id === page.id ? { ...p, elements: newEls } : p,
      ),
    });
    if (addHist) commit(apply);
    else setHs((h) => ({ ...h, present: apply(h.present) }));
  };

  const dragSnap = useRef(null);
  const beginLive = () => {
    dragSnap.current = hs.present;
  };
  const endLive = () => {
    const snapDoc = dragSnap.current;
    dragSnap.current = null;
    if (!snapDoc) return;
    setHs((h) =>
      h.present === snapDoc
        ? h
        : {
            past: [...h.past.slice(-(MAX_HISTORY - 1)), snapDoc],
            present: h.present,
            future: [],
          },
    );
  };

  const undo = () => {
    setHs((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
          }
        : h,
    );
    setSelId(null);
  };
  const redo = () => {
    setHs((h) =>
      h.future.length
        ? { past: pushPast(h), present: h.future[0], future: h.future.slice(1) }
        : h,
    );
  };

  const mutateSel = (fn) => {
    if (!selEl) return;
    setEls(page.elements.map((e) => (e.id === selEl.id ? fn(e) : e)));
  };
  const updateSelEl = (key, val) => mutateSel((e) => ({ ...e, [key]: val }));
  const setSettings = (patch) =>
    commit((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  const delSel = () => {
    if (!selId) return;
    setEls(page.elements.filter((e) => e.id !== selId));
    setSelId(null);
  };

  const dupSel = () => {
    if (!selEl) return;
    let dup = { ...selEl, id: uid() };
    if (dup.type === "cabinet") {
      // place the copy flush beside the original → press Duplicate repeatedly to build a run
      dup =
        dup.facing === "e" || dup.facing === "w"
          ? { ...dup, y: dup.y + dup.h }
          : { ...dup, x: dup.x + dup.w };
    } else {
      dup = translateEl(dup, 20, 20);
    }
    setEls([...page.elements, dup]);
    setSelId(dup.id);
  };

  const rotateSel = () => {
    mutateSel((e) => {
      if (e.type === "cabinet") return rotateCabinet(e);
      if (e.type === "room") {
        const pts = roomPoints(e);
        const bb = bboxOf(pts);
        const cx = (bb.x0 + bb.x1) / 2,
          cy = (bb.y0 + bb.y1) / 2;
        const np = pts.map((p) => ({ x: cx - (p.y - cy), y: cy + (p.x - cx) }));
        const nb = bboxOf(np);
        return {
          ...e,
          points: np,
          start: { x: nb.x0, y: nb.y0 },
          end: { x: nb.x1, y: nb.y1 },
        };
      }
      if (e.w !== undefined && e.h !== undefined) {
        const cx = e.x + e.w / 2,
          cy = e.y + e.h / 2;
        return { ...e, w: e.h, h: e.w, x: cx - e.h / 2, y: cy - e.w / 2 };
      }
      return e;
    });
  };

  const clearAll = () => {
    if (window.confirm("Clear all elements on this floor?")) {
      setEls([]);
      setSelId(null);
    }
  };

  const addPage = () => {
    const np = mkPage(Date.now(), `Floor ${pages.length + 1}`);
    commit((d) => ({ ...d, pages: [...d.pages, np] }));
    setPid(np.id);
    setSelId(null);
  };

  const delPage = (id) => {
    if (pages.length === 1) return;
    const rest = pages.filter((p) => p.id !== id);
    commit((d) => ({ ...d, pages: d.pages.filter((p) => p.id !== id) }));
    if (pid === id) setPid(rest[0].id);
    setSelId(null);
  };

  const toggleLayer = (id) =>
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
    );

  const exportPng = () => {
    const c = document.getElementById("fp-canvas");
    if (!c) return;
    const tmp = document.createElement("canvas");
    tmp.width = c.width;
    tmp.height = c.height;
    const ctx = tmp.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(c, 0, 0);
    tmp.toBlob(
      (blob) => blob && downloadBlob(blob, `floorplan-${Date.now()}.png`),
    );
  };

  const saveJson = () =>
    downloadBlob(
      new Blob(
        [
          JSON.stringify(
            { version: 2, pages: doc.pages, settings: doc.settings },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      `floorplan-${Date.now()}.json`,
    );

  const loadJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.pages?.length) throw new Error("no pages");
        setHs({
          past: [],
          future: [],
          present: {
            pages: data.pages,
            settings: { ...DEFAULT_SETTINGS, ...data.settings },
          },
        });
        setPid(data.pages[0].id);
        setSelId(null);
      } catch {
        alert("Invalid project file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const exportTakeoffCsv = () =>
    downloadBlob(
      new Blob([toCsv(takeoff.lines)], { type: "text/csv" }),
      `takeoff-${Date.now()}.csv`,
    );
  const copyTakeoff = () =>
    navigator.clipboard?.writeText(JSON.stringify(takeoff, null, 2));
  const sendToEstimate = onSendToEstimate
    ? () => onSendToEstimate(takeoff, doc)
    : null;

  useEffect(() => {
    onChange?.(doc);
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    onTakeoffChange?.(takeoff);
  }, [takeoff]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Ctx.Provider
      value={{
        doc,
        pages,
        pid,
        setPid,
        page,
        settings,
        setSettings,
        selEl,
        selId,
        setSelId,
        tool,
        setTool,
        color,
        setColor,
        fillColor,
        setFillColor,
        strokeW,
        setStrokeW,
        showGrid,
        setShowGrid,
        gridSize,
        setGridSize,
        snap,
        setSnap,
        zoom,
        setZoom,
        pan,
        setPan,
        canUndo: hs.past.length > 0,
        canRedo: hs.future.length > 0,
        undo,
        redo,
        setEls,
        beginLive,
        endLive,
        mutateSel,
        delSel,
        dupSel,
        rotateSel,
        clearAll,
        addPage,
        delPage,
        updateSelEl,
        view,
        setView,
        layers,
        curLayer,
        setCurLayer,
        toggleLayer,
        visLayers,
        sideTab,
        setSideTab,
        exportPng,
        saveJson,
        loadJson,
        takeoff,
        exportTakeoffCsv,
        copyTakeoff,
        sendToEstimate,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};
