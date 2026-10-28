// src/components/SketchPad/FloorPlanCanvas.jsx
// ───────────────────────────────────────────────────────────
// FILE 2 / 3 — RENDERING & INTERACTION
//   • pure canvas 2-D drawing (walls, rooms, floor patterns, cabinets, symbols)
//   • built-in 3-D perspective preview  (<Canvas3D>)
//   • 2-D editor with mouse / keyboard tools  (<Canvas2D>)
// ───────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";
import {
  CABINETS,
  CAB_KINDS,
  FLOOR_MATERIALS,
  PPF,
  PX_PER_IN,
  bboxOf,
  defaultFinish,
  getFinish,
  makeCabinet,
  pointInPoly,
  polyArea,
  polyCentroid,
  projectOnSeg,
  roomPoints,
} from "./takeoff";
import {
  DEF_WALL_T,
  PRESETS,
  PRESET_H_IN,
  snapV,
  toFt,
  translateEl,
  useC,
} from "./FloorPlanStore";

// ═══════════════════════════════════════════════════════════
// ELEMENT DRAWING  (pure canvas 2-D)
// ═══════════════════════════════════════════════════════════
const drawMeasure = (ctx, ax, ay, bx, by, zoom) => {
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 15 * zoom) return;
  const mx = (ax + bx) / 2,
    my = (ay + by) / 2;
  const ang = Math.atan2(by - ay, bx - ax);
  const label = toFt(len / zoom);
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(ang);
  if (Math.abs(ang) > Math.PI / 2) ctx.rotate(Math.PI);
  ctx.font = `bold ${11 / zoom}px Poppins, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(-tw / 2 - 3 / zoom, -16 / zoom, tw + 6 / zoom, 13 / zoom);
  ctx.fillStyle = "#2c3e50";
  ctx.fillText(label, 0, -4 / zoom);
  ctx.restore();
};

const drawPresetSymbol = (ctx, el, zoom) => {
  const { x, y, w, h, sym, fill, stroke, label } = el;
  const lw = 1.5 / zoom;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;

  if (sym === "toilet") {
    // Tank (top)
    const th = h * 0.3;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, th, [3 / zoom]);
    ctx.fill();
    ctx.stroke();
    // Bowl (oval)
    ctx.beginPath();
    ctx.ellipse(
      x + w / 2,
      y + th + (h - th) * 0.5,
      w * 0.45,
      (h - th) * 0.45,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.stroke();
  } else if (sym === "sink") {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, [6 / zoom]);
    ctx.fill();
    ctx.stroke();
    // drain
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 4 / zoom, 0, Math.PI * 2);
    ctx.fillStyle = stroke;
    ctx.fill();
    // faucet line
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 8 / zoom);
    ctx.lineTo(x + w / 2, y + h / 2 - 5 / zoom);
    ctx.stroke();
  } else if (sym === "bathtub") {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, [8 / zoom]);
    ctx.fill();
    ctx.stroke();
    // inner
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.55, w * 0.35, h * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fill();
    ctx.stroke();
    // faucet
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 12 / zoom, 5 / zoom, 0, Math.PI * 2);
    ctx.fill();
  } else if (sym === "shower") {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    // diagonal lines
    ctx.strokeStyle = stroke + "60";
    ctx.lineWidth = 1 / zoom;
    for (let i = 0; i < 5; i++) {
      const off = ((w + h) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.min(off, w), y + Math.max(0, off - w));
      ctx.lineTo(x + Math.max(0, off - h), y + Math.min(off, h));
      ctx.stroke();
    }
    // showerhead
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(x + w * 0.2, y + h * 0.2, 5 / zoom, 0, Math.PI * 2);
    ctx.stroke();
  } else if (sym === "stove") {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    // 4 burners
    const bx = [x + w * 0.3, x + w * 0.7, x + w * 0.3, x + w * 0.7];
    const by = [y + h * 0.3, y + h * 0.3, y + h * 0.7, y + h * 0.7];
    bx.forEach((bxi, i) => {
      ctx.beginPath();
      ctx.arc(bxi, by[i], 7 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = "#f97316";
      ctx.fill();
      ctx.stroke();
    });
  } else if (sym === "fridge") {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, [4 / zoom]);
    ctx.fill();
    ctx.stroke();
    // handle
    ctx.beginPath();
    ctx.moveTo(x + w * 0.7, y + h * 0.15);
    ctx.lineTo(x + w * 0.7, y + h * 0.4);
    ctx.lineWidth = 3 / zoom;
    ctx.stroke();
    // divider
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.55);
    ctx.lineTo(x + w, y + h * 0.55);
    ctx.stroke();
  } else if (sym === "counter") {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    // front edge
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.8);
    ctx.lineTo(x + w, y + h * 0.8);
    ctx.strokeStyle = stroke + "80";
    ctx.stroke();
  } else if (sym === "sofa") {
    ctx.fillStyle = fill;
    // Back
    ctx.beginPath();
    ctx.roundRect(x, y, w, h * 0.35, [4 / zoom]);
    ctx.fill();
    ctx.stroke();
    // Seat
    ctx.beginPath();
    ctx.roundRect(x, y + h * 0.35, w, h * 0.65, [4 / zoom]);
    ctx.fill();
    ctx.stroke();
    // Cushion dividers (3 seats)
    ctx.strokeStyle = stroke + "80";
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.moveTo(x + w / 3, y + h * 0.35);
    ctx.lineTo(x + w / 3, y + h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + (w * 2) / 3, y + h * 0.35);
    ctx.lineTo(x + (w * 2) / 3, y + h);
    ctx.stroke();
    // Armrests
    ctx.fillStyle = stroke + "30";
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.roundRect(x, y + h * 0.35, w * 0.08, h * 0.65, [2 / zoom]);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(x + w * 0.92, y + h * 0.35, w * 0.08, h * 0.65, [2 / zoom]);
    ctx.fill();
    ctx.stroke();
  } else if (sym === "bed") {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    // Headboard
    ctx.fillStyle = stroke + "40";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h * 0.18, [4 / zoom]);
    ctx.fill();
    ctx.stroke();
    // Pillows
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    const pw = w < 130 ? w * 0.7 : w * 0.35;
    const ph = h * 0.1;
    if (w >= 130) {
      ctx.beginPath();
      ctx.roundRect(x + w * 0.08, y + h * 0.22, pw, ph, [2 / zoom]);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(x + w * 0.56, y + h * 0.22, pw, ph, [2 / zoom]);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.roundRect(x + w * 0.15, y + h * 0.22, pw, ph, [2 / zoom]);
      ctx.fill();
      ctx.stroke();
    }
    // Blanket fold
    ctx.fillStyle = stroke + "15";
    ctx.beginPath();
    ctx.rect(x, y + h * 0.36, w, h * 0.64);
    ctx.fill();
    ctx.strokeStyle = stroke + "80";
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.36);
    ctx.lineTo(x + w, y + h * 0.36);
    ctx.stroke();
  } else if (sym === "chair") {
    ctx.fillStyle = fill;
    // Seat
    ctx.beginPath();
    ctx.roundRect(x + w * 0.1, y + h * 0.2, w * 0.8, h * 0.8, [4 / zoom]);
    ctx.fill();
    ctx.stroke();
    // Back
    ctx.beginPath();
    ctx.roundRect(x + w * 0.1, y, w * 0.8, h * 0.25, [4 / zoom]);
    ctx.fill();
    ctx.stroke();
  } else if (sym === "dresser") {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    // Drawers
    const drawers = 3;
    for (let i = 0; i < drawers; i++) {
      const dw = w / drawers;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.strokeRect(
        x + i * dw + 3 / zoom,
        y + 3 / zoom,
        dw - 6 / zoom,
        h - 6 / zoom,
      );
      // Handle
      ctx.beginPath();
      ctx.arc(x + i * dw + dw / 2, y + h / 2, 3 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = stroke;
      ctx.fill();
    }
  } else if (sym === "table") {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, [6 / zoom]);
    ctx.fill();
    ctx.stroke();
    // Chairs around
    ctx.fillStyle = stroke + "30";
    const cs = 14 / zoom;
    [
      [x + w / 2 - cs / 2, y - cs - 2 / zoom],
      [x + w / 2 - cs / 2, y + h + 2 / zoom],
      [x - cs - 2 / zoom, y + h / 2 - cs / 2],
      [x + w + 2 / zoom, y + h / 2 - cs / 2],
    ].forEach(([cx2, cy2]) => {
      ctx.beginPath();
      ctx.roundRect(cx2, cy2, cs, cs, [2 / zoom]);
      ctx.fill();
      ctx.stroke();
    });
  } else {
    // Generic box
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, [4 / zoom]);
    ctx.fill();
    ctx.stroke();
  }

  // Label
  ctx.fillStyle = stroke;
  ctx.font = `${
    Math.max(8, Math.min(11, w * 0.1)) / zoom
  }px Poppins, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2);
};

