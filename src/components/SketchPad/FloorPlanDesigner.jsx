// src/components/SketchPad/FloorPlanDesigner.jsx   (ENTRY POINT — default export)
// ───────────────────────────────────────────────────────────
// FILE 3 / 3 — USER INTERFACE
//   • tool definitions, left toolbox, top toolbar
//   • sidebar panels (room finishes, cabinets, openings, estimate)
//   • header, root layout, default export <FloorPlanDesigner>
//
// Remodeling floor-plan designer — fully self-contained (2-D canvas + built-in 3-D preview).
//
// v2: irregular (polygon) rooms, per-room finishes (tile / vinyl plank / hardwood / laminate /
//     carpet with real-scale layout patterns, paint, ceiling, baseboard), cabinets with
//     inch-accurate sizes, door/window-aware paint deductions, and a live material take-off.
//
// Props (all optional):
//   initialDoc          { pages, settings }  – restore a saved project
//   onChange(doc)       – called on every edit (autosave to your API here)
//   onTakeoffChange(t)  – live take-off  { rooms, lines, totals, assumptions }
//   onSendToEstimate(t, doc) – shows a "Send to estimate" button
// ───────────────────────────────────────────────────────────

import React, { useState } from "react";
import {
  Camera,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  DoorOpen,
  Download,
  Edit3,
  Eraser,
  Eye,
  EyeOff,
  Grid3x3,
  Hexagon,
  Layers,
  Maximize,
  Maximize2,
  Minus,
  MousePointer,
  Move,
  Pen,
  Plus,
  Redo,
  RotateCw,
  Ruler,
  Save,
  Send,
  Square,
  Trash2,
  Type,
  Undo,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  CABINETS,
  CAB_KINDS,
  FLOOR_MATERIALS,
  FLOOR_ORDER,
  FLOOR_PATTERNS,
  PAINT_SWATCHES,
  PPF,
  autoWaste,
  defaultFloor,
  getFinish,
  polyArea,
  resizeCabinet,
  roomPoints,
} from "./takeoff";
import { DEF_WALL_T, PRESETS, Provider, toFt, useC } from "./FloorPlanStore";
import { Canvas2D, Canvas3D } from "./FloorPlanCanvas";

