// src/components/SketchPad/takeoff.js
// ─────────────────────────────────────────────────────────────────────────────
// Pure geometry + quantity take-off for the floor plan designer.
// No React, no DOM → easy to unit-test and reuse on the backend.
//
// This file produces QUANTITIES only (sq ft, boxes, gallons, LF, counts).
// Prices, labour and tax stay in your estimate engine (Decimal.js).
// ─────────────────────────────────────────────────────────────────────────────

export const PPF = 20;                 // canvas pixels per foot
export const PX_PER_IN = PPF / 12;     // canvas pixels per inch
export const SQPX_PER_SQFT = PPF * PPF;

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const r2 = (n) => Math.round(n * 100) / 100;
const ceilTo = (n, step) => Math.ceil(n / step - 1e-9) * step;

// ═════════════════════════════════════════════════════════════════════════════
// CATALOGS
// ═════════════════════════════════════════════════════════════════════════════

export const FLOOR_ORDER = ['none', 'tile', 'vinyl', 'hardwood', 'laminate', 'carpet'];

// w / l are inches. boxSqft values are typical placeholders – the user should
// overwrite them with the product's spec sheet.
export const FLOOR_MATERIALS = {
  none:     { label: 'No flooring' },
  tile:     { label: 'Tile (ceramic / porcelain)', short: 'Tile', w: 12, l: 24, thicknessIn: 0.375, jointIn: 0.125, boxSqft: 15.5, waste: 10, underlayment: false, swatches: ['#d6d3d1', '#a8a29e', '#e7e5e4', '#57534e', '#c9b79c'] },
  vinyl:    { label: 'Vinyl plank (LVP)',          short: 'LVP',  w: 7,  l: 48, thicknessIn: 0.2,   jointIn: 0.02,  boxSqft: 23.8, waste: 7,  underlayment: false, swatches: ['#b08d6a', '#8b6b4a', '#c9b08b', '#6b5442', '#9ca3af'] },
  hardwood: { label: 'Hardwood',                   short: 'Wood', w: 3.25, l: 48, thicknessIn: 0.75, jointIn: 0.02,  boxSqft: 20,   waste: 10, underlayment: true,  swatches: ['#a0693a', '#7a4a24', '#c58f57', '#5b3a1e', '#d9b27c'] },
  laminate: { label: 'Laminate',                   short: 'Lam.', w: 7.5, l: 48, thicknessIn: 0.5,  jointIn: 0.02,  boxSqft: 20,   waste: 8,  underlayment: true,  swatches: ['#c9a27a', '#a8845f', '#d9c2a3', '#8a6f55', '#b9b5ae'] },
  carpet:   { label: 'Carpet (sold by sq yd)',     short: 'Carpet', w: 144, l: 144, thicknessIn: 0.5, jointIn: 0, boxSqft: null, waste: 10, underlayment: true, soldBy: 'sqyd', noPattern: true, swatches: ['#9ca3af', '#78716c', '#cbd5e1', '#64748b', '#a8a29e'] },
};

export const FLOOR_PATTERNS = {
  straight:    { label: 'Straight / staggered', add: 0 },
  offset:      { label: 'Offset 50% (brick)',   add: 0 },
  diagonal:    { label: 'Diagonal 45°',         add: 5 },
  herringbone: { label: 'Herringbone',          add: 10 },
};

export const PAINT_SWATCHES = ['#f5f5f4', '#e7e5e4', '#dbeafe', '#fef3c7', '#d1fae5', '#fce7f3', '#9ca3af', '#1f2937'];

export const CAB_KINDS = {
  base:   { label: 'Base',    color: '#d6b98c' },
  wall:   { label: 'Wall',    color: '#e7d5b5' },
  tall:   { label: 'Tall',    color: '#c9a97a' },
  vanity: { label: 'Vanity',  color: '#c4b5a0' },
  island: { label: 'Island',  color: '#b99a6b' },
};