// Real-scale floor layout: tile grid, brick offset, diagonal, herringbone, staggered planks.
// Drawn inside the room outline (caller clips). 1 inch = PX_PER_IN canvas px.
const drawFloorPattern = (ctx, bb, fl, zoom) => {
  const k = PX_PER_IN;
  ctx.fillStyle = fl.color || "#d6d3d1";
  ctx.fillRect(bb.x0 - 2, bb.y0 - 2, bb.x1 - bb.x0 + 4, bb.y1 - bb.y0 + 4);
  if (FLOOR_MATERIALS[fl.material]?.noPattern) return;
  const W = Math.max(0.5, Math.min(fl.w, fl.l)) * k; // narrow side
  const L = Math.max(0.5, Math.max(fl.w, fl.l)) * k; // long side
  if (W * zoom < 3.5) return; // too small to read at this zoom
  const cx = (bb.x0 + bb.x1) / 2,
    cy = (bb.y0 + bb.y1) / 2;
  const R = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0) / 2 + L;
  if (((2 * R) / W) * ((2 * R) / L) > 9000) return; // safety valve for tiny mosaics
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(
    (((fl.angle || 0) + (fl.pattern === "diagonal" ? 45 : 0)) * Math.PI) / 180,
  );
  ctx.strokeStyle = "rgba(15,23,42,0.35)";
  ctx.lineWidth = Math.min(3, Math.max(0.8, (fl.jointIn || 0.1) * k)) / zoom;
  ctx.beginPath();
  if (fl.pattern === "herringbone") {
    // two plank orientations repeating on a (W,W) / (L,-L) lattice
    const iMax = Math.ceil(R / W) + 2,
      jMax = Math.ceil(R / L) + 2;
    for (let i = -iMax; i <= iMax; i++) {
      for (let j = -jMax; j <= jMax; j++) {
        const ox = i * W + j * L,
          oy = i * W - j * L;
        ctx.rect(ox, oy, L, W);
        ctx.rect(ox + L, oy + W - L, W, L);
      }
    }
  } else {
    const cycle = fl.pattern === "offset" ? 2 : fl.material === "tile" ? 1 : 3; // 1 = stacked grid
    const rows = Math.ceil(R / W) + 1;
    for (let r = -rows; r <= rows; r++) {
      const y = r * W;
      ctx.moveTo(-R, y);
      ctx.lineTo(R, y);
      const off = ((((r % cycle) + cycle) % cycle) / cycle) * L;
      for (let x = -R - L + off; x <= R; x += L) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + W);
      }
    }
  }
  ctx.stroke();
  ctx.restore();
};

const drawCabinet = (ctx, el, zoom, dark) => {
  const { x, y, w, h } = el;
  const kind = el.kind || "base";
  const fillHex = el.color || CAB_KINDS[kind]?.color || "#d6b98c";
  const ink = dark ? "#e2e8f0" : "#475569";
  const f = el.facing || "s";
  ctx.save();
  ctx.lineWidth = 1.5 / zoom;
  ctx.strokeStyle = ink;
  if (kind === "wall") ctx.setLineDash([5 / zoom, 3 / zoom]); // upper cabinets are dashed (above the cut plane)
  ctx.fillStyle = kind === "wall" ? `${fillHex}99` : fillHex;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  // door / drawer divisions drawn in from the front edge
  const horiz = f === "s" || f === "n";
  const len = horiz ? w : h,
    depth = horiz ? h : w;
  const doors = Math.max(1, Math.round((el.lenIn || 24) / 15));
  const dl = depth * 0.35;
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  for (let i = 1; i < doors; i++) {
    const t = (i / doors) * len;
    if (f === "s") {
      ctx.moveTo(x + t, y + h);
      ctx.lineTo(x + t, y + h - dl);
    } else if (f === "n") {
      ctx.moveTo(x + t, y);
      ctx.lineTo(x + t, y + dl);
    } else if (f === "e") {
      ctx.moveTo(x + w, y + t);
      ctx.lineTo(x + w - dl, y + t);
    } else {
      ctx.moveTo(x, y + t);
      ctx.lineTo(x + dl, y + t);
    }
  }
  ctx.stroke();

  // heavy front edge so the facing direction reads at a glance
  ctx.lineWidth = 3 / zoom;
  ctx.beginPath();
  if (f === "s") {
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w, y + h);
  } else if (f === "n") {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
  } else if (f === "e") {
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w, y + h);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
  }
  ctx.stroke();

  if (el.sink || kind === "vanity") {
    ctx.beginPath();
    ctx.ellipse(
      x + w / 2,
      y + h / 2,
      Math.min(w, h) * 0.28,
      Math.min(w, h) * 0.2,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fill();
    ctx.lineWidth = 1 / zoom;
    ctx.stroke();
  }
  if (Math.min(w, h) * zoom > 14) {
    ctx.fillStyle = ink;
    ctx.font = `${
      Math.max(8, Math.min(11, Math.min(w, h) * 0.4)) / zoom
    }px Poppins, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      kind === "island" ? "Island" : `${el.lenIn}"`,
      x + w / 2,
      y + h / 2 + (el.sink ? Math.min(w, h) * 0.38 : 0),
    );
  }
  ctx.restore();
};