// ═══════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════
const TOOL_GROUPS = [
  {
    id: "select",
    label: "Select & Navigate",
    tools: [
      {
        id: "select",
        label: "Select",
        icon: <MousePointer size={16} />,
        tip: "Select & Move (V)",
      },
      {
        id: "pan",
        label: "Pan",
        icon: <Move size={16} />,
        tip: "Pan Canvas (H)",
      },
      {
        id: "eraser",
        label: "Eraser",
        icon: <Eraser size={16} />,
        tip: "Erase Element (E)",
      },
    ],
  },
  {
    id: "structural",
    label: "Structure",
    tools: [
      {
        id: "wall",
        label: "Wall",
        icon: <Edit3 size={16} />,
        tip: "Draw Wall (W)",
      },
      {
        id: "room",
        label: "Room",
        icon: <Square size={16} />,
        tip: "Rectangular Room (R)",
      },
      {
        id: "polyroom",
        label: "L-Room",
        icon: <Hexagon size={16} />,
        tip: "Irregular / L-shaped Room (G)",
      },
      {
        id: "door",
        label: "Door",
        icon: <DoorOpen size={16} />,
        tip: "Place Door (D)",
      },
      {
        id: "window",
        label: "Window",
        icon: <Maximize size={16} />,
        tip: "Place Window (N)",
      },
      {
        id: "stairs",
        label: "Stairs",
        icon: <Layers size={16} />,
        tip: "Draw Stairs",
      },
    ],
  },
  {
    id: "cabinets",
    label: "Cabinets",
    tools: Object.entries(CABINETS).map(([id, c]) => ({
      id,
      label:
        c.kind === "island"
          ? "Island"
          : c.sink
          ? `${c.kind === "vanity" ? "Vanity" : "Sink"}`
          : CAB_KINDS[c.kind].label,
      icon: c.kind === "island" ? '72"' : `${c.lenIn}"`,
      tip: `${c.label} (${c.lenIn}"×${c.depthIn}"×${c.heightIn}")`,
    })),
  },
  {
    id: "draw",
    label: "Draw",
    tools: [
      { id: "pen", label: "Pen", icon: <Pen size={16} />, tip: "Freehand (P)" },
      { id: "line", label: "Line", icon: <Minus size={16} />, tip: "Line (L)" },
      {
        id: "rectangle",
        label: "Rectangle",
        icon: <Square size={16} />,
        tip: "Rectangle",
      },
      {
        id: "circle",
        label: "Circle",
        icon: <Circle size={16} />,
        tip: "Circle",
      },
      {
        id: "dimension",
        label: "Dimension",
        icon: <Ruler size={16} />,
        tip: "Dimension Line",
      },
      {
        id: "text",
        label: "Text",
        icon: <Type size={16} />,
        tip: "Text Label (T)",
      },
    ],
  },
  {
    id: "fixtures",
    label: "Fixtures",
    tools: [
      { id: "toilet", label: "Toilet", icon: "🚽", tip: "Place Toilet" },
      { id: "sink", label: "Sink", icon: "🚰", tip: "Place Sink" },
      { id: "bathtub", label: "Bathtub", icon: "🛁", tip: "Place Bathtub" },
      { id: "shower", label: "Shower", icon: "🚿", tip: "Place Shower" },
      { id: "stove", label: "Stove", icon: "🍳", tip: "Place Stove" },
      { id: "fridge", label: "Fridge", icon: "❄️", tip: "Place Fridge" },
    ],
  },
  {
    id: "furniture",
    label: "Furniture",
    tools: [
      { id: "sofa", label: "Sofa", icon: "🛋️", tip: "Place Sofa" },
      { id: "loveseat", label: "Loveseat", icon: "🛋️", tip: "Place Loveseat" },
      { id: "armchair", label: "Armchair", icon: "🪑", tip: "Place Armchair" },
      { id: "bed_q", label: "Queen Bed", icon: "🛏️", tip: "Queen Bed" },
      { id: "bed_t", label: "Twin Bed", icon: "🛏️", tip: "Twin Bed" },
      { id: "desk", label: "Desk", icon: "🖥️", tip: "Place Desk" },
      { id: "table_d", label: "Dining Table", icon: "🍽️", tip: "Dining Table" },
      { id: "table_c", label: "Coffee Table", icon: "☕", tip: "Coffee Table" },
      { id: "dresser", label: "Dresser", icon: "🗄️", tip: "Dresser" },
      { id: "wardrobe", label: "Wardrobe", icon: "👔", tip: "Wardrobe" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// LEFT TOOLBOX
// ═══════════════════════════════════════════════════════════
const ToolSection = ({ group, expanded, toggle }) => {
  const { tool, setTool } = useC();
  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => toggle(group.id)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          background: "rgba(255,255,255,0.06)",
          border: "none",
          color: "rgba(255,255,255,0.7)",
          cursor: "pointer",
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.8px",
          fontFamily: "var(--font-family)",
          marginBottom: expanded ? 4 : 0,
        }}
      >
        {group.label}
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      {expanded && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}
        >
          {group.tools.map((t) => {
            const active = tool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                title={t.tip}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  padding: "8px 4px",
                  background: active
                    ? "linear-gradient(135deg, var(--secondary) 0%, var(--secondary-dark) 100%)"
                    : "rgba(255,255,255,0.06)",
                  border: active ? "none" : "1px solid rgba(255,255,255,0.08)",
                  color: active ? "#fff" : "rgba(255,255,255,0.75)",
                  cursor: "pointer",
                  borderRadius: 8,
                  transition: "all 0.2s",
                  boxShadow: active ? "0 2px 8px rgba(52,152,219,0.4)" : "none",
                  fontFamily: "var(--font-family)",
                  transform: active ? "scale(1.03)" : "scale(1)",
                }}
              >
                <span
                  style={{
                    fontSize: typeof t.icon === "string" ? 14 : "inherit",
                    lineHeight: 1,
                  }}
                >
                  {t.icon}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.4px",
                  }}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Toolbox = () => {
  const {
    color,
    setColor,
    fillColor,
    setFillColor,
    strokeW,
    setStrokeW,
    selEl,
    dupSel,
    delSel,
    rotateSel,
  } = useC();
  const [expanded, setExpanded] = useState({
    select: true,
    structural: true,
    cabinets: false,
    draw: false,
    fixtures: false,
    furniture: false,
  });
  const toggle = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div
      style={{
        width: 130,
        minWidth: 130,
        background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "12px 8px",
        overflowY: "auto",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {TOOL_GROUPS.map((g) => (
        <ToolSection
          key={g.id}
          group={g}
          expanded={expanded[g.id]}
          toggle={toggle}
        />
      ))}

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          margin: "8px 0 4px",
          paddingTop: 8,
        }}
      >
        <div
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.5)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            marginBottom: 6,
          }}
        >
          Stroke
        </div>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{
            width: "100%",
            height: 30,
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6,
            cursor: "pointer",
            padding: 2,
            background: "transparent",
          }}
        />
        <div
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.5)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            marginBottom: 4,
            marginTop: 8,
          }}
        >
          Fill (rooms)
        </div>
        <input
          type="color"
          value={fillColor}
          onChange={(e) => setFillColor(e.target.value)}
          style={{
            width: "100%",
            height: 30,
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6,
            cursor: "pointer",
            padding: 2,
            background: "transparent",
          }}
        />
        <div
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.5)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            marginBottom: 4,
            marginTop: 8,
          }}
        >
          Width: {strokeW}px
        </div>
        <input
          type="range"
          min="1"
          max="16"
          value={strokeW}
          onChange={(e) => setStrokeW(+e.target.value)}
          style={{ width: "100%" }}
        />
      </div>

      {selEl && (
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.1)",
            marginTop: 4,
            paddingTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <button
            onClick={rotateSel}
            title="Rotate 90°"
            style={toolActionBtn("#10b981")}
          >
            <RotateCw size={13} /> Rotate
          </button>
          <button
            onClick={dupSel}
            title="Duplicate"
            style={toolActionBtn("#3b82f6")}
          >
            <Copy size={13} /> Duplicate
          </button>
          <button
            onClick={delSel}
            title="Delete"
            style={toolActionBtn("#ef4444")}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

const toolActionBtn = (clr) => ({
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "7px 10px",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  background: `rgba(${
    clr === "#10b981"
      ? "16,185,129"
      : clr === "#3b82f6"
      ? "59,130,246"
      : "239,68,68"
  },0.15)`,
  color: clr,
  fontSize: 11,
  fontWeight: 600,
  fontFamily: "var(--font-family)",
  transition: "all 0.2s",
});

// ═══════════════════════════════════════════════════════════
// TOP TOOLBAR
// ═══════════════════════════════════════════════════════════
const TopToolbar = () => {
  const {
    zoom,
    setZoom,
    setPan,
    showGrid,
    setShowGrid,
    snap,
    setSnap,
    gridSize,
    setGridSize,
    undo,
    redo,
    canUndo,
    canRedo,
    clearAll,
  } = useC();
  const isDark = document.documentElement.classList.contains("dark");
  const tbStyle = {
    background: isDark ? "rgba(30,41,59,0.95)" : "rgba(255,255,255,0.97)",
    padding: "8px 14px",
    borderRadius: 12,
    display: "flex",
    gap: 8,
    alignItems: "center",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
    backdropFilter: "blur(10px)",
    border: isDark
      ? "1px solid rgba(255,255,255,0.08)"
      : "1px solid rgba(0,0,0,0.08)",
  };
  const btn = (active) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    background: active
      ? "var(--secondary)"
      : isDark
      ? "rgba(255,255,255,0.06)"
      : "rgba(0,0,0,0.05)",
    color: active ? "#fff" : isDark ? "rgba(255,255,255,0.8)" : "#374151",
    transition: "all 0.2s",
    fontFamily: "var(--font-family)",
  });
  const sep = {
    width: 1,
    height: 24,
    background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        display: "flex",
        gap: 10,
      }}
    >
      <div style={tbStyle}>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          style={btn(false)}
          title="Reset View"
        >
          <Maximize2 size={15} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.1, z / 1.25))}
          style={btn(false)}
          title="Zoom Out"
        >
          <ZoomOut size={15} />
        </button>
        <span
          style={{
            fontSize: 13,
            minWidth: 48,
            textAlign: "center",
            fontWeight: 700,
            color: isDark ? "#e2e8f4" : "#1f2937",
            fontFamily: "var(--font-family)",
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(5, z * 1.25))}
          style={btn(false)}
          title="Zoom In"
        >
          <ZoomIn size={15} />
        </button>
        <div style={sep} />
        <button
          onClick={() => setShowGrid(!showGrid)}
          style={btn(showGrid)}
          title="Grid"
        >
          <Grid3x3 size={15} />
        </button>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            color: isDark ? "rgba(255,255,255,0.7)" : "#374151",
            fontFamily: "var(--font-family)",
          }}
        >
          <input
            type="checkbox"
            checked={snap}
            onChange={(e) => setSnap(e.target.checked)}
            style={{ accentColor: "var(--secondary)" }}
          />
          Snap
        </label>
        <select
          value={gridSize}
          onChange={(e) => setGridSize(+e.target.value)}
          style={{
            padding: "4px 6px",
            borderRadius: 6,
            border: isDark
              ? "1px solid rgba(255,255,255,0.15)"
              : "1px solid #d1d5db",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "var(--font-family)",
            background: isDark ? "#1e293b" : "#fff",
            color: isDark ? "#e2e8f4" : "#374151",
          }}
        >
          <option value="5">5px (3")</option>
          <option value="10">10px (6")</option>
          <option value="20">20px (1')</option>
          <option value="40">40px (2')</option>
          <option value="100">100px (5')</option>
        </select>
        <div style={sep} />
        <button
          onClick={undo}
          disabled={!canUndo}
          style={{ ...btn(false), opacity: !canUndo ? 0.35 : 1 }}
          title="Undo (Ctrl+Z)"
        >
          <Undo size={15} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          style={{ ...btn(false), opacity: !canRedo ? 0.35 : 1 }}
          title="Redo"
        >
          <Redo size={15} />
        </button>
        <div style={sep} />
        <button
          onClick={clearAll}
          style={{ ...btn(false), color: "#ef4444" }}
          title="Clear Canvas"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// SIDEBAR PANELS — finishes, cabinets, openings, estimate
// ═══════════════════════════════════════════════════════════
const LBL = {
  fontSize: 10,
  fontWeight: 700,
  color: "var(--text-light)",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  display: "block",
  marginBottom: 3,
  fontFamily: "var(--font-family)",
};
const INP = {
  width: "100%",
  boxSizing: "border-box",
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  fontSize: 13,
  color: "var(--text)",
  background: "var(--surface-raised, #f7f9fc)",
  fontFamily: "var(--font-family)",
};
const CARD = {
  padding: 10,
  background: "var(--background)",
  borderRadius: 8,
  border: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};
const CARD_TITLE = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text)",
  fontFamily: "var(--font-family)",
};
const fmt = (n, d = 1) =>
  Number.isInteger(n) ? String(n) : Number(n).toFixed(d);

const Section = ({ title, children }) => (
  <div style={CARD}>
    <div style={CARD_TITLE}>{title}</div>
    {children}
  </div>
);
const Row = ({ children }) => (
  <div style={{ display: "flex", gap: 8 }}>{children}</div>
);
const Check = ({ label, checked, onChange }) => (
  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 12,
      color: "var(--text)",
      cursor: "pointer",
      fontFamily: "var(--font-family)",
    }}
  >
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onChange(e.target.checked)}
      style={{ accentColor: "var(--secondary)" }}
    />{" "}
    {label}
  </label>
);
const NumField = ({ label, value, onChange, min, step = 1, placeholder }) => (
  <div style={{ flex: 1, minWidth: 0 }}>
    <label style={LBL}>{label}</label>
    <input
      type="number"
      style={INP}
      value={value ?? ""}
      min={min}
      step={step}
      placeholder={placeholder}
      onChange={(e) =>
        onChange(e.target.value === "" ? null : parseFloat(e.target.value))
      }
    />
  </div>
);
const SelectField = ({ label, value, onChange, options }) => (
  <div style={{ flex: 1, minWidth: 0 }}>
    <label style={LBL}>{label}</label>
    <select
      style={INP}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(([v, t]) => (
        <option key={v} value={v}>
          {t}
        </option>
      ))}
    </select>
  </div>
);
const ColorRow = ({ value, onChange, swatches = [] }) => (
  <div
    style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
  >
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 34,
        height: 28,
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 1,
        cursor: "pointer",
        background: "transparent",
      }}
    />
    {swatches.map((c) => (
      <button
        key={c}
        onClick={() => onChange(c)}
        title={c}
        style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          background: c,
          cursor: "pointer",
          border:
            c === value
              ? "2px solid var(--secondary)"
              : "1px solid var(--border)",
          padding: 0,
        }}
      />
    ))}
  </div>
);