// inches
export const CABINETS = {
  base_18:   { kind: 'base',   label: 'Base 18"',        lenIn: 18, depthIn: 24, heightIn: 34.5 },
  base_24:   { kind: 'base',   label: 'Base 24"',        lenIn: 24, depthIn: 24, heightIn: 34.5 },
  base_30:   { kind: 'base',   label: 'Base 30"',        lenIn: 30, depthIn: 24, heightIn: 34.5 },
  base_36:   { kind: 'base',   label: 'Base 36"',        lenIn: 36, depthIn: 24, heightIn: 34.5 },
  sink_36:   { kind: 'base',   label: 'Sink base 36"',   lenIn: 36, depthIn: 24, heightIn: 34.5, sink: true },
  wall_15:   { kind: 'wall',   label: 'Wall 15"',        lenIn: 15, depthIn: 12, heightIn: 30, mountIn: 54 },
  wall_30:   { kind: 'wall',   label: 'Wall 30"',        lenIn: 30, depthIn: 12, heightIn: 30, mountIn: 54 },
  wall_36:   { kind: 'wall',   label: 'Wall 36"',        lenIn: 36, depthIn: 12, heightIn: 30, mountIn: 54 },
  pantry_24: { kind: 'tall',   label: 'Pantry 24"',      lenIn: 24, depthIn: 24, heightIn: 84 },
  vanity_30: { kind: 'vanity', label: 'Vanity 30"',      lenIn: 30, depthIn: 21, heightIn: 34, sink: true },
  vanity_48: { kind: 'vanity', label: 'Vanity 48"',      lenIn: 48, depthIn: 21, heightIn: 34, sink: true },
  island_72: { kind: 'island', label: 'Island 72×36"',   lenIn: 72, depthIn: 36, heightIn: 36 },
};

export const DEFAULT_SETTINGS = {
  ceilingFt: 9,
  doorHeightIn: 80,
  windowHeightIn: 48,
  paintCoverage: 350,      // sq ft per gallon, per coat
  primerCoverage: 400,
  trimWastePct: 10,
  backsplashHeightIn: 18,
  countertopDepthIn: 25.5, // includes front overhang
};

// ═════════════════════════════════════════════════════════════════════════════
// FINISH DEFAULTS
// ═════════════════════════════════════════════════════════════════════════════

export const autoWaste = (f) =>
  (FLOOR_MATERIALS[f.material]?.waste ?? 0) +
  (FLOOR_MATERIALS[f.material]?.noPattern ? 0 : FLOOR_PATTERNS[f.pattern]?.add ?? 0);

export const defaultFloor = (material = 'none', keep = {}) => {
  const m = FLOOR_MATERIALS[material];
  if (!m || material === 'none') return { material: 'none' };
  return {
    material, w: m.w, l: m.l, thicknessIn: m.thicknessIn, jointIn: m.jointIn,
    boxSqft: m.boxSqft, waste: null /* null = auto */, pattern: 'straight', angle: 0,
    color: m.swatches[0], underlayment: m.underlayment,
    subfloorPrep: false, floorLeveling: false, waterproofing: false,
    crackIsolation: false, ...keep,
  };
};

export const defaultFinish = () => ({
  floor: { material: 'none' },
  deductFixed: false,
  wallHeightFt: null,
  walls: { paint: false, coats: 2, primer: false, color: '#f5f5f4' },
  ceiling: { paint: false, coats: 1, color: '#ffffff' },
  baseboard: { enabled: false, heightIn: 5, color: '#ffffff' },
});

// Always returns a complete finish object, even for rooms saved before this feature existed.
export const getFinish = (el) => {
  const d = defaultFinish();
  const f = el?.finish || {};
  return {
    ...d, ...f,
    floor: { ...d.floor, ...f.floor },
    walls: { ...d.walls, ...f.walls },
    ceiling: { ...d.ceiling, ...f.ceiling },
    baseboard: { ...d.baseboard, ...f.baseboard },
  };
};

// ═════════════════════════════════════════════════════════════════════════════
// CABINET HELPERS  (front width + depth are stored in inches; w/h are canvas px)
// ═════════════════════════════════════════════════════════════════════════════

export const cabSize = (el) => {
  const l = el.lenIn * PX_PER_IN, d = el.depthIn * PX_PER_IN;
  return el.facing === 'e' || el.facing === 'w' ? { w: d, h: l } : { w: l, h: d };
};