const drawEl = (ctx, el, isSelected, zoom, useDark) => {
  if (!el) return;
  const lw = (el.strokeWidth || 2) / zoom;

  ctx.save();
  ctx.strokeStyle = el.color || "#2c3e50";
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (el.type) {
    case "wall": {
      const { start: s, end: e } = el;
      const dx = e.x - s.x,
        dy = e.y - s.y;
      const len = Math.hypot(dx, dy);
      const t = el.thickness || DEF_WALL_T;
      const nx = ((-dy / len) * t) / 2,
        ny = ((dx / len) * t) / 2;
      ctx.save();
      // Fill
      ctx.beginPath();
      ctx.moveTo(s.x + nx, s.y + ny);
      ctx.lineTo(e.x + nx, e.y + ny);
      ctx.lineTo(e.x - nx, e.y - ny);
      ctx.lineTo(s.x - nx, s.y - ny);
      ctx.closePath();
      ctx.fillStyle = useDark ? "#4b5563" : "#cfd8dc";
      ctx.fill();
      // Outer lines
      ctx.strokeStyle = useDark ? "#9ca3af" : "#546e7a";
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.moveTo(s.x + nx, s.y + ny);
      ctx.lineTo(e.x + nx, e.y + ny);
      ctx.moveTo(s.x - nx, s.y - ny);
      ctx.lineTo(e.x - nx, e.y - ny);
      ctx.stroke();
      ctx.restore();
      drawMeasure(ctx, s.x, s.y, e.x, e.y, zoom);
      break;
    }
    case "room": {
      const pts = roomPoints(el);
      const bb = bboxOf(pts);
      const fin = getFinish(el);
      const trace = () => {
        ctx.beginPath();
        pts.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
        );
        ctx.closePath();
      };
      // tint, then the real-scale floor layout clipped to the outline
      trace();
      ctx.fillStyle = el.fillColor || "#dbeafe";
      ctx.fill();
      if (fin.floor.material !== "none") {
        ctx.save();
        trace();
        ctx.clip();
        drawFloorPattern(ctx, bb, fin.floor, zoom);
        ctx.restore();
      }
      // wall-paint colour shows as a band just inside the outline
      if (fin.walls.paint) {
        ctx.save();
        trace();
        ctx.clip();
        ctx.strokeStyle = fin.walls.color;
        ctx.lineWidth = 10 / zoom;
        ctx.stroke();
        ctx.restore();
      }
      trace();
      ctx.strokeStyle = el.color || "#3b82f6";
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();

      const c = polyCentroid(pts);
      const area = polyArea(pts) / (PPF * PPF);
      const sub = [
        `${area.toFixed(0)} sq ft`,
        fin.floor.material !== "none"
          ? FLOOR_MATERIALS[fin.floor.material].short
          : null,
      ]
        .filter(Boolean)
        .join(" · ");
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      const label = (txt, yy, font, fill) => {
        ctx.font = font;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 3 / zoom;
        ctx.strokeText(txt, c.x, yy);
        ctx.fillStyle = fill;
        ctx.fillText(txt, c.x, yy);
      };
      label(
        el.label || "Room",
        c.y - 9 / zoom,
        `bold ${14 / zoom}px Poppins, sans-serif`,
        el.color || "#1d4ed8",
      );
      label(
        sub,
        c.y + 8 / zoom,
        `${11 / zoom}px Poppins, sans-serif`,
        "#334155",
      );
      pts.forEach((p, i) => {
        const q = pts[(i + 1) % pts.length];
        drawMeasure(ctx, p.x, p.y, q.x, q.y, zoom);
      });
      break;
    }
    case "door": {
      const { start: s, end: e } = el;
      const dx = e.x - s.x,
        dy = e.y - s.y;
      const doorLen = Math.hypot(dx, dy);
      // Door frame line
      ctx.strokeStyle = useDark ? "#d1d5db" : "#2c3e50";
      ctx.lineWidth = 3 / zoom;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      // Swing arc
      ctx.strokeStyle = useDark ? "#f87171" : "#e74c3c";
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([3 / zoom, 3 / zoom]);
      ctx.beginPath();
      ctx.arc(
        s.x,
        s.y,
        doorLen,
        Math.atan2(dy, dx) - Math.PI / 2,
        Math.atan2(dy, dx),
      );
      ctx.stroke();
      // Door panel line
      ctx.setLineDash([]);
      const perpAngle = Math.atan2(dy, dx) - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(
        s.x + Math.cos(perpAngle) * doorLen,
        s.y + Math.sin(perpAngle) * doorLen,
      );
      ctx.stroke();
      break;
    }
    case "window": {
      const { start: s, end: e } = el;
      const dx = e.x - s.x,
        dy = e.y - s.y;
      const len = Math.hypot(dx, dy);
      const t = 8 / zoom;
      const nx = (-dy / len) * t,
        ny = (dx / len) * t;
      ctx.strokeStyle = useDark ? "#93c5fd" : "#0369a1";
      ctx.lineWidth = 2 / zoom;
      // Frame
      ctx.beginPath();
      ctx.moveTo(s.x + nx / 2, s.y + ny / 2);
      ctx.lineTo(e.x + nx / 2, e.y + ny / 2);
      ctx.moveTo(s.x - nx / 2, s.y - ny / 2);
      ctx.lineTo(e.x - nx / 2, e.y - ny / 2);
      ctx.stroke();
      // Glass (center line)
      ctx.strokeStyle = useDark ? "#bfdbfe" : "#7dd3fc";
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      // End caps
      ctx.strokeStyle = useDark ? "#93c5fd" : "#0369a1";
      ctx.lineWidth = 3 / zoom;
      ctx.beginPath();
      ctx.moveTo(s.x - nx / 2, s.y - ny / 2);
      ctx.lineTo(s.x + nx / 2, s.y + ny / 2);
      ctx.moveTo(e.x - nx / 2, e.y - ny / 2);
      ctx.lineTo(e.x + nx / 2, e.y + ny / 2);
      ctx.stroke();
      break;
    }
    case "stairs": {
      const { start: s, end: e } = el;
      const dx = e.x - s.x,
        dy = e.y - s.y;
      const steps = el.steps || 8;
      ctx.strokeStyle = useDark ? "#d1d5db" : "#374151";
      ctx.lineWidth = 1.5 / zoom;
      // Border
      ctx.strokeRect(s.x, s.y, dx, dy);
      // Treads
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const tx = s.x + dx * t,
          ty = s.y + dy * t;
        ctx.beginPath();
        if (Math.abs(dx) > Math.abs(dy)) {
          ctx.moveTo(tx, s.y);
          ctx.lineTo(tx, e.y);
        } else {
          ctx.moveTo(s.x, ty);
          ctx.lineTo(e.x, ty);
        }
        ctx.stroke();
      }
      // Arrow for direction
      const mx = s.x + dx / 2,
        my = s.y + dy / 2;
      ctx.strokeStyle = useDark ? "#60a5fa" : "#2563eb";
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      if (Math.abs(dx) > Math.abs(dy)) {
        ctx.moveTo(mx - 10 / zoom, my);
        ctx.lineTo(mx + 10 / zoom, my);
        ctx.moveTo(mx + 6 / zoom, my - 4 / zoom);
        ctx.lineTo(mx + 10 / zoom, my);
        ctx.lineTo(mx + 6 / zoom, my + 4 / zoom);
      } else {
        ctx.moveTo(mx, my - 10 / zoom);
        ctx.lineTo(mx, my + 10 / zoom);
        ctx.moveTo(mx - 4 / zoom, my + 6 / zoom);
        ctx.lineTo(mx, my + 10 / zoom);
        ctx.lineTo(mx + 4 / zoom, my + 6 / zoom);
      }
      ctx.stroke();
      break;
    }
    case "line": {
      const { start: s, end: e } = el;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      drawMeasure(ctx, s.x, s.y, e.x, e.y, zoom);
      break;
    }
    case "rectangle": {
      const { start: s, end: e } = el;
      ctx.beginPath();
      ctx.rect(
        Math.min(s.x, e.x),
        Math.min(s.y, e.y),
        Math.abs(e.x - s.x),
        Math.abs(e.y - s.y),
      );
      if (el.fill) {
        ctx.fillStyle = el.fill;
        ctx.fill();
      }
      ctx.stroke();
      drawMeasure(
        ctx,
        Math.min(s.x, e.x),
        Math.min(s.y, e.y),
        Math.max(s.x, e.x),
        Math.min(s.y, e.y),
        zoom,
      );
      drawMeasure(
        ctx,
        Math.min(s.x, e.x),
        Math.min(s.y, e.y),
        Math.min(s.x, e.x),
        Math.max(s.y, e.y),
        zoom,
      );
      break;
    }
    case "circle": {
      const r = Math.hypot(el.end.x - el.start.x, el.end.y - el.start.y);
      ctx.beginPath();
      ctx.arc(el.start.x, el.start.y, r, 0, Math.PI * 2);
      if (el.fill) {
        ctx.fillStyle = el.fill;
        ctx.fill();
      }
      ctx.stroke();
      drawMeasure(
        ctx,
        el.start.x,
        el.start.y,
        el.start.x + r,
        el.start.y,
        zoom,
      );
      break;
    }
    case "path": {
      if (!el.points || el.points.length < 2) break;
      ctx.beginPath();
      el.points.forEach((p, i) =>
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
      );
      ctx.stroke();
      break;
    }
    case "text": {
      ctx.font = `${(el.fontSize || 16) / zoom}px Poppins, sans-serif`;
      ctx.fillStyle = el.color || "#2c3e50";
      // Background
      const tw = ctx.measureText(el.text).width;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillRect(
        el.x - 2 / zoom,
        el.y - (el.fontSize || 16) / zoom - 2 / zoom,
        tw + 4 / zoom,
        (el.fontSize || 16) / zoom + 4 / zoom,
      );
      ctx.fillStyle = el.color || "#2c3e50";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(el.text, el.x, el.y);
      break;
    }
    case "dimension": {
      const { start: s, end: e } = el;
      const dx = e.x - s.x,
        dy = e.y - s.y;
      const len = Math.hypot(dx, dy);
      const nx = ((-dy / len) * 12) / zoom,
        ny = ((dx / len) * 12) / zoom;
      ctx.strokeStyle = el.color || "#f59e0b";
      ctx.lineWidth = 1.5 / zoom;
      // extension lines
      ctx.beginPath();
      ctx.moveTo(s.x + nx, s.y + ny);
      ctx.lineTo(s.x - nx, s.y - ny);
      ctx.moveTo(e.x + nx, e.y + ny);
      ctx.lineTo(e.x - nx, e.y - ny);
      ctx.stroke();
      // dimension line
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      // arrows
      const ang = Math.atan2(dy, dx);
      const as = 8 / zoom;
      [
        [s.x, s.y, ang + Math.PI],
        [e.x, e.y, ang],
      ].forEach(([px, py, a]) => {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a + 0.35) * as, py + Math.sin(a + 0.35) * as);
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a - 0.35) * as, py + Math.sin(a - 0.35) * as);
        ctx.stroke();
      });
      drawMeasure(ctx, s.x, s.y, e.x, e.y, zoom);
      break;
    }
    case "cabinet": {
      drawCabinet(ctx, el, zoom, useDark);
      break;
    }
    case "preset": {
      drawPresetSymbol(ctx, el, zoom);
      break;
    }
    default:
      break;
  }

  // Selection highlight
  if (isSelected) {
    ctx.setLineDash([5 / zoom, 3 / zoom]);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2 / zoom;
    if (el.start && el.end) {
      const ex = [el.start.x, el.end.x, ...(el.x !== undefined ? [el.x] : [])];
      const ey = [el.start.y, el.end.y, ...(el.y !== undefined ? [el.y] : [])];
      const pad = 10 / zoom;
      ctx.strokeRect(
        Math.min(...ex) - pad,
        Math.min(...ey) - pad,
        Math.abs(el.end.x - el.start.x) + 2 * pad,
        Math.abs(el.end.y - el.start.y) + 2 * pad,
      );
    } else if (el.x !== undefined && el.w !== undefined) {
      const pad = 6 / zoom;
      ctx.strokeRect(el.x - pad, el.y - pad, el.w + 2 * pad, el.h + 2 * pad);
      // Resize handles
      ctx.setLineDash([]);
      ctx.fillStyle = "#3b82f6";
      [
        [el.x, el.y],
        [el.x + el.w, el.y],
        [el.x, el.y + el.h],
        [el.x + el.w, el.y + el.h],
      ].forEach(([hx, hy]) => {
        ctx.beginPath();
        ctx.arc(hx, hy, 4 / zoom, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.setLineDash([]);
  }

  ctx.restore();
};

// ═══════════════════════════════════════════════════════════
// 3-D PREVIEW  (pure canvas perspective renderer – no Three.js)
// ═══════════════════════════════════════════════════════════
// World axes: x → right, y → UP, z → depth (plan "y").
const project3D = (wx, wy, wz, rotX, rotY, scale, viewW, viewH) => {
  const x1 = wx * Math.cos(rotY) + wz * Math.sin(rotY);
  const z1 = -wx * Math.sin(rotY) + wz * Math.cos(rotY);
  const y2 = wy * Math.cos(rotX) + z1 * Math.sin(rotX); // screen-up
  const z2 = -wy * Math.sin(rotX) + z1 * Math.cos(rotX); // distance from camera
  const fov = 700;
  const pz = fov / (fov + z2 + 400);
  return {
    sx: viewW / 2 + x1 * pz * scale,
    sy: viewH / 2 - y2 * pz * scale,
    depth: z2,
  };
};

const shade = (hex, f, a = 1) => {
  const h = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex : "#94a3b8";
  const n = parseInt(h.slice(1), 16);
  const c = (sh) =>
    Math.max(0, Math.min(255, Math.round(((n >> sh) & 255) * f)));
  return `rgba(${c(16)},${c(8)},${c(0)},${a})`;
};

export const Canvas3D = () => {
  const { page, visLayers, settings } = useC();
  const canvasRef = useRef(null);
  const [rot, setRot] = useState({ x: 0.55, y: 0.6 });
  const [drag, setDrag] = useState(null);
  const [zoom3, setZoom3] = useState(0.55);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width,
      H = canvas.height;
    const els = (page?.elements || []).filter((e) =>
      visLayers.has(e.layer || "walls"),
    );
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#1e293b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // centre of the drawing
    const xs = [],
      zs = [];
    els.forEach((el) => {
      if (el.start && el.end) {
        xs.push(el.start.x, el.end.x);
        zs.push(el.start.y, el.end.y);
      }
      if (el.x !== undefined && el.w !== undefined) {
        xs.push(el.x, el.x + el.w);
        zs.push(el.y, el.y + el.h);
      }
    });
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 600;
    const cz = zs.length ? (Math.min(...zs) + Math.max(...zs)) / 2 : 400;
    const p = (wx, wy, wz) =>
      project3D(wx - cx, wy, wz - cz, rot.x, rot.y, zoom3 * 100, W, H);
    const wallH = (settings.ceilingFt || 9) * PPF;
    const k = PX_PER_IN;

    const faces = [];
    const addPoly = (pts, fill, stroke) =>
      faces.push({
        type: "poly",
        pts,
        fill,
        stroke,
        depth: pts.reduce((a, c) => a + c.depth, 0) / pts.length,
      });
    const addBox = (
      x0,
      z0,
      x1,
      z1,
      y0,
      y1,
      hex,
      edge = "rgba(15,23,42,0.45)",
    ) => {
      const C = [
        p(x0, y0, z0),
        p(x1, y0, z0),
        p(x1, y0, z1),
        p(x0, y0, z1),
        p(x0, y1, z0),
        p(x1, y1, z0),
        p(x1, y1, z1),
        p(x0, y1, z1),
      ];
      addPoly([C[4], C[5], C[6], C[7]], shade(hex, 1.1), edge);
      addPoly([C[0], C[1], C[5], C[4]], shade(hex, 0.9), edge);
      addPoly([C[3], C[2], C[6], C[7]], shade(hex, 0.65), edge);
      addPoly([C[0], C[3], C[7], C[4]], shade(hex, 0.78), edge);
      addPoly([C[1], C[2], C[6], C[5]], shade(hex, 0.78), edge);
    };

    // floor grid (5 ft)
    for (let g = -800; g <= 800; g += 100) {
      const a = p(cx + g, 0, cz - 800),
        b = p(cx + g, 0, cz + 800);
      const c = p(cx - 800, 0, cz + g),
        d = p(cx + 800, 0, cz + g);
      faces.push({
        type: "line",
        pts: [a, b],
        color: "rgba(148,163,184,0.12)",
        depth: 9999,
      });
      faces.push({
        type: "line",
        pts: [c, d],
        color: "rgba(148,163,184,0.12)",
        depth: 9999,
      });
    }

    // rooms → floor finish colour
    const roomInfo = els
      .filter((e) => e.type === "room")
      .map((r) => ({ el: r, pts: roomPoints(r), fin: getFinish(r) }));
    roomInfo.forEach(({ el, pts, fin }) => {
      const corners = pts.map((q) => p(q.x, 0, q.y));
      const hasFloor = fin.floor.material !== "none";
      addPoly(
        corners,
        hasFloor
          ? shade(fin.floor.color, 1, 0.96)
          : shade(el.fillColor || "#dbeafe", 1, 0.35),
        shade(el.color || "#3b82f6", 1, 0.3),
      );
      faces[faces.length - 1].depth = 99999; // floors always paint first, behind everything standing on them
    });

    // walls; each face takes the paint colour of the room it faces
    els
      .filter((e) => e.type === "wall")
      .forEach((el) => {
        const { start: s, end: e } = el;
        const dx = e.x - s.x,
          dz = e.y - s.y;
        const len = Math.hypot(dx, dz) || 1;
        const t = el.thickness || DEF_WALL_T;
        const ux = -dz / len,
          uz = dx / len;
        const mx = (s.x + e.x) / 2,
          mz = (s.y + e.y) / 2;
        const faceHex = (sign) => {
          const probe = {
            x: mx + sign * ux * (t / 2 + 4),
            y: mz + sign * uz * (t / 2 + 4),
          };
          const hit = roomInfo.find(
            (r) => pointInPoly(probe, r.pts) && r.fin.walls.paint,
          );
          return hit ? hit.fin.walls.color : null;
        };
        const nx = (ux * t) / 2,
          nz = (uz * t) / 2;
        const C = [
          p(s.x + nx, 0, s.y + nz),
          p(e.x + nx, 0, e.y + nz),
          p(e.x - nx, 0, e.y - nz),
          p(s.x - nx, 0, s.y - nz),
          p(s.x + nx, wallH, s.y + nz),
          p(e.x + nx, wallH, e.y + nz),
          p(e.x - nx, wallH, e.y - nz),
          p(s.x - nx, wallH, s.y - nz),
        ];
        const plus = faceHex(1),
          minus = faceHex(-1);
        addPoly([C[4], C[5], C[6], C[7]], "#cbd5e1", "#94a3b8");
        addPoly(
          [C[0], C[1], C[5], C[4]],
          plus ? shade(plus, 0.95) : "#94a3b8",
          "#64748b",
        );
        addPoly(
          [C[3], C[2], C[6], C[7]],
          minus ? shade(minus, 0.8) : "#64748b",
          "#475569",
        );
        addPoly([C[0], C[3], C[7], C[4]], "#7c8ca0", "#5a6b7d");
        addPoly([C[1], C[2], C[6], C[5]], "#7c8ca0", "#5a6b7d");
      });

    // baseboards as a thin strip along room outlines
    roomInfo
      .filter((r) => r.fin.baseboard.enabled)
      .forEach(({ pts, fin }) => {
        const bh = fin.baseboard.heightIn * k;
        pts.forEach((a, i) => {
          const b = pts[(i + 1) % pts.length];
          addPoly(
            [p(a.x, 0, a.y), p(b.x, 0, b.y), p(b.x, bh, b.y), p(a.x, bh, a.y)],
            shade(fin.baseboard.color, 0.95),
            "rgba(15,23,42,0.25)",
          );
        });
      });

    // cabinets with real heights, plus a counter slab on base units
    els
      .filter((e) => e.type === "cabinet")
      .forEach((el) => {
        const y0 = (el.mountIn || 0) * k,
          y1 = y0 + (el.heightIn || 34.5) * k;
        const solid =
          el.kind === "base" || el.kind === "vanity" || el.kind === "island";
        addBox(
          el.x,
          el.y,
          el.x + el.w,
          el.y + el.h,
          y0,
          solid ? y1 - 1.5 * k : y1,
          el.color || "#d6b98c",
        );
        if (solid)
          addBox(
            el.x - 0.5 * k,
            el.y - 0.5 * k,
            el.x + el.w + 0.5 * k,
            el.y + el.h + 0.5 * k,
            y1 - 1.5 * k,
            y1,
            "#e2e8f0",
          );
      });

    // fixtures & furniture
    els
      .filter((e) => e.type === "preset")
      .forEach((el) => {
        addBox(
          el.x,
          el.y,
          el.x + el.w,
          el.y + el.h,
          0,
          (PRESET_H_IN[el.sym] || 30) * k,
          el.fill || "#dbeafe",
          el.stroke || "#3b82f6",
        );
      });

    faces.sort((a, b) => b.depth - a.depth);
    faces.forEach((f) => {
      ctx.beginPath();
      ctx.moveTo(f.pts[0].sx, f.pts[0].sy);
      f.pts.slice(1).forEach((pt) => ctx.lineTo(pt.sx, pt.sy));
      if (f.type === "line") {
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 1;
        ctx.stroke();
        return;
      }
      ctx.closePath();
      if (f.fill) {
        ctx.fillStyle = f.fill;
        ctx.fill();
      }
      if (f.stroke) {
        ctx.strokeStyle = f.stroke;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    });

    ctx.fillStyle = "rgba(148,163,184,0.6)";
    ctx.font = "12px Poppins, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      "Drag to orbit  ·  Scroll to zoom  ·  floors and walls use the finishes you picked",
      12,
      H - 14,
    );
  }, [page, rot, zoom3, visLayers, settings.ceilingFt]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      setZoom3((z) => Math.max(0.15, Math.min(2, z - e.deltaY * 0.0008)));
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, []);

  const down = (e) =>
    setDrag({ x: e.clientX, y: e.clientY, rx: rot.x, ry: rot.y });
  const move = (e) => {
    if (!drag) return;
    setRot({
      x: Math.max(0.05, Math.min(1.5, drag.rx + (e.clientY - drag.y) * 0.006)),
      y: drag.ry + (e.clientX - drag.x) * 0.008,
    });
  };
  const up = () => setDrag(null);
  const empty = !(page?.elements || []).some((e) =>
    ["wall", "room"].includes(e.type),
  );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        width={1200}
        height={750}
        onMouseDown={down}
        onMouseMove={move}
        onMouseUp={up}
        onMouseLeave={up}
        style={{
          width: "100%",
          height: "100%",
          cursor: drag ? "grabbing" : "grab",
          display: "block",
        }}
      />
      {empty && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
          <p
            style={{
              color: "#94a3b8",
              fontSize: 14,
              fontFamily: "Poppins, sans-serif",
              lineHeight: 1.6,
            }}
          >
            Draw walls and rooms in 2D
            <br />
            then switch back here to see your 3D model.
          </p>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// CANVAS 2-D
// ═══════════════════════════════════════════════════════════
const TOOL_KEYS = {
  v: "select",
  h: "pan",
  e: "eraser",
  w: "wall",
  r: "room",
  g: "polyroom",
  d: "door",
  n: "window",
  p: "pen",
  l: "line",
  t: "text",
};
const ENDPOINT_TOOLS = [
  "wall",
  "line",
  "dimension",
  "room",
  "polyroom",
  "stairs",
];

export const Canvas2D = () => {
  const {
    page,
    tool,
    setTool,
    color,
    fillColor,
    strokeW,
    showGrid,
    gridSize,
    snap: doSnap,
    zoom,
    setZoom,
    pan,
    setPan,
    setEls,
    beginLive,
    endLive,
    selId,
    setSelId,
    visLayers,
    curLayer,
    undo,
    redo,
  } = useC();

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const dragRef = useRef(null); // { id, orig, off } while moving an element
  const anchorWall = useRef(null); // wall a door/window is being laid along
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [tempEl, setTempEl] = useState(null);
  const [panStart, setPanStart] = useState(null);
  const [pathPoints, setPathPoints] = useState([]);
  const [polyPts, setPolyPts] = useState([]); // polygon room being drawn
  const [hover, setHover] = useState(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  // Canvas backing store follows the container and the device pixel ratio (crisp on retina / tablets)
  useEffect(() => {
    const wrap = wrapRef.current,
      canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;
    let last = "";
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth,
        h = wrap.clientHeight;
      const key = `${w}x${h}@${dpr}`;
      if (key === last) return;
      last = key;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      setSize({ w, h }); // triggers a redraw – resizing clears the bitmap
    };
    resize();
    let raf = null;
    const ro = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(resize);
    });
    ro.observe(wrap);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // Wheel zoom needs a non-passive listener or preventDefault() is ignored (and logs a warning)
  const viewRef = useRef({ zoom, pan });
  viewRef.current = { zoom, pan };
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const { zoom: z, pan: pn } = viewRef.current;
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left,
        my = e.clientY - rect.top;
      const nz = Math.max(0.1, Math.min(5, z * (e.deltaY > 0 ? 0.9 : 1.1)));
      setPan({
        x: mx - (mx - pn.x) * (nz / z),
        y: my - (my - pn.y) * (nz / z),
      });
      setZoom(nz);
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [setPan, setZoom]);

  // ───────── coordinates & snapping ─────────
  const getRaw = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  };

  const endpoints = () =>
    page.elements.flatMap((el) =>
      el.type === "wall"
        ? [el.start, el.end]
        : el.type === "room"
        ? roomPoints(el)
        : [],
    );

  // grid snap, then (for drawing tools) snap onto existing wall ends / room corners
  const getPos = (e, useEndpoints = false) => {
    const raw = getRaw(e);
    let pos = doSnap
      ? { x: snapV(raw.x, gridSize), y: snapV(raw.y, gridSize) }
      : raw;
    if (useEndpoints) {
      let best = null,
        bd = 12 / zoom;
      endpoints().forEach((q) => {
        const d = Math.hypot(q.x - raw.x, q.y - raw.y);
        if (d < bd) {
          bd = d;
          best = q;
        }
      });
      if (best) pos = { x: best.x, y: best.y };
    }
    return pos;
  };

  const nearestWall = (raw) => {
    let best = null,
      bd = 16 / zoom;
    page.elements.forEach((el) => {
      if (el.type !== "wall") return;
      const r = projectOnSeg(raw, el.start, el.end);
      if (r.dist < bd) {
        bd = r.dist;
        best = { wall: el, point: r.point };
      }
    });
    return best;
  };

  // Cabinets, fixtures and rooms "magnetise" to neighbouring edges and wall faces so runs butt up cleanly
  const magnet = (x, y, w, h, excludeId) => {
    const tol = 10 / zoom;
    const xs = [],
      ys = [];
    page.elements.forEach((el) => {
      if (el.id === excludeId) return;
      if (el.type === "wall") {
        const t = (el.thickness || DEF_WALL_T) / 2;
        if (Math.abs(el.end.y - el.start.y) < 0.5)
          ys.push(el.start.y - t, el.start.y + t);
        else if (Math.abs(el.end.x - el.start.x) < 0.5)
          xs.push(el.start.x - t, el.start.x + t);
      } else if (el.type === "room") {
        const b = bboxOf(roomPoints(el));
        xs.push(b.x0, b.x1);
        ys.push(b.y0, b.y1);
      } else if (el.w !== undefined && el.type !== "text") {
        xs.push(el.x, el.x + el.w);
        ys.push(el.y, el.y + el.h);
      }
    });
    const pick = (lo, hi, targets) => {
      let best = 0,
        bd = tol;
      targets.forEach((t) =>
        [t - lo, t - hi].forEach((d) => {
          if (Math.abs(d) < bd) {
            bd = Math.abs(d);
            best = d;
          }
        }),
      );
      return best;
    };
    return { x: x + pick(x, x + w, xs), y: y + pick(y, y + h, ys) };
  };

  // ───────── hit testing ─────────
  const hitTest = (pos) => {
    const tol = 10 / zoom;
    const test = (el) => {
      if (!visLayers.has(el.layer || "walls")) return false;
      if (el.type === "room") {
        if (el.points) return pointInPoly(pos, el.points);
        const b = bboxOf(roomPoints(el));
        return pos.x >= b.x0 && pos.x <= b.x1 && pos.y >= b.y0 && pos.y <= b.y1;
      }
      if (el.x !== undefined && el.w !== undefined) {
        return (
          pos.x >= el.x - tol &&
          pos.x <= el.x + el.w + tol &&
          pos.y >= el.y - tol &&
          pos.y <= el.y + el.h + tol
        );
      }
      if (el.type === "circle" && el.start && el.end) {
        const r = Math.hypot(el.end.x - el.start.x, el.end.y - el.start.y);
        return (
          Math.abs(Math.hypot(pos.x - el.start.x, pos.y - el.start.y) - r) <=
          tol
        );
      }
      if (el.type === "path" && el.points)
        return el.points.some(
          (q) => Math.hypot(q.x - pos.x, q.y - pos.y) <= tol * 2,
        );
      if (el.type === "text") {
        const tw = (el.text?.length || 0) * (el.fontSize || 16) * 0.55;
        return (
          pos.x >= el.x - tol &&
          pos.x <= el.x + tw + tol &&
          pos.y >= el.y - (el.fontSize || 16) - tol &&
          pos.y <= el.y + tol
        );
      }
      if (el.start && el.end) {
        if (["rectangle", "door", "stairs"].includes(el.type)) {
          const mx = Math.min(el.start.x, el.end.x),
            my = Math.min(el.start.y, el.end.y);
          return (
            pos.x >= mx - tol &&
            pos.x <= mx + Math.abs(el.end.x - el.start.x) + tol &&
            pos.y >= my - tol &&
            pos.y <= my + Math.abs(el.end.y - el.start.y) + tol
          );
        }
        return projectOnSeg(pos, el.start, el.end).dist <= tol;
      }
      return false;
    };
    // rooms are big areas: only pick one when nothing else is under the cursor
    const rev = [...page.elements].reverse();
    return (
      rev.find((el) => el.type !== "room" && test(el)) ||
      rev.find((el) => el.type === "room" && test(el))
    );
  };

  const getLayer = (toolId) => {
    if (["wall", "door", "window", "stairs"].includes(toolId)) return "walls";
    if (["room", "polyroom"].includes(toolId)) return "rooms";
    if (CABINETS[toolId]) return "cabinets";
    if (PRESETS[toolId]) return PRESETS[toolId].layer;
    if (["text", "dimension"].includes(toolId)) return "annotations";
    return curLayer;
  };

  const originOf = (el) =>
    el.x !== undefined
      ? { x: el.x, y: el.y }
      : el.start
      ? el.start
      : el.points
      ? el.points[0]
      : { x: 0, y: 0 };
  const orthoFrom = (a, b) =>
    Math.abs(b.x - a.x) > Math.abs(b.y - a.y)
      ? { x: b.x, y: a.y }
      : { x: a.x, y: b.y };
  const nextRoomLabel = () =>
    `Room ${page.elements.filter((x) => x.type === "room").length + 1}`;

  const finishPoly = () => {
    const pts = polyPts.filter(
      (q, i, a) =>
        i === 0 || Math.hypot(q.x - a[i - 1].x, q.y - a[i - 1].y) > 1,
    );
    if (pts.length >= 3) {
      const bb = bboxOf(pts);
      const el = {
        id: Date.now(),
        type: "room",
        points: pts,
        start: { x: bb.x0, y: bb.y0 },
        end: { x: bb.x1, y: bb.y1 },
        color,
        fillColor,
        label: nextRoomLabel(),
        layer: "rooms",
        finish: defaultFinish(),
      };
      setEls([...page.elements, el]);
      setSelId(el.id);
    }
    setPolyPts([]);
    setHover(null);
  };

  // ───────── mouse ─────────
  const handleMouseDown = (e) => {
    if (e.button === 1 || tool === "pan") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }
    if (e.button !== 0) return;
    const raw = getRaw(e);
    const pos = getPos(e, ENDPOINT_TOOLS.includes(tool));

    if (tool === "select") {
      const hit = hitTest(raw);
      setSelId(hit ? hit.id : null);
      if (hit) {
        const o = originOf(hit);
        dragRef.current = {
          id: hit.id,
          orig: hit,
          off: { x: raw.x - o.x, y: raw.y - o.y },
        };
        beginLive();
      }
      return;
    }

    if (tool === "eraser") {
      const hit = hitTest(raw);
      if (hit) setEls(page.elements.filter((x) => x.id !== hit.id));
      return;
    }

    if (tool === "text") {
      const text = prompt("Enter label:");
      if (text)
        setEls([
          ...page.elements,
          {
            id: Date.now(),
            type: "text",
            text,
            x: pos.x,
            y: pos.y,
            color,
            fontSize: 16,
            layer: "annotations",
          },
        ]);
      return;
    }

    if (tool === "polyroom") {
      const p =
        e.shiftKey && polyPts.length
          ? orthoFrom(polyPts[polyPts.length - 1], pos)
          : pos;
      if (
        polyPts.length >= 3 &&
        Math.hypot(p.x - polyPts[0].x, p.y - polyPts[0].y) < 12 / zoom
      ) {
        finishPoly();
        return;
      }
      setPolyPts((prev) => [...prev, p]);
      return;
    }

    if (CABINETS[tool]) {
      const c = makeCabinet(tool, 0, 0);
      let x = raw.x - c.w / 2,
        y = raw.y - c.h / 2;
      if (doSnap) {
        x = snapV(x, gridSize);
        y = snapV(y, gridSize);
      }
      const m = magnet(x, y, c.w, c.h, null);
      const el = { ...c, x: m.x, y: m.y };
      setEls([...page.elements, el]);
      setSelId(el.id);
      return;
    }

    if (PRESETS[tool]) {
      const preset = PRESETS[tool];
      const m = magnet(
        pos.x - preset.w / 2,
        pos.y - preset.h / 2,
        preset.w,
        preset.h,
        null,
      );
      const newEl = {
        id: Date.now(),
        type: "preset",
        subtype: tool,
        x: m.x,
        y: m.y,
        w: preset.w,
        h: preset.h,
        fill: preset.fill,
        stroke: preset.stroke,
        sym: preset.sym,
        label: preset.label,
        layer: preset.layer,
      };
      setEls([...page.elements, newEl]);
      setSelId(newEl.id);
      return;
    }

    if (tool === "door" || tool === "window") {
      // start on the nearest wall centre-line so openings sit exactly in the wall
      anchorWall.current = nearestWall(raw);
      setStartPos(anchorWall.current ? anchorWall.current.point : pos);
      setIsDrawing(true);
      return;
    }

    setIsDrawing(true);
    setStartPos(pos);
    if (tool === "pen") setPathPoints([pos]);
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    // move the selected element (history is committed once, on mouse-up)
    const d = dragRef.current;
    if (d) {
      const raw = getRaw(e);
      let nx = raw.x - d.off.x,
        ny = raw.y - d.off.y;
      if (doSnap) {
        nx = snapV(nx, gridSize);
        ny = snapV(ny, gridSize);
      }
      if (d.orig.w !== undefined && d.orig.type !== "text") {
        const m = magnet(nx, ny, d.orig.w, d.orig.h, d.id);
        nx = m.x;
        ny = m.y;
      }
      const o = originOf(d.orig);
      const moved = translateEl(d.orig, nx - o.x, ny - o.y);
      setEls(
        page.elements.map((el) => (el.id === d.id ? moved : el)),
        false,
      );
      return;
    }

    if (tool === "polyroom" && polyPts.length) {
      const p = getPos(e, true);
      setHover(e.shiftKey ? orthoFrom(polyPts[polyPts.length - 1], p) : p);
      return;
    }
    if (!isDrawing || !startPos) return;
    const pos = getPos(e, ENDPOINT_TOOLS.includes(tool));

    if (tool === "pen") {
      setPathPoints((prev) => [...prev, pos]);
      setTempEl({
        id: "temp",
        type: "path",
        points: [...pathPoints, pos],
        color,
        strokeWidth: strokeW,
        layer: curLayer,
      });
      return;
    }

    let end = pos;
    if ((tool === "door" || tool === "window") && anchorWall.current) {
      // follow the wall direction, length in 6" steps
      const w = anchorWall.current.wall;
      const proj = projectOnSeg(getRaw(e), w.start, w.end).point;
      const dx = proj.x - startPos.x,
        dy = proj.y - startPos.y;
      let len = Math.hypot(dx, dy);
      if (doSnap) len = snapV(len, Math.min(gridSize, 10));
      end =
        len > 0
          ? {
              x: startPos.x + (dx / Math.hypot(dx, dy)) * len,
              y: startPos.y + (dy / Math.hypot(dx, dy)) * len,
            }
          : startPos;
    } else if (["wall", "door", "window", "line", "dimension"].includes(tool)) {
      const dx = Math.abs(pos.x - startPos.x),
        dy = Math.abs(pos.y - startPos.y);
      if (dx < 15 / zoom) end = { ...pos, x: startPos.x };
      else if (dy < 15 / zoom) end = { ...pos, y: startPos.y };
    }

    const base = {
      start: startPos,
      end,
      color,
      strokeWidth: strokeW,
      layer: getLayer(tool),
    };
    if (tool === "wall")
      setTempEl({ ...base, type: "wall", thickness: DEF_WALL_T });
    else if (tool === "room")
      setTempEl({
        ...base,
        type: "room",
        fillColor,
        label: nextRoomLabel(),
        finish: defaultFinish(),
      });
    else if (tool === "door") setTempEl({ ...base, type: "door" });
    else if (tool === "window") setTempEl({ ...base, type: "window" });
    else if (tool === "stairs")
      setTempEl({ ...base, type: "stairs", steps: 8 });
    else if (tool === "line") setTempEl({ ...base, type: "line" });
    else if (tool === "rectangle") setTempEl({ ...base, type: "rectangle" });
    else if (tool === "circle") setTempEl({ ...base, type: "circle" });
    else if (tool === "dimension") setTempEl({ ...base, type: "dimension" });
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (dragRef.current) {
      dragRef.current = null;
      endLive();
      return;
    }
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === "pen" && pathPoints.length > 1) {
      setEls([
        ...page.elements,
        {
          id: Date.now(),
          type: "path",
          points: pathPoints,
          color,
          strokeWidth: strokeW,
          layer: curLayer,
        },
      ]);
    } else if (tempEl) {
      const dist = tempEl.start
        ? Math.hypot(
            tempEl.end.x - tempEl.start.x,
            tempEl.end.y - tempEl.start.y,
          )
        : 0;
      if (dist > 5 / zoom) {
        const newEl = { ...tempEl, id: Date.now() };
        if (newEl.type === "room") newEl.fillColor = fillColor;
        setEls([...page.elements, newEl]);
        setSelId(newEl.id);
      }
    }
    anchorWall.current = null;
    setTempEl(null);
    setPathPoints([]);
    setStartPos(null);
  };

  // ───────── keyboard ─────────
  const keyRef = useRef({});
  keyRef.current = { selId, page, setEls, setSelId, tool, finishPoly };
  useEffect(() => {
    const handler = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      const k = keyRef.current;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && k.selId) {
        k.setEls(k.page.elements.filter((el) => el.id !== k.selId));
        k.setSelId(null);
        return;
      }
      if (e.key === "Escape") {
        setPolyPts([]);
        setHover(null);
        k.setSelId(null);
        return;
      }
      if (e.key === "Enter" && k.tool === "polyroom") {
        k.finishPoly();
        return;
      }
      if (!mod && TOOL_KEYS[key]) setTool(TOOL_KEYS[key]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, setTool]);

  // ───────── render ─────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr,
      H = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.fillStyle = isDark ? "#1e293b" : "#f8fafc";
    ctx.fillRect(0, 0, W, H);
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    if (showGrid) {
      const ww = W / zoom,
        wh = H / zoom;
      const offX = -pan.x / zoom,
        offY = -pan.y / zoom;
      const gridLines = (step, stroke, lw) => {
        if (step * zoom < 4) return; // too dense to be useful
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw / zoom;
        ctx.beginPath();
        for (let x = Math.floor(offX / step) * step; x < offX + ww; x += step) {
          ctx.moveTo(x, offY);
          ctx.lineTo(x, offY + wh);
        }
        for (let y = Math.floor(offY / step) * step; y < offY + wh; y += step) {
          ctx.moveTo(offX, y);
          ctx.lineTo(offX + ww, y);
        }
        ctx.stroke();
      };
      gridLines(
        gridSize,
        isDark ? "rgba(148,163,184,0.08)" : "rgba(0,0,0,0.06)",
        1,
      );
      gridLines(
        gridSize * 5,
        isDark ? "rgba(148,163,184,0.15)" : "rgba(0,0,0,0.1)",
        1.5,
      );
    }

    const visEls = page.elements.filter((el) =>
      visLayers.has(el.layer || "walls"),
    );
    [
      "rooms",
      "walls",
      "fixtures",
      "cabinets",
      "furniture",
      "annotations",
    ].forEach((layerId) => {
      visEls
        .filter((el) => (el.layer || "walls") === layerId)
        .forEach((el) => drawEl(ctx, el, el.id === selId, zoom, isDark));
    });
    if (tempEl) drawEl(ctx, tempEl, false, zoom, isDark);

    // polygon room in progress
    if (polyPts.length) {
      const pts = hover ? [...polyPts, hover] : polyPts;
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
      ctx.setLineDash([]);
      pts.forEach((q, i) => {
        if (i) drawMeasure(ctx, pts[i - 1].x, pts[i - 1].y, q.x, q.y, zoom);
      });
      ctx.fillStyle = "#2563eb";
      polyPts.forEach((q, i) => {
        ctx.beginPath();
        ctx.arc(q.x, q.y, (i === 0 ? 6 : 4) / zoom, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  }, [
    page,
    tempEl,
    selId,
    showGrid,
    gridSize,
    zoom,
    pan,
    visLayers,
    isDark,
    size,
    polyPts,
    hover,
  ]);

  const getCursor = () => {
    if (tool === "pan" || isPanning) return "grab";
    if (tool === "select") return "default";
    if (tool === "text") return "text";
    if (tool === "eraser") return "cell";
    if (PRESETS[tool] || CABINETS[tool]) return "copy";
    return "crosshair";
  };

  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <canvas
        id="fp-canvas"
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={() => {
          if (tool === "polyroom") finishPoly();
        }}
        style={{ display: "block", cursor: getCursor() }}
      />
      {tool === "polyroom" && (
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15,23,42,0.85)",
            color: "#fff",
            padding: "6px 14px",
            borderRadius: 8,
            fontSize: 12,
            fontFamily: "var(--font-family)",
            pointerEvents: "none",
          }}
        >
          Click each corner · Shift = square corner · double-click or Enter to
          close · Esc to cancel
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