const RoomFinishPanel = ({ el }) => {
  const { updateSelEl, takeoff } = useC();
  const fin = getFinish(el);
  const res = takeoff.rooms.find((r) => r.id === el.id);
  const setGroup = (group, patch) =>
    updateSelEl("finish", { ...fin, [group]: { ...fin[group], ...patch } });
  const setTop = (patch) => updateSelEl("finish", { ...fin, ...patch });
  const f = fin.floor;
  const isTile = f.material === "tile";
  const numOrKeep = (key, v) =>
    v != null && v > 0 && setGroup("floor", { [key]: v });

  return (
    <>
      <Section title="Flooring">
        <SelectField
          label="Material"
          value={f.material}
          onChange={(m) =>
            setTop({
              floor: defaultFloor(m, {
                pattern: f.pattern || "straight",
                angle: f.angle || 0,
              }),
            })
          }
          options={FLOOR_ORDER.map((m) => [m, FLOOR_MATERIALS[m].label])}
        />
        {f.material !== "none" && (
          <>
            {f.material !== "carpet" && (
              <>
                <Row>
                  <NumField
                    label={isTile ? "Tile width (in)" : "Plank width (in)"}
                    value={f.w}
                    step={0.25}
                    min={0.25}
                    onChange={(v) => numOrKeep("w", v)}
                  />
                  <NumField
                    label={isTile ? "Tile length (in)" : "Plank length (in)"}
                    value={f.l}
                    step={0.25}
                    min={0.25}
                    onChange={(v) => numOrKeep("l", v)}
                  />
                </Row>
                <Row>
                  <SelectField
                    label="Layout"
                    value={f.pattern}
                    onChange={(v) => setGroup("floor", { pattern: v })}
                    options={Object.entries(FLOOR_PATTERNS).map(([v, p]) => [
                      v,
                      p.label,
                    ])}
                  />
                  <SelectField
                    label="Run direction"
                    value={String(f.angle || 0)}
                    onChange={(v) => setGroup("floor", { angle: +v })}
                    options={[
                      ["0", "Horizontal"],
                      ["90", "Vertical"],
                      ["45", "45° (rotated)"],
                    ]}
                  />
                </Row>
              </>
            )}
            {isTile && (
              <Row>
                <NumField
                  label="Grout joint (in)"
                  value={f.jointIn}
                  step={0.0625}
                  min={0}
                  onChange={(v) =>
                    v != null && setGroup("floor", { jointIn: v })
                  }
                />
                <NumField
                  label="Tile thickness (in)"
                  value={f.thicknessIn}
                  step={0.0625}
                  min={0.1}
                  onChange={(v) => numOrKeep("thicknessIn", v)}
                />
              </Row>
            )}
            <Row>
              {f.material !== "carpet" && (
                <NumField
                  label="Sq ft per box"
                  value={f.boxSqft}
                  step={0.1}
                  min={0}
                  onChange={(v) => setGroup("floor", { boxSqft: v })}
                />
              )}
              <NumField
                label="Waste %"
                value={f.waste}
                step={1}
                min={0}
                placeholder={`auto ${autoWaste(f)}`}
                onChange={(v) => setGroup("floor", { waste: v })}
              />
            </Row>
            <div>
              <label style={LBL}>Colour</label>
              <ColorRow
                value={f.color}
                onChange={(c) => setGroup("floor", { color: c })}
                swatches={FLOOR_MATERIALS[f.material].swatches}
              />
            </div>
            <Check
              label={
                f.material === "carpet"
                  ? "Carpet pad (+5%)"
                  : "Underlayment (+5%)"
              }
              checked={f.underlayment}
              onChange={(v) => setGroup("floor", { underlayment: v })}
            />
            <Check
              label="Don't run under cabinets / tub"
              checked={fin.deductFixed}
              onChange={(v) => setTop({ deductFixed: v })}
            />
            <Section title="Installation planning">
              <div style={{ fontSize: 11, color: "var(--text-light)", lineHeight: 1.45, marginBottom: 6 }}>
                Turn on the work items you want included in the material take-off. Quantities follow this room's net floor area.
              </div>
              <Check
                label="Subfloor preparation / cleaning"
                checked={!!f.subfloorPrep}
                onChange={(v) => setGroup("floor", { subfloorPrep: v })}
              />
              <Check
                label="Floor leveling compound"
                checked={!!f.floorLeveling}
                onChange={(v) => setGroup("floor", { floorLeveling: v })}
              />
              {isTile && (
                <>
                  <Check
                    label="Waterproofing membrane (wet areas)"
                    checked={!!f.waterproofing}
                    onChange={(v) => setGroup("floor", { waterproofing: v })}
                  />
                  <Check
                    label="Crack-isolation membrane"
                    checked={!!f.crackIsolation}
                    onChange={(v) => setGroup("floor", { crackIsolation: v })}
                  />
                </>
              )}
            </Section>
            {res?.floor && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text)",
                  lineHeight: 1.6,
                  fontFamily: "var(--font-family)",
                }}
              >
                Net <b>{fmt(res.floor.netSqft)}</b> sf + {res.floor.wastePct}% →
                order <b>{fmt(res.floor.orderSqft)}</b> sf
                {res.floor.boxes != null && (
                  <>
                    {" "}
                    · <b>{res.floor.boxes}</b> boxes
                  </>
                )}
                {res.floor.sqYd != null && (
                  <>
                    {" "}
                    · <b>{fmt(res.floor.sqYd)}</b> sq yd
                  </>
                )}
                {res.floor.deductSqft > 0 && (
                  <div style={{ color: "var(--text-light)" }}>
                    Cabinet/tub footprint deducted: {fmt(res.floor.deductSqft)}{" "}
                    sf
                  </div>
                )}
                {(res.floor.subfloorPrepSqft > 0 || res.floor.floorLevelingSqft > 0 || res.floor.waterproofingSqft > 0 || res.floor.crackIsolationSqft > 0) && (
                  <div style={{ color: "var(--secondary)", marginTop: 4 }}>
                    Install prep: {res.floor.subfloorPrepSqft > 0 ? "subfloor · " : ""}
                    {res.floor.floorLevelingSqft > 0 ? "leveling · " : ""}
                    {res.floor.waterproofingSqft > 0 ? "waterproofing · " : ""}
                    {res.floor.crackIsolationSqft > 0 ? "crack isolation" : ""}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="Wall paint">
        <Check
          label="Paint the walls of this room"
          checked={fin.walls.paint}
          onChange={(v) => setGroup("walls", { paint: v })}
        />
        {fin.walls.paint && (
          <>
            <ColorRow
              value={fin.walls.color}
              onChange={(c) => setGroup("walls", { color: c })}
              swatches={PAINT_SWATCHES}
            />
            <Row>
              <SelectField
                label="Coats"
                value={String(fin.walls.coats)}
                onChange={(v) => setGroup("walls", { coats: +v })}
                options={[
                  ["1", "1 coat"],
                  ["2", "2 coats"],
                  ["3", "3 coats"],
                ]}
              />
              <NumField
                label="Wall height (ft)"
                value={fin.wallHeightFt}
                step={0.5}
                min={4}
                placeholder="project"
                onChange={(v) => setTop({ wallHeightFt: v })}
              />
            </Row>
            <Check
              label="Add primer coat"
              checked={fin.walls.primer}
              onChange={(v) => setGroup("walls", { primer: v })}
            />
            {res?.walls && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text)",
                  lineHeight: 1.6,
                  fontFamily: "var(--font-family)",
                }}
              >
                {fmt(res.walls.grossSqft)} sf − {fmt(res.walls.openingsSqft)} sf
                openings ({res.walls.doors} door, {res.walls.windows} window) ={" "}
                <b>{fmt(res.walls.netSqft)}</b> sf →{" "}
                <b>{fmt(res.walls.gallons, 2)}</b> gal
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="Ceiling & trim">
        <Check
          label="Paint the ceiling"
          checked={fin.ceiling.paint}
          onChange={(v) => setGroup("ceiling", { paint: v })}
        />
        {fin.ceiling.paint && (
          <Row>
            <div style={{ flex: 1 }}>
              <label style={LBL}>Ceiling colour</label>
              <ColorRow
                value={fin.ceiling.color}
                onChange={(c) => setGroup("ceiling", { color: c })}
              />
            </div>
            <SelectField
              label="Coats"
              value={String(fin.ceiling.coats)}
              onChange={(v) => setGroup("ceiling", { coats: +v })}
              options={[
                ["1", "1"],
                ["2", "2"],
              ]}
            />
          </Row>
        )}
        <Check
          label="Baseboard"
          checked={fin.baseboard.enabled}
          onChange={(v) => setGroup("baseboard", { enabled: v })}
        />
        {fin.baseboard.enabled && (
          <Row>
            <NumField
              label="Height (in)"
              value={fin.baseboard.heightIn}
              step={0.5}
              min={2}
              onChange={(v) =>
                v != null && setGroup("baseboard", { heightIn: v })
              }
            />
            <div style={{ flex: 1 }}>
              <label style={LBL}>Colour</label>
              <ColorRow
                value={fin.baseboard.color}
                onChange={(c) => setGroup("baseboard", { color: c })}
              />
            </div>
          </Row>
        )}
        {res?.baseboard && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text)",
              fontFamily: "var(--font-family)",
            }}
          >
            Baseboard: <b>{fmt(res.baseboard.lf)}</b> LF (doorways deducted) →
            order <b>{fmt(res.baseboard.orderLf)}</b> LF
          </div>
        )}
      </Section>
    </>
  );
};