export const makeCabinet = (key, x = 0, y = 0, facing = 's') => {
  const c = CABINETS[key];
  const el = {
    id: uid(), type: 'cabinet', cabKey: key, kind: c.kind, label: c.label,
    lenIn: c.lenIn, depthIn: c.depthIn, heightIn: c.heightIn, mountIn: c.mountIn || 0,
    facing, color: CAB_KINDS[c.kind].color, style: 'shaker', sink: !!c.sink,
    layer: 'cabinets', x, y,
  };
  return { ...el, ...cabSize(el) };
};

// Re-computes px size after an inch/facing change, keeping the centre fixed.
export const resizeCabinet = (el, patch) => {
  const next = { ...el, ...patch };
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  const { w, h } = cabSize(next);
  return { ...next, w, h, x: cx - w / 2, y: cy - h / 2 };
};

// front direction turns clockwise: s → w → n → e
export const rotateCabinet = (el) => resizeCabinet(el, { facing: { s: 'w', w: 'n', n: 'e', e: 's' }[el.facing || 's'] });

// ═════════════════════════════════════════════════════════════════════════════
// GEOMETRY
// ═════════════════════════════════════════════════════════════════════════════

export const roomPoints = (el) => {
  if (el.points?.length >= 3) return el.points;
  const { start: s, end: e } = el;
  const x0 = Math.min(s.x, e.x), x1 = Math.max(s.x, e.x);
  const y0 = Math.min(s.y, e.y), y1 = Math.max(s.y, e.y);
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
};

export const bboxOf = (pts) => {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};

export const polyArea = (pts) => {
  let a = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; });
  return Math.abs(a) / 2;
};

export const polyPerimeter = (pts) =>
  pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + Math.hypot(q.x - p.x, q.y - p.y); }, 0);

export const pointInPoly = (p, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

export const polyCentroid = (pts) => {
  let a = 0, cx = 0, cy = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const f = p.x * q.y - q.x * p.y;
    a += f; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f;
  });
  const bb = bboxOf(pts);
  const mid = { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2 };
  if (Math.abs(a) < 1e-6) return mid;
  const c = { x: cx / (3 * a), y: cy / (3 * a) };
  return pointInPoly(c, pts) ? c : pointInPoly(mid, pts) ? mid : c;
};

export const projectOnSeg = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  const point = { x: a.x + t * dx, y: a.y + t * dy };
  return { point, t, dist: Math.hypot(p.x - point.x, p.y - point.y) };
};

export const distToPolyEdge = (p, pts) =>
  Math.min(...pts.map((q, i) => projectOnSeg(p, q, pts[(i + 1) % pts.length]).dist));

// Sutherland–Hodgman: area of (polygon ∩ axis-aligned rect)
const clipEdge = (poly, inside, cut) => {
  const out = [];
  poly.forEach((cur, i) => {
    const prev = poly[(i + poly.length - 1) % poly.length];
    const ci = inside(cur), pi = inside(prev);
    if (ci) { if (!pi) out.push(cut(prev, cur)); out.push(cur); }
    else if (pi) out.push(cut(prev, cur));
  });
  return out;
};
export const clippedArea = (pts, r) => {
  const cx = (a, b, x) => ({ x, y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x) });
  const cy = (a, b, y) => ({ x: a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y), y });
  let poly = clipEdge(pts, p => p.x >= r.x0, (a, b) => cx(a, b, r.x0));
  poly = clipEdge(poly, p => p.x <= r.x1, (a, b) => cx(a, b, r.x1));
  poly = clipEdge(poly, p => p.y >= r.y0, (a, b) => cy(a, b, r.y0));
  poly = clipEdge(poly, p => p.y <= r.y1, (a, b) => cy(a, b, r.y1));
  return poly.length >= 3 ? polyArea(poly) : 0;
};

// ═════════════════════════════════════════════════════════════════════════════
// TAKE-OFF
// ═════════════════════════════════════════════════════════════════════════════

const ADJ_TOL = 14;                // px (~8") – how close a door/window must sit to a room outline
const GROUT_LB_PER_IN3 = 0.0672;   // sanded grout ≈ 1.86 g/cm³