const CabinetPanel = ({ el }) => {
  const { mutateSel } = useC();
  const patch = (p) => mutateSel((e) => resizeCabinet(e, p));
  const pos = (v) => v != null && v > 0;
  return (
    <Section title={`Cabinet · ${CAB_KINDS[el.kind]?.label || el.kind}`}>
      <Row>
        <NumField
          label="Width (in)"
          value={el.lenIn}
          step={0.5}
          min={6}
          onChange={(v) => pos(v) && patch({ lenIn: v })}
        />
        <NumField
          label="Depth (in)"
          value={el.depthIn}
          step={0.5}
          min={6}
          onChange={(v) => pos(v) && patch({ depthIn: v })}
        />
      </Row>
      <Row>
        <NumField
          label="Height (in)"
          value={el.heightIn}
          step={0.5}
          min={6}
          onChange={(v) => pos(v) && patch({ heightIn: v })}
        />
        {el.kind === "wall" && (
          <NumField
            label="Mount height (in)"
            value={el.mountIn}
            step={0.5}
            min={0}
            onChange={(v) => v != null && patch({ mountIn: v })}
          />
        )}
      </Row>
      <Row>
        <SelectField
          label="Front faces"
          value={el.facing || "s"}
          onChange={(v) => patch({ facing: v })}
          options={[
            ["s", "Down"],
            ["n", "Up"],
            ["e", "Right"],
            ["w", "Left"],
          ]}
        />
        <SelectField
          label="Door style"
          value={el.style || "shaker"}
          onChange={(v) => mutateSel((e) => ({ ...e, style: v }))}
          options={[
            ["shaker", "Shaker"],
            ["flat", "Flat slab"],
            ["raised", "Raised panel"],
            ["glass", "Glass front"],
          ]}
        />
      </Row>
      <Check
        label="Has sink"
        checked={el.sink}
        onChange={(v) => mutateSel((e) => ({ ...e, sink: v }))}
      />
      <div
        style={{
          fontSize: 11,
          color: "var(--text-light)",
          fontFamily: "var(--font-family)",
        }}
      >
        Tip: press Duplicate to add the next cabinet flush beside this one.
      </div>
    </Section>
  );
};