export function computeTakeoff(pages = [], settingsIn = {}) {
  const S = { ...DEFAULT_SETTINGS, ...settingsIn };
  const multi = pages.length > 1;
  const rooms = [];
  const allCabs = [];
  let transCount = 0, transLf = 0;

  pages.forEach((pg) => {
    const els = pg.elements || [];
    const roomEls = els.filter(e => e.type === 'room');
    const doors = els.filter(e => e.type === 'door' && e.start && e.end);
    const wins = els.filter(e => e.type === 'window' && e.start && e.end);
    const cabs = els.filter(e => e.type === 'cabinet');
    const tubs = els.filter(e => e.type === 'preset' && e.subtype === 'bathtub');
    const fixed = [...cabs.filter(c => c.kind !== 'wall'), ...tubs];
    allCabs.push(...cabs);

    const lenFt = (e) => Math.hypot(e.end.x - e.start.x, e.end.y - e.start.y) / PPF;
    const mid = (e) => ({ x: (e.start.x + e.end.x) / 2, y: (e.start.y + e.end.y) / 2 });

    const infos = roomEls.map((room, i) => {
      const pts = roomPoints(room);
      const fin = getFinish(room);
      const areaSqft = polyArea(pts) / SQPX_PER_SQFT;
      const perimeterFt = polyPerimeter(pts) / PPF;
      const name = `${multi ? `${pg.name} · ` : ''}${room.label || `Room ${i + 1}`}`;
      const adjD = doors.filter(d => distToPolyEdge(mid(d), pts) <= ADJ_TOL);
      const adjW = wins.filter(w => distToPolyEdge(mid(w), pts) <= ADJ_TOL);
      const doorFt = adjD.reduce((s, d) => s + lenFt(d), 0);
      const footprintSqft = fixed.reduce((s, c) =>
        s + clippedArea(pts, { x0: c.x, y0: c.y, x1: c.x + c.w, y1: c.y + c.h }) / SQPX_PER_SQFT, 0);

      // ── flooring ──
      let floor = null;
      const f = fin.floor;
      if (f.material !== 'none' && FLOOR_MATERIALS[f.material]) {
        const mat = FLOOR_MATERIALS[f.material];
        const deduct = fin.deductFixed ? footprintSqft : 0;
        const net = Math.max(0, areaSqft - deduct);
        const wastePct = f.waste ?? autoWaste(f);
        const order = net * (1 + wastePct / 100);
        const pieceSqft = (f.w * f.l) / 144;
        const isTile = f.material === 'tile';
        floor = {
          material: f.material, label: mat.label, pattern: f.pattern, w: f.w, l: f.l, color: f.color,
          netSqft: r2(net), deductSqft: r2(deduct), wastePct, orderSqft: r2(order),
          pieces: pieceSqft > 0 && !mat.soldBy ? Math.ceil(order / pieceSqft) : 0,
          boxSqft: f.boxSqft,
          boxes: f.boxSqft > 0 && !mat.soldBy ? Math.ceil(order / f.boxSqft - 1e-9) : null,
          sqYd: mat.soldBy === 'sqyd' ? r2(order / 9) : null,
          groutLbs: isTile ? net * 144 * ((f.l + f.w) / (f.l * f.w)) * f.thicknessIn * f.jointIn * GROUT_LB_PER_IN3 * 1.1 : 0,
          thinsetBags: isTile ? net / (Math.max(f.w, f.l) >= 15 ? 60 : 90) : 0,
          underlaymentSqft: f.underlayment ? net * 1.05 : 0,
          subfloorPrepSqft: f.subfloorPrep ? net : 0,
          floorLevelingSqft: f.floorLeveling ? net : 0,
          waterproofingSqft: f.waterproofing ? net * 1.05 : 0,
          crackIsolationSqft: f.crackIsolation ? net * 1.05 : 0,
        };
      }

      // ── wall paint ──
      let walls = null;
      if (fin.walls.paint) {
        const h = fin.wallHeightFt ?? S.ceilingFt;
        const gross = perimeterFt * h;
        const dOpen = adjD.reduce((s, d) => s + lenFt(d) * ((d.heightIn ?? S.doorHeightIn) / 12), 0);
        const wOpen = adjW.reduce((s, w) => s + lenFt(w) * ((w.heightIn ?? S.windowHeightIn) / 12), 0);
        const net = Math.max(0, gross - dOpen - wOpen);
        walls = {
          heightFt: h, grossSqft: r2(gross), openingsSqft: r2(dOpen + wOpen), netSqft: r2(net),
          doors: adjD.length, windows: adjW.length, coats: fin.walls.coats, color: fin.walls.color,
          gallons: r2((net * fin.walls.coats) / S.paintCoverage),
          primerGallons: fin.walls.primer ? r2(net / S.primerCoverage) : 0,
        };
      }

      // ── ceiling paint ──
      const ceiling = fin.ceiling.paint
        ? { sqft: r2(areaSqft), coats: fin.ceiling.coats, color: fin.ceiling.color, gallons: r2((areaSqft * fin.ceiling.coats) / S.paintCoverage) }
        : null;

      // ── baseboard ──
      const bLf = Math.max(0, perimeterFt - doorFt);
      const baseboard = fin.baseboard.enabled
        ? { lf: r2(bLf), orderLf: r2(bLf * (1 + S.trimWastePct / 100)), heightIn: fin.baseboard.heightIn, color: fin.baseboard.color }
        : null;

      return {
        pts, fin,
        result: { id: room.id, name, floorName: pg.name, areaSqft: r2(areaSqft), perimeterFt: r2(perimeterFt), footprintSqft: r2(footprintSqft), floor, walls, ceiling, baseboard },
      };
    });
    rooms.push(...infos.map(i => i.result));

    // ── transitions: a strip wherever flooring changes at a doorway (or at an exterior threshold) ──
    doors.forEach((d) => {
      const adj = infos.filter(r => distToPolyEdge(mid(d), r.pts) <= ADJ_TOL);
      if (!adj.some(r => r.fin.floor.material !== 'none')) return;
      const sig = new Set(adj.map(r => (r.fin.floor.material === 'none' ? 'none' : `${r.fin.floor.material}|${r.fin.floor.color}`)));
      if (adj.length >= 2 && sig.size === 1) return;
      transCount += 1; transLf += lenFt(d);
    });
  });

  // ───────────────────────── aggregate into purchasable lines ─────────────────────────
  const lines = [];
  const add = (category, item, qty, unit, note = '') => lines.push({ category, item, qty: r2(qty), unit, note });

  // flooring grouped by product so boxes are rounded once for the whole job
  const fg = new Map();
  rooms.forEach((r) => {
    if (!r.floor) return;
    const f = r.floor;
    const key = [f.material, f.w, f.l, f.pattern, f.color].join('|');
    const g = fg.get(key) || { f, net: 0, order: 0, grout: 0, thinset: 0, rooms: [] };
    g.net += f.netSqft; g.order += f.orderSqft; g.grout += f.groutLbs; g.thinset += f.thinsetBags; g.rooms.push(r.name);
    fg.set(key, g);
  });
  let underlay = 0;
  let subfloorPrep = 0, leveling = 0, waterproofing = 0, crackIsolation = 0;
  rooms.forEach((r) => {
    if (!r.floor) return;
    subfloorPrep += r.floor.subfloorPrepSqft || 0;
    leveling += r.floor.floorLevelingSqft || 0;
    waterproofing += r.floor.waterproofingSqft || 0;
    crackIsolation += r.floor.crackIsolationSqft || 0;
  });
  fg.forEach((g) => {
    const f = g.f;
    const size = f.material === 'carpet' ? '' : ` ${f.w}×${f.l}"`;
    const pat = FLOOR_MATERIALS[f.material].noPattern ? '' : ` – ${FLOOR_PATTERNS[f.pattern]?.label || f.pattern}`;
    const where = `${g.rooms.join(', ')} · net ${r2(g.net)} sf, ${f.wastePct}% waste`;
    if (f.material === 'carpet') add('Flooring', `Carpet${pat}`, g.order / 9, 'sq yd', where);
    else {
      add('Flooring', `${FLOOR_MATERIALS[f.material].label}${size}${pat}`, g.order, 'sq ft', where);
      if (f.boxSqft > 0) add('Flooring', `…as boxes (${f.boxSqft} sf/box)`, Math.ceil(g.order / f.boxSqft - 1e-9), 'boxes', 'rounded up for the whole job');
    }
    if (f.material === 'tile') {
      add('Tile setting', 'Thin-set mortar (50 lb bag)', Math.ceil(g.thinset - 1e-9), 'bags', 'est. – check trowel size / bag coverage');
      add('Tile setting', 'Grout', g.grout, 'lb', `≈ ${Math.ceil(g.grout / 25 - 1e-9)} × 25 lb bags · joint ${f.jointIn}" · volume-based est.`);
    }
  });
  if (subfloorPrep > 0) add('Floor preparation', 'Subfloor cleaning / preparation', subfloorPrep, 'sq ft', 'Confirm substrate is clean, dry, sound and flat before installation');
  if (leveling > 0) add('Floor preparation', 'Self-leveling compound', leveling, 'sq ft', 'Quantity is coverage area; verify low spots and product coverage');
  if (waterproofing > 0) add('Tile setting', 'Waterproofing membrane', waterproofing, 'sq ft', 'Recommended for wet areas; include seams, corners and penetrations');
  if (crackIsolation > 0) add('Tile setting', 'Crack-isolation membrane', crackIsolation, 'sq ft', 'Use where substrate movement or cracks require isolation');
  rooms.forEach((r) => { underlay += r.floor?.underlaymentSqft || 0; });
  if (underlay > 0) add('Flooring', 'Underlayment (+5% overlap)', underlay, 'sq ft');
  if (transCount > 0) {
    add('Flooring', 'Transition strips / thresholds', transCount, 'ea', `${r2(transLf)} LF total, one per doorway where flooring changes`);
  }

  // paint grouped by colour
  const wallPaint = new Map(), ceilPaint = new Map();
  let primer = 0, wallSqft = 0;
  rooms.forEach((r) => {
    if (r.walls) {
      const g = wallPaint.get(r.walls.color) || { gal: 0, sqft: 0, coats: r.walls.coats };
      g.gal += r.walls.gallons; g.sqft += r.walls.netSqft; wallPaint.set(r.walls.color, g);
      primer += r.walls.primerGallons; wallSqft += r.walls.netSqft;
    }
    if (r.ceiling) {
      const g = ceilPaint.get(r.ceiling.color) || { gal: 0, sqft: 0 };
      g.gal += r.ceiling.gallons; g.sqft += r.ceiling.sqft; ceilPaint.set(r.ceiling.color, g);
    }
  });
  wallPaint.forEach((g, color) => add('Paint', `Wall paint ${color}`, ceilTo(g.gal, 0.25), 'gal', `${r2(g.sqft)} sf net · ${g.coats} coat(s) · ${S.paintCoverage} sf/gal · exact ${r2(g.gal)} gal`));
  if (primer > 0) add('Paint', 'Primer', ceilTo(primer, 0.25), 'gal', `${S.primerCoverage} sf/gal`);
  ceilPaint.forEach((g, color) => add('Paint', `Ceiling paint ${color}`, ceilTo(g.gal, 0.25), 'gal', `${r2(g.sqft)} sf · exact ${r2(g.gal)} gal`));

  // trim grouped by height
  const trim = new Map();
  let trimLf = 0;
  rooms.forEach((r) => {
    if (!r.baseboard) return;
    const g = trim.get(r.baseboard.heightIn) || { lf: 0, order: 0 };
    g.lf += r.baseboard.lf; g.order += r.baseboard.orderLf; trim.set(r.baseboard.heightIn, g);
    trimLf += r.baseboard.orderLf;
  });
  trim.forEach((g, h) => add('Trim', `Baseboard ${h}"`, g.order, 'LF', `${r2(g.lf)} LF net + ${S.trimWastePct}% (doorways deducted)`));

  // cabinets & counters
  const cg = new Map();
  allCabs.forEach((c) => {
    const key = `${c.kind}|${c.lenIn}|${c.depthIn}|${c.heightIn}|${c.sink ? 1 : 0}`;
    const g = cg.get(key) || { c, n: 0 };
    g.n += 1; cg.set(key, g);
  });
  const kindOrder = ['base', 'tall', 'wall', 'vanity', 'island'];
  [...cg.values()]
    .sort((a, b) => kindOrder.indexOf(a.c.kind) - kindOrder.indexOf(b.c.kind) || a.c.lenIn - b.c.lenIn)
    .forEach(({ c, n }) => add('Cabinets', `${CAB_KINDS[c.kind]?.label || c.kind} cabinet ${c.lenIn}"×${c.depthIn}"×${c.heightIn}"${c.sink ? ' (sink)' : ''}`, n, 'ea', c.style ? `style: ${c.style}` : ''));

  const lf = (arr) => arr.reduce((s, c) => s + c.lenIn / 12, 0);
  const baseRun = allCabs.filter(c => c.kind === 'base');
  const counterSqft =
    allCabs.filter(c => c.kind === 'base' || c.kind === 'vanity').reduce((s, c) => s + (c.lenIn * S.countertopDepthIn) / 144, 0) +
    allCabs.filter(c => c.kind === 'island').reduce((s, c) => s + (c.lenIn * c.depthIn) / 144, 0);
  const backsplashSqft = (lf(baseRun) * S.backsplashHeightIn) / 12;
  if (allCabs.length) {
    add('Cabinets', 'Base + vanity run', lf(allCabs.filter(c => c.kind === 'base' || c.kind === 'vanity')), 'LF');
    const wallRun = lf(allCabs.filter(c => c.kind === 'wall'));
    if (wallRun > 0) add('Cabinets', 'Wall cabinet run', wallRun, 'LF');
    if (counterSqft > 0) add('Cabinets', 'Countertop', counterSqft, 'sq ft', `${S.countertopDepthIn}" deep on runs, full footprint on islands`);
    if (backsplashSqft > 0) add('Cabinets', 'Backsplash (kitchen base runs)', backsplashSqft, 'sq ft', `${S.backsplashHeightIn}" high, windows not deducted`);
  }

  const totals = {
    floorNetSqft: r2(rooms.reduce((s, r) => s + (r.floor?.netSqft || 0), 0)),
    floorOrderSqft: r2(rooms.reduce((s, r) => s + (r.floor?.orderSqft || 0), 0)),
    floorPrepSqft: r2(rooms.reduce((s, r) => s + (r.floor?.subfloorPrepSqft || 0) + (r.floor?.floorLevelingSqft || 0), 0)),
    membraneSqft: r2(rooms.reduce((s, r) => s + (r.floor?.waterproofingSqft || 0) + (r.floor?.crackIsolationSqft || 0), 0)),
    wallPaintSqft: r2(wallSqft),
    wallGallons: r2([...wallPaint.values()].reduce((s, g) => s + g.gal, 0)),
    ceilingGallons: r2([...ceilPaint.values()].reduce((s, g) => s + g.gal, 0)),
    baseboardLf: r2(trimLf),
    cabinetCount: allCabs.length,
    cabinetLf: r2(lf(allCabs.filter(c => c.kind !== 'wall' && c.kind !== 'island'))),
    countertopSqft: r2(counterSqft),
    backsplashSqft: r2(backsplashSqft),
    transitions: transCount,
  };

  const assumptions = [
    'Draw rooms along the inside face of the walls. Doors and windows count toward a room when they sit on its outline (within about 8").',
    `Paint: ${S.paintCoverage} sf per gallon per coat, primer ${S.primerCoverage} sf/gal; doors ${S.doorHeightIn}" and windows ${S.windowHeightIn}" high unless overridden. Gallons round up to ¼.`,
    'Tile: thin-set 90 sf/bag (60 sf/bag when a side is 15" or more); grout is volume-based +10%.',
    'Waste defaults: tile 10%, LVP 7%, hardwood 10%, laminate 8%, carpet 10%, +5% diagonal, +10% herringbone. Override per room.',
    'Box coverage and plank sizes are typical placeholders – replace them with the product spec sheet.',
  ];

  return { settings: S, rooms, lines, totals, assumptions };
}

export const toCsv = (lines) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return ['Category,Item,Qty,Unit,Note', ...lines.map(l => [l.category, l.item, l.qty, l.unit, l.note].map(esc).join(','))].join('\n');
};