const OpeningPanel = ({ el }) => {
  const { updateSelEl, settings } = useC();
  const dflt =
    el.type === "door" ? settings.doorHeightIn : settings.windowHeightIn;
  return (
    <Section title={el.type === "door" ? "Door" : "Window"}>
      <NumField
        label="Opening height (in)"
        value={el.heightIn}
        step={1}
        min={12}
        placeholder={`project ${dflt}`}
        onChange={(v) => updateSelEl("heightIn", v)}
      />
      <div
        style={{
          fontSize: 11,
          color: "var(--text-light)",
          fontFamily: "var(--font-family)",
        }}
      >
        Deducted from wall paint, and doors from baseboard, in every room whose
        outline they sit on.
      </div>
    </Section>
  );
};

const EstimatePanel = () => {
  const {
    takeoff,
    settings,
    setSettings,
    exportTakeoffCsv,
    copyTakeoff,
    sendToEstimate,
  } = useC();
  const t = takeoff.totals;
  const cats = [...new Set(takeoff.lines.map((l) => l.category))];
  const tile = (label, value, unit) => (
    <div
      style={{
        background: "var(--background)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "8px 10px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "var(--text-light)",
          fontWeight: 700,
          fontFamily: "var(--font-family)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 800,
          color: "var(--text)",
          fontFamily: "var(--font-family)",
        }}
      >
        {value}
        <span
          style={{ fontSize: 11, fontWeight: 600, color: "var(--text-light)" }}
        >
          {" "}
          {unit}
        </span>
      </div>
    </div>
  );
  const btn = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    padding: "8px 6px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--background)",
    color: "var(--text)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--font-family)",
  };
  const set = (k) => (v) => v != null && v > 0 && setSettings({ [k]: v });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {tile("Flooring to order", fmt(t.floorOrderSqft, 0), "sf")}
        {tile("Wall paint", fmt(t.wallGallons, 1), "gal")}
        {tile("Baseboard", fmt(t.baseboardLf, 0), "LF")}
        {tile("Cabinets", t.cabinetCount, "pcs")}
        {tile("Countertop", fmt(t.countertopSqft, 0), "sf")}
        {tile("Transitions", t.transitions, "pcs")}
        {tile("Floor prep", fmt(t.floorPrepSqft || 0, 0), "sf")}
        {tile("Membranes", fmt(t.membraneSqft || 0, 0), "sf")}
      </div>

      {takeoff.lines.length === 0 && (
        <div
          style={{
            ...CARD,
            fontSize: 12,
            color: "var(--text-light)",
            fontFamily: "var(--font-family)",
            lineHeight: 1.6,
          }}
        >
          Draw a room, select it, then pick a floor material, paint or baseboard
          in Properties. Add cabinets from the Cabinets tools. Quantities appear
          here live.
        </div>
      )}

      {cats.map((cat) => (
        <Section key={cat} title={cat}>
          {takeoff.lines
            .filter((l) => l.category === cat)
            .map((l, i) => (
              <div
                key={i}
                style={{
                  fontSize: 12,
                  fontFamily: "var(--font-family)",
                  color: "var(--text)",
                  borderBottom: "1px dashed var(--border)",
                  paddingBottom: 5,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>{l.item}</span>
                  <b style={{ whiteSpace: "nowrap" }}>
                    {fmt(l.qty, 2)} {l.unit}
                  </b>
                </div>
                {l.note && (
                  <div
                    style={{
                      fontSize: 10.5,
                      color: "var(--text-light)",
                      marginTop: 2,
                    }}
                  >
                    {l.note}
                  </div>
                )}
              </div>
            ))}
        </Section>
      ))}

      {takeoff.rooms.length > 0 && (
        <Section title="By room">
          {takeoff.rooms.map((r) => (
            <div
              key={r.id}
              style={{
                fontSize: 12,
                fontFamily: "var(--font-family)",
                color: "var(--text)",
              }}
            >
              <b>{r.name}</b> — {fmt(r.areaSqft)} sf · {fmt(r.perimeterFt)} ft
              perimeter
              <div style={{ fontSize: 11, color: "var(--text-light)" }}>
                {r.floor
                  ? `${FLOOR_MATERIALS[r.floor.material].short} ${
                      r.floor.wastePct
                    }% waste → ${fmt(r.floor.orderSqft)} sf`
                  : "no flooring"}
                {r.floor?.subfloorPrepSqft > 0 ? " · prep" : ""}
                {r.floor?.floorLevelingSqft > 0 ? " · level" : ""}
                {r.floor?.waterproofingSqft > 0 ? " · waterproof" : ""}
                {r.walls ? ` · walls ${fmt(r.walls.netSqft, 0)} sf` : ""}
                {r.baseboard ? ` · base ${fmt(r.baseboard.lf, 0)} LF` : ""}
              </div>
            </div>
          ))}
        </Section>
      )}

      <Section title="Project settings">
        <Row>
          <NumField
            label="Ceiling (ft)"
            value={settings.ceilingFt}
            step={0.5}
            onChange={set("ceilingFt")}
          />
          <NumField
            label="Door height (in)"
            value={settings.doorHeightIn}
            onChange={set("doorHeightIn")}
          />
        </Row>
        <Row>
          <NumField
            label="Window height (in)"
            value={settings.windowHeightIn}
            onChange={set("windowHeightIn")}
          />
          <NumField
            label="Paint sf / gal"
            value={settings.paintCoverage}
            onChange={set("paintCoverage")}
          />
        </Row>
        <Row>
          <NumField
            label="Backsplash (in)"
            value={settings.backsplashHeightIn}
            onChange={set("backsplashHeightIn")}
          />
          <NumField
            label="Trim waste %"
            value={settings.trimWastePct}
            onChange={(v) =>
              v != null && v >= 0 && setSettings({ trimWastePct: v })
            }
          />
        </Row>
      </Section>

      <div style={{ display: "flex", gap: 6 }}>
        <button style={btn} onClick={copyTakeoff}>
          <Copy size={13} /> JSON
        </button>
        <button style={btn} onClick={exportTakeoffCsv}>
          <Download size={13} /> CSV
        </button>
        {sendToEstimate && (
          <button
            style={{
              ...btn,
              background: "var(--secondary)",
              color: "#fff",
              border: "none",
            }}
            onClick={sendToEstimate}
          >
            <Send size={13} /> Send
          </button>
        )}
      </div>

      <details
        style={{
          fontSize: 11,
          color: "var(--text-light)",
          fontFamily: "var(--font-family)",
          lineHeight: 1.6,
        }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>
          How these numbers are worked out
        </summary>
        <ul style={{ paddingLeft: 16, margin: "6px 0 0" }}>
          {takeoff.assumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </details>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════
const Sidebar = () => {
  const {
    selEl,
    updateSelEl,
    pages,
    pid,
    setPid,
    addPage,
    delPage,
    layers,
    curLayer,
    setCurLayer,
    toggleLayer,
    sideTab,
    setSideTab,
  } = useC();
  // Extract needed values for use in conditional renders
  const ctxLayers = layers;
  const ctxPages = pages;
  const sb = {
    width: 300,
    minWidth: 300,
    background: "var(--surface)",
    borderLeft: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    overflowY: "hidden",
  };
  const tabStyle = (active) => ({
    flex: 1,
    padding: "10px 4px",
    border: "none",
    cursor: "pointer",
    fontFamily: "var(--font-family)",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.3px",
    background: active ? "var(--secondary)" : "transparent",
    color: active ? "#fff" : "var(--text-light)",
    borderBottom: active ? "none" : "2px solid var(--border)",
    transition: "all 0.2s",
  });
  const lbl = {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-light)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    display: "block",
    marginBottom: 4,
    fontFamily: "var(--font-family)",
  };
  const inp = {
    width: "100%",
    padding: "7px 10px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    fontSize: 13,
    color: "var(--text)",
    background: "var(--surface-raised, #f7f9fc)",
    fontFamily: "var(--font-family)",
  };

  return (
    <div style={sb}>
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {[
          ["props", "Properties"],
          ["estimate", "Estimate"],
          ["layers", "Layers"],
          ["pages", "Pages"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSideTab(id)}
            style={tabStyle(sideTab === id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {/* PROPERTIES */}
        {sideTab === "props" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {selEl ? (
              <>
                <div
                  style={{
                    padding: 12,
                    background:
                      "linear-gradient(135deg,var(--secondary),var(--secondary-dark))",
                    borderRadius: 10,
                    color: "#fff",
                    fontFamily: "var(--font-family)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.8,
                      marginBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.7px",
                    }}
                  >
                    Selected
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    {selEl.type === "preset"
                      ? PRESETS[selEl.subtype]?.label || selEl.type
                      : selEl.type === "cabinet"
                      ? selEl.label || "Cabinet"
                      : selEl.type === "room"
                      ? selEl.label || "Room"
                      : selEl.type.charAt(0).toUpperCase() +
                        selEl.type.slice(1)}
                  </div>
                </div>
                {/* Color */}
                {selEl.color !== undefined && (
                  <div>
                    <label style={lbl}>Color</label>
                    <input
                      type="color"
                      value={selEl.color || "#2c3e50"}
                      onChange={(e) => updateSelEl("color", e.target.value)}
                      style={{
                        width: "100%",
                        height: 36,
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        padding: 2,
                      }}
                    />
                  </div>
                )}
                {/* Fill */}
                {selEl.fillColor !== undefined && (
                  <div>
                    <label style={lbl}>Fill Color</label>
                    <input
                      type="color"
                      value={selEl.fillColor || "#dbeafe"}
                      onChange={(e) => updateSelEl("fillColor", e.target.value)}
                      style={{
                        width: "100%",
                        height: 36,
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        padding: 2,
                      }}
                    />
                  </div>
                )}
                {/* Room label */}
                {selEl.type === "room" && (
                  <div>
                    <label style={lbl}>Room Label</label>
                    <input
                      style={inp}
                      value={selEl.label || ""}
                      onChange={(e) => updateSelEl("label", e.target.value)}
                      placeholder="e.g. Living Room"
                    />
                  </div>
                )}
                {selEl.type === "room" && <RoomFinishPanel el={selEl} />}
                {selEl.type === "cabinet" && <CabinetPanel el={selEl} />}
                {(selEl.type === "door" || selEl.type === "window") && (
                  <OpeningPanel el={selEl} />
                )}
                {/* Stroke width */}
                {selEl.strokeWidth !== undefined && (
                  <div>
                    <label style={lbl}>
                      Stroke Width: {selEl.strokeWidth}px
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={selEl.strokeWidth}
                      onChange={(e) =>
                        updateSelEl("strokeWidth", +e.target.value)
                      }
                      style={{ width: "100%", accentColor: "var(--secondary)" }}
                    />
                  </div>
                )}
                {/* Wall thickness */}
                {selEl.type === "wall" && (
                  <div>
                    <label style={lbl}>
                      Wall Thickness: {selEl.thickness || DEF_WALL_T}px
                    </label>
                    <input
                      type="range"
                      min="6"
                      max="40"
                      value={selEl.thickness || DEF_WALL_T}
                      onChange={(e) =>
                        updateSelEl("thickness", +e.target.value)
                      }
                      style={{ width: "100%", accentColor: "var(--secondary)" }}
                    />
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-light)",
                        marginTop: 4,
                        fontFamily: "var(--font-family)",
                      }}
                    >
                      ≈ {toFt(selEl.thickness || DEF_WALL_T)} thick
                    </div>
                  </div>
                )}
                {/* Stairs steps */}
                {selEl.type === "stairs" && (
                  <div>
                    <label style={lbl}>Steps: {selEl.steps || 8}</label>
                    <input
                      type="range"
                      min="3"
                      max="20"
                      value={selEl.steps || 8}
                      onChange={(e) => updateSelEl("steps", +e.target.value)}
                      style={{ width: "100%", accentColor: "var(--secondary)" }}
                    />
                  </div>
                )}
                {/* Text properties */}
                {selEl.type === "text" && (
                  <>
                    <div>
                      <label style={lbl}>Text Content</label>
                      <input
                        style={inp}
                        value={selEl.text || ""}
                        onChange={(e) => updateSelEl("text", e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={lbl}>
                        Font Size: {selEl.fontSize || 16}px
                      </label>
                      <input
                        type="range"
                        min="8"
                        max="72"
                        value={selEl.fontSize || 16}
                        onChange={(e) =>
                          updateSelEl("fontSize", +e.target.value)
                        }
                        style={{
                          width: "100%",
                          accentColor: "var(--secondary)",
                        }}
                      />
                    </div>
                  </>
                )}
                {/* Dimensions readout */}
                {selEl.start && selEl.end && (
                  <div
                    style={{
                      padding: 10,
                      background: "var(--background)",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        color: "var(--text-light)",
                        marginBottom: 6,
                        fontFamily: "var(--font-family)",
                      }}
                    >
                      Dimensions
                    </div>
                    {["wall", "line", "door", "window"].includes(
                      selEl.type,
                    ) && (
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--text)",
                          fontFamily: "var(--font-family)",
                        }}
                      >
                        Length:{" "}
                        <b>
                          {toFt(
                            Math.hypot(
                              selEl.end.x - selEl.start.x,
                              selEl.end.y - selEl.start.y,
                            ),
                          )}
                        </b>
                      </div>
                    )}
                    {["room", "rectangle", "stairs"].includes(selEl.type) && (
                      <>
                        <div
                          style={{
                            fontSize: 13,
                            color: "var(--text)",
                            fontFamily: "var(--font-family)",
                          }}
                        >
                          W:{" "}
                          <b>{toFt(Math.abs(selEl.end.x - selEl.start.x))}</b>
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "var(--text)",
                            fontFamily: "var(--font-family)",
                          }}
                        >
                          H:{" "}
                          <b>{toFt(Math.abs(selEl.end.y - selEl.start.y))}</b>
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "var(--text)",
                            fontFamily: "var(--font-family)",
                          }}
                        >
                          Area:{" "}
                          <b>
                            {(selEl.type === "room"
                              ? polyArea(roomPoints(selEl)) / (PPF * PPF)
                              : (Math.abs(selEl.end.x - selEl.start.x) / PPF) *
                                (Math.abs(selEl.end.y - selEl.start.y) / PPF)
                            ).toFixed(1)}{" "}
                            sq ft
                          </b>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {selEl.w !== undefined && (
                  <div
                    style={{
                      padding: 10,
                      background: "var(--background)",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        color: "var(--text-light)",
                        marginBottom: 6,
                        fontFamily: "var(--font-family)",
                      }}
                    >
                      Dimensions
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text)",
                        fontFamily: "var(--font-family)",
                      }}
                    >
                      W: <b>{toFt(selEl.w)}</b>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text)",
                        fontFamily: "var(--font-family)",
                      }}
                    >
                      H: <b>{toFt(selEl.h)}</b>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  padding: 16,
                  background:
                    "linear-gradient(135deg,var(--secondary),var(--secondary-dark))",
                  borderRadius: 12,
                  color: "#fff",
                  fontFamily: "var(--font-family)",
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>✏️</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  Floor Plan Designer
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.6 }}>
                  Select a tool from the left panel to start drawing. Click any
                  element to edit its properties here.
                </div>
              </div>
            )}
            {/* Quick tip */}
            <div
              style={{
                padding: 10,
                background: "var(--background)",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontFamily: "var(--font-family)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "var(--text-light)",
                  marginBottom: 6,
                }}
              >
                Shortcuts
              </div>
              {[
                ["Ctrl+Z / Y", "Undo / redo"],
                ["Del", "Delete selected"],
                ["Esc", "Deselect / cancel"],
                ["W R G D N", "Wall, room, L-room, door, window"],
                ["Scroll", "Zoom in/out"],
                ["Middle-drag", "Pan canvas"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "var(--text)",
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{
                      background: "var(--surface-raised,#f0f4f8)",
                      padding: "1px 5px",
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    {k}
                  </span>
                  <span style={{ color: "var(--text-light)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LAYERS */}
        {sideTab === "layers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ctxLayers.map((layer) => {
              const isActive = curLayer === layer.id;
              return (
                <div
                  key={layer.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: isActive
                      ? "var(--info-bg, rgba(52,152,219,0.08))"
                      : "var(--background)",
                    border: isActive
                      ? "1px solid var(--secondary)"
                      : "1px solid var(--border)",
                    borderRadius: 10,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onClick={() => setCurLayer(layer.id)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLayer(layer.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: layer.visible
                        ? "var(--secondary)"
                        : "var(--text-muted)",
                      padding: 0,
                    }}
                  >
                    {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 500,
                      color: "var(--text)",
                      fontFamily: "var(--font-family)",
                    }}
                  >
                    {layer.name}
                  </span>
                  {isActive && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--secondary)",
                        fontWeight: 700,
                        fontFamily: "var(--font-family)",
                      }}
                    >
                      Active
                    </span>
                  )}
                </div>
              );
            })}
            <p
              style={{
                fontSize: 11,
                color: "var(--text-light)",
                fontFamily: "var(--font-family)",
                lineHeight: 1.6,
                marginTop: 4,
              }}
            >
              Click a layer to make it active. Eye icon toggles visibility.
            </p>
          </div>
        )}

        {sideTab === "estimate" && <EstimatePanel />}

        {/* PAGES */}
        {sideTab === "pages" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={addPage}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                background:
                  "linear-gradient(135deg,var(--secondary),var(--secondary-dark))",
                border: "none",
                color: "#fff",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "var(--font-family)",
                marginBottom: 4,
              }}
            >
              <Plus size={16} /> Add Floor
            </button>
            {ctxPages.map((pg) => (
              <div
                key={pg.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background:
                    pid === pg.id
                      ? "var(--info-bg, rgba(52,152,219,0.08))"
                      : "var(--background)",
                  border:
                    pid === pg.id
                      ? "1px solid var(--secondary)"
                      : "1px solid var(--border)",
                  borderRadius: 10,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onClick={() => setPid(pg.id)}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: pid === pg.id ? 700 : 500,
                    color: "var(--text)",
                    fontFamily: "var(--font-family)",
                  }}
                >
                  {pg.name}
                </span>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-light)",
                      fontFamily: "var(--font-family)",
                    }}
                  >
                    {pg.elements.length} el
                  </span>
                  {ctxPages.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        delPage(pg.id);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--error)",
                        cursor: "pointer",
                        padding: "0 2px",
                        fontSize: 16,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════
const Header = () => {
  const { view, setView, exportPng, saveJson, loadJson, sendToEstimate } =
    useC();
  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
        color: "#fff",
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        zIndex: 50,
        boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 22 }}>📐</span>
        <div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: "0.3px",
              fontFamily: "var(--font-family)",
            }}
          >
            Floor Plan Designer
          </div>
          <div
            style={{
              fontSize: 10,
              opacity: 0.7,
              fontWeight: 500,
              fontFamily: "var(--font-family)",
              letterSpacing: "0.5px",
            }}
          >
            REMODELING STUDIO
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div
        style={{
          display: "flex",
          gap: 0,
          background: "rgba(255,255,255,0.12)",
          borderRadius: 10,
          padding: 3,
        }}
      >
        {[
          ["2d", "✏️ 2D Plan"],
          ["3d", "🏠 3D View"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            style={{
              padding: "7px 18px",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              background: view === id ? "#fff" : "transparent",
              color: view === id ? "var(--primary)" : "rgba(255,255,255,0.8)",
              fontWeight: view === id ? 700 : 500,
              fontSize: 13,
              transition: "all 0.25s",
              fontFamily: "var(--font-family)",
              boxShadow: view === id ? "0 2px 6px rgba(0,0,0,0.15)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {sendToEstimate && (
          <button
            onClick={sendToEstimate}
            style={{ ...hBtn, background: "var(--secondary)", border: "none" }}
          >
            <Send size={15} /> Send to estimate
          </button>
        )}
        <button onClick={exportPng} style={hBtn}>
          <Camera size={15} /> Export PNG
        </button>
        <button onClick={saveJson} style={hBtn}>
          <Save size={15} /> Save
        </button>
        <label style={{ cursor: "pointer" }}>
          <input
            type="file"
            accept=".json"
            onChange={loadJson}
            style={{ display: "none" }}
          />
          <div style={hBtn}>
            <Download size={15} /> Load
          </div>
        </label>
      </div>
    </div>
  );
};

const hBtn = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  background: "rgba(255,255,255,0.15)",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "#fff",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  transition: "all 0.2s",
  fontFamily: "var(--font-family)",
};

// ═══════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════
const AppInner = () => {
  const { view } = useC();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        fontFamily: "var(--font-family)",
        background: "var(--background)",
        overflow: "hidden",
      }}
    >
      <Header />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {view === "2d" && <Toolbox />}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {view === "2d" && (
            <>
              <TopToolbar />
              <Canvas2D />
            </>
          )}
          {view === "3d" && <Canvas3D />}
        </div>
        <Sidebar />
      </div>
    </div>
  );
};

const FloorPlanDesigner = (props) => (
  <Provider {...props}>
    <AppInner />
  </Provider>
);

export default FloorPlanDesigner;
