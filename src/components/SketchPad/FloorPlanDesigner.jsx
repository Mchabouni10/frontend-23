// src/components/SketchPad/FloorPlanDesigner.jsx
// Professional Floor Plan Designer — fully self-contained
// 2-D canvas with many tools + built-in canvas 3-D viewer (no Three.js)

import React, {
  useRef, useEffect, useState, createContext, useContext
} from 'react';
import {
  Camera, Save, Download, ZoomIn, ZoomOut, Maximize2,
  Undo, Redo, Grid3x3, Trash2, Move, Pen, Square, Circle,
  Type, Minus, Edit3, DoorOpen, Maximize, Copy, Plus,
  Eye, EyeOff, Layers, RotateCw, ChevronDown,
  ChevronRight, Eraser, Ruler, MousePointer
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════
const PPF = 20;            // pixels per foot
const WALL_H_PX = 9 * PPF; // 9-ft ceiling in px
const DEF_WALL_T = 12;     // default wall thickness px (~6 inches)
const ROOM_COLORS = [
  '#dbeafe','#dcfce7','#fef9c3','#fce7f3',
  '#e0f2fe','#f3e8ff','#ffedd5','#ecfdf5',
  '#fee2e2','#cffafe',
];

// ═══════════════════════════════════════════════════════════
// ELEMENT PRESETS — fixtures & furniture (dimensions in px)
// ═══════════════════════════════════════════════════════════
const PRESETS = {
  // Bathroom
  toilet:   { w:56,  h:72,  layer:'fixtures',  fill:'#dbeafe', stroke:'#3b82f6', label:'Toilet',       sym:'toilet' },
  sink:     { w:56,  h:52,  layer:'fixtures',  fill:'#dbeafe', stroke:'#3b82f6', label:'Sink',         sym:'sink' },
  bathtub:  { w:70,  h:140, layer:'fixtures',  fill:'#dbeafe', stroke:'#3b82f6', label:'Bathtub',      sym:'bathtub' },
  shower:   { w:80,  h:80,  layer:'fixtures',  fill:'#e0f2fe', stroke:'#0284c7', label:'Shower',       sym:'shower' },
  // Kitchen
  counter:  { w:160, h:50,  layer:'fixtures',  fill:'#fef9c3', stroke:'#ca8a04', label:'Counter',      sym:'counter' },
  island:   { w:120, h:80,  layer:'fixtures',  fill:'#fef9c3', stroke:'#ca8a04', label:'Island',       sym:'box' },
  stove:    { w:60,  h:60,  layer:'fixtures',  fill:'#fef9c3', stroke:'#ca8a04', label:'Stove',        sym:'stove' },
  fridge:   { w:60,  h:70,  layer:'fixtures',  fill:'#e2e8f0', stroke:'#64748b', label:'Fridge',       sym:'fridge' },
  // Living / Bedroom
  sofa:     { w:200, h:90,  layer:'furniture', fill:'#fce7f3', stroke:'#db2777', label:'Sofa',         sym:'sofa' },
  loveseat: { w:140, h:90,  layer:'furniture', fill:'#fce7f3', stroke:'#db2777', label:'Loveseat',     sym:'sofa' },
  armchair: { w:80,  h:80,  layer:'furniture', fill:'#fce7f3', stroke:'#db2777', label:'Armchair',     sym:'chair' },
  bed_q:    { w:160, h:200, layer:'furniture', fill:'#f3e8ff', stroke:'#9333ea', label:'Queen Bed',    sym:'bed' },
  bed_t:    { w:100, h:200, layer:'furniture', fill:'#f3e8ff', stroke:'#9333ea', label:'Twin Bed',     sym:'bed' },
  desk:     { w:140, h:70,  layer:'furniture', fill:'#dcfce7', stroke:'#16a34a', label:'Desk',         sym:'box' },
  table_d:  { w:160, h:100, layer:'furniture', fill:'#fef3c7', stroke:'#d97706', label:'Dining Table', sym:'table' },
  table_c:  { w:100, h:60,  layer:'furniture', fill:'#fef3c7', stroke:'#d97706', label:'Coffee Table', sym:'box' },
  dresser:  { w:120, h:50,  layer:'furniture', fill:'#f3e8ff', stroke:'#9333ea', label:'Dresser',      sym:'dresser' },
  wardrobe: { w:120, h:60,  layer:'furniture', fill:'#f3e8ff', stroke:'#9333ea', label:'Wardrobe',     sym:'box' },
};

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════
const toFt = (px) => {
  const totalIn = Math.round((Math.abs(px) / PPF) * 12);
  const ft = Math.floor(totalIn / 12);
  const inches = totalIn % 12;
  if (ft === 0) return `${inches}"`;
  if (inches === 0) return `${ft}'`;
  return `${ft}' ${inches}"`;
};

const snapV = (v, g) => Math.round(v / g) * g;

// ═══════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════
const Ctx = createContext(null);
const useC = () => useContext(Ctx);

let roomColorIdx = 0;
const nextRoomColor = () => ROOM_COLORS[roomColorIdx++ % ROOM_COLORS.length];

const Provider = ({ children }) => {
  const [pages, setPages] = useState([{ id: 1, name: 'Floor 1', elements: [] }]);
  const [pid, setPid] = useState(1);
  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#2c3e50');
  const [fillColor, setFillColor] = useState(ROOM_COLORS[0]);
  const [strokeW, setStrokeW] = useState(2);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hist, setHist] = useState([[]]);
  const [hIdx, setHIdx] = useState(0);
  const [selId, setSelId] = useState(null);
  const [view, setView] = useState('2d');
  const [layers, setLayers] = useState([
    { id: 'walls',       name: 'Walls',       visible: true },
    { id: 'rooms',       name: 'Rooms',       visible: true },
    { id: 'fixtures',    name: 'Fixtures',    visible: true },
    { id: 'furniture',   name: 'Furniture',   visible: true },
    { id: 'annotations', name: 'Annotations', visible: true },
  ]);
  const [curLayer, setCurLayer] = useState('walls');
  const [sideTab, setSideTab] = useState('props'); // 'props'|'layers'|'pages'

  const page = pages.find(p => p.id === pid) || pages[0];
  const selEl = page.elements.find(e => e.id === selId) || null;
  const visLayers = new Set(layers.filter(l => l.visible).map(l => l.id));

  const setEls = (newEls, addHist = true) => {
    setPages(prev => prev.map(p => p.id === pid ? { ...p, elements: newEls } : p));
    if (addHist) {
      setHist(prev => {
        const stk = [...prev.slice(0, hIdx + 1), [...newEls]];
        setHIdx(stk.length - 1);
        return stk;
      });
    }
  };

  const undo = () => {
    if (hIdx <= 0) return;
    const ni = hIdx - 1;
    setHIdx(ni);
    setPages(prev => prev.map(p => p.id === pid ? { ...p, elements: [...hist[ni]] } : p));
    setSelId(null);
  };

  const redo = () => {
    if (hIdx >= hist.length - 1) return;
    const ni = hIdx + 1;
    setHIdx(ni);
    setPages(prev => prev.map(p => p.id === pid ? { ...p, elements: [...hist[ni]] } : p));
  };

  const delSel = () => {
    if (!selId) return;
    setEls(page.elements.filter(e => e.id !== selId));
    setSelId(null);
  };

  const dupSel = () => {
    if (!selEl) return;
    const dup = { ...selEl, id: Date.now() };
    if (dup.start) { dup.start = { ...dup.start, x: dup.start.x + 20, y: dup.start.y + 20 }; dup.end = { ...dup.end, x: dup.end.x + 20, y: dup.end.y + 20 }; }
    else if (dup.x !== undefined) { dup.x += 20; dup.y += 20; }
    setEls([...page.elements, dup]);
    setSelId(dup.id);
  };

  const rotateSel = () => {
    if (!selEl) return;
    const updated = page.elements.map(e => {
      if (e.id !== selId) return e;
      if (e.w !== undefined && e.h !== undefined) {
        const cx = e.x + e.w / 2;
        const cy = e.y + e.h / 2;
        return { ...e, w: e.h, h: e.w, x: cx - e.h / 2, y: cy - e.w / 2 };
      }
      return e;
    });
    setEls(updated);
    setSelId(selId);
  };

  const clearAll = () => {
    if (window.confirm('Clear all elements on this page?')) {
      setEls([]); setSelId(null);
    }
  };

  const addPage = () => {
    const np = { id: Date.now(), name: `Floor ${pages.length + 1}`, elements: [] };
    setPages(p => [...p, np]);
    setPid(np.id);
    setHist([[]]); setHIdx(0); setSelId(null);
  };

  const delPage = (id) => {
    if (pages.length === 1) return;
    const rest = pages.filter(p => p.id !== id);
    setPages(rest);
    if (pid === id) setPid(rest[0].id);
  };

  const updateSelEl = (key, val) => {
    if (!selEl) return;
    const updated = page.elements.map(e => e.id === selId ? { ...e, [key]: val } : e);
    setEls(updated);
    setSelId(selId);
  };

  const toggleLayer = (id) => setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));

  const exportPng = () => {
    const c = document.getElementById('fp-canvas');
    if (!c) return;
    const tmp = document.createElement('canvas');
    tmp.width = c.width; tmp.height = c.height;
    const ctx = tmp.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(c, 0, 0);
    tmp.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `floorplan-${Date.now()}.png`; a.click();
      URL.revokeObjectURL(url);
    });
  };

  const saveJson = () => {
    const blob = new Blob([JSON.stringify({ pages }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `floorplan-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const loadJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.pages) {
          setPages(data.pages);
          setPid(data.pages[0].id);
          setHist([[]]); setHIdx(0); setSelId(null);
        }
      } catch { alert('Invalid project file'); }
    };
    reader.readAsText(file);
  };

  return (
    <Ctx.Provider value={{
      pages, pid, setPid, page, selEl, selId, setSelId,
      tool, setTool, color, setColor, fillColor, setFillColor,
      strokeW, setStrokeW, showGrid, setShowGrid, gridSize, setGridSize,
      snap, setSnap, zoom, setZoom, pan, setPan,
      hIdx, hist, undo, redo, setEls,
      delSel, dupSel, rotateSel, clearAll,
      addPage, delPage, updateSelEl,
      view, setView, layers, curLayer, setCurLayer, toggleLayer, visLayers,
      sideTab, setSideTab, exportPng, saveJson, loadJson, nextRoomColor,
    }}>
      {children}
    </Ctx.Provider>
  );
};

// ═══════════════════════════════════════════════════════════
// ELEMENT DRAWING  (pure canvas 2-D)
// ═══════════════════════════════════════════════════════════
const drawMeasure = (ctx, ax, ay, bx, by, zoom) => {
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 15 * zoom) return;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const ang = Math.atan2(by - ay, bx - ax);
  const label = toFt(len / zoom);
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(ang);
  if (Math.abs(ang) > Math.PI / 2) ctx.rotate(Math.PI);
  ctx.font = `bold ${11 / zoom}px Poppins, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(-tw / 2 - 3 / zoom, -16 / zoom, tw + 6 / zoom, 13 / zoom);
  ctx.fillStyle = '#2c3e50';
  ctx.fillText(label, 0, -4 / zoom);
  ctx.restore();
};

const drawPresetSymbol = (ctx, el, zoom) => {
  const { x, y, w, h, sym, fill, stroke, label } = el;
  const lw = 1.5 / zoom;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;

  if (sym === 'toilet') {
    // Tank (top)
    const th = h * 0.3;
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.roundRect(x, y, w, th, [3/zoom]); ctx.fill(); ctx.stroke();
    // Bowl (oval)
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + th + (h - th)*0.5, w*0.45, (h - th)*0.45, 0, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
  } else if (sym === 'sink') {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, [6/zoom]); ctx.fill(); ctx.stroke();
    // drain
    ctx.beginPath(); ctx.arc(x+w/2, y+h/2, 4/zoom, 0, Math.PI*2);
    ctx.fillStyle = stroke; ctx.fill();
    // faucet line
    ctx.beginPath(); ctx.moveTo(x+w/2, y+8/zoom); ctx.lineTo(x+w/2, y+h/2-5/zoom); ctx.stroke();
  } else if (sym === 'bathtub') {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, [8/zoom]); ctx.fill(); ctx.stroke();
    // inner
    ctx.beginPath();
    ctx.ellipse(x+w/2, y + h*0.55, w*0.35, h*0.32, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill(); ctx.stroke();
    // faucet
    ctx.fillStyle = stroke;
    ctx.beginPath(); ctx.arc(x+w/2, y+12/zoom, 5/zoom, 0, Math.PI*2); ctx.fill();
  } else if (sym === 'shower') {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
    // diagonal lines
    ctx.strokeStyle = stroke + '60';
    ctx.lineWidth = 1/zoom;
    for (let i = 0; i < 5; i++) {
      const off = (w + h) * i / 4;
      ctx.beginPath(); ctx.moveTo(x + Math.min(off, w), y + Math.max(0, off - w));
      ctx.lineTo(x + Math.max(0, off - h), y + Math.min(off, h)); ctx.stroke();
    }
    // showerhead
    ctx.strokeStyle = stroke; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(x + w*0.2, y + h*0.2, 5/zoom, 0, Math.PI*2); ctx.stroke();
  } else if (sym === 'stove') {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
    // 4 burners
    const bx = [x+w*0.3, x+w*0.7, x+w*0.3, x+w*0.7];
    const by = [y+h*0.3, y+h*0.3, y+h*0.7, y+h*0.7];
    bx.forEach((bxi, i) => {
      ctx.beginPath(); ctx.arc(bxi, by[i], 7/zoom, 0, Math.PI*2);
      ctx.fillStyle = '#f97316'; ctx.fill(); ctx.stroke();
    });
  } else if (sym === 'fridge') {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, [4/zoom]); ctx.fill(); ctx.stroke();
    // handle
    ctx.beginPath(); ctx.moveTo(x+w*0.7, y+h*0.15); ctx.lineTo(x+w*0.7, y+h*0.4);
    ctx.lineWidth = 3/zoom; ctx.stroke();
    // divider
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x, y+h*0.55); ctx.lineTo(x+w, y+h*0.55); ctx.stroke();
  } else if (sym === 'counter') {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
    // front edge
    ctx.beginPath();
    ctx.moveTo(x, y + h*0.8); ctx.lineTo(x+w, y+h*0.8);
    ctx.strokeStyle = stroke + '80'; ctx.stroke();
  } else if (sym === 'sofa') {
    ctx.fillStyle = fill;
    // Back
    ctx.beginPath(); ctx.roundRect(x, y, w, h*0.35, [4/zoom]); ctx.fill(); ctx.stroke();
    // Seat
    ctx.beginPath(); ctx.roundRect(x, y+h*0.35, w, h*0.65, [4/zoom]); ctx.fill(); ctx.stroke();
    // Cushion dividers (3 seats)
    ctx.strokeStyle = stroke + '80'; ctx.lineWidth = 1/zoom;
    ctx.beginPath(); ctx.moveTo(x+w/3, y+h*0.35); ctx.lineTo(x+w/3, y+h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+w*2/3, y+h*0.35); ctx.lineTo(x+w*2/3, y+h); ctx.stroke();
    // Armrests
    ctx.fillStyle = stroke + '30';
    ctx.strokeStyle = stroke; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.roundRect(x, y+h*0.35, w*0.08, h*0.65, [2/zoom]); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x+w*0.92, y+h*0.35, w*0.08, h*0.65, [2/zoom]); ctx.fill(); ctx.stroke();
  } else if (sym === 'bed') {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
    // Headboard
    ctx.fillStyle = stroke + '40';
    ctx.beginPath(); ctx.roundRect(x, y, w, h*0.18, [4/zoom]); ctx.fill(); ctx.stroke();
    // Pillows
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const pw = w < 130 ? w * 0.7 : w * 0.35;
    const ph = h * 0.1;
    if (w >= 130) {
      ctx.beginPath(); ctx.roundRect(x + w*0.08, y + h*0.22, pw, ph, [2/zoom]); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(x + w*0.56, y + h*0.22, pw, ph, [2/zoom]); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.roundRect(x + w*0.15, y + h*0.22, pw, ph, [2/zoom]); ctx.fill(); ctx.stroke();
    }
    // Blanket fold
    ctx.fillStyle = stroke + '15';
    ctx.beginPath(); ctx.rect(x, y+h*0.36, w, h*0.64); ctx.fill();
    ctx.strokeStyle = stroke + '80'; ctx.lineWidth = 1/zoom;
    ctx.beginPath(); ctx.moveTo(x, y+h*0.36); ctx.lineTo(x+w, y+h*0.36); ctx.stroke();
  } else if (sym === 'chair') {
    ctx.fillStyle = fill;
    // Seat
    ctx.beginPath(); ctx.roundRect(x + w*0.1, y + h*0.2, w*0.8, h*0.8, [4/zoom]); ctx.fill(); ctx.stroke();
    // Back
    ctx.beginPath(); ctx.roundRect(x + w*0.1, y, w*0.8, h*0.25, [4/zoom]); ctx.fill(); ctx.stroke();
  } else if (sym === 'dresser') {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
    // Drawers
    const drawers = 3;
    for (let i = 0; i < drawers; i++) {
      const dw = w / drawers;
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      ctx.strokeRect(x + i*dw + 3/zoom, y + 3/zoom, dw - 6/zoom, h - 6/zoom);
      // Handle
      ctx.beginPath(); ctx.arc(x + i*dw + dw/2, y + h/2, 3/zoom, 0, Math.PI*2);
      ctx.fillStyle = stroke; ctx.fill();
    }
  } else if (sym === 'table') {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, [6/zoom]); ctx.fill(); ctx.stroke();
    // Chairs around
    ctx.fillStyle = stroke + '30';
    const cs = 14/zoom;
    [[x+w/2-cs/2, y-cs-2/zoom],[x+w/2-cs/2, y+h+2/zoom],[x-cs-2/zoom, y+h/2-cs/2],[x+w+2/zoom, y+h/2-cs/2]].forEach(([cx2,cy2]) => {
      ctx.beginPath(); ctx.roundRect(cx2, cy2, cs, cs, [2/zoom]); ctx.fill(); ctx.stroke();
    });
  } else {
    // Generic box
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, [4/zoom]); ctx.fill(); ctx.stroke();
  }

  // Label
  ctx.fillStyle = stroke;
  ctx.font = `${Math.max(8, Math.min(11, w * 0.1))/zoom}px Poppins, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w/2, y + h/2);
};

const drawEl = (ctx, el, isSelected, zoom, useDark) => {
  if (!el) return;
  const lw = (el.strokeWidth || 2) / zoom;

  ctx.save();
  ctx.strokeStyle = el.color || '#2c3e50';
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (el.type) {
    case 'wall': {
      const { start: s, end: e } = el;
      const dx = e.x - s.x, dy = e.y - s.y;
      const len = Math.hypot(dx, dy);
      const t = (el.thickness || DEF_WALL_T);
      const nx = -dy / len * t / 2, ny = dx / len * t / 2;
      ctx.save();
      // Fill
      ctx.beginPath();
      ctx.moveTo(s.x + nx, s.y + ny);
      ctx.lineTo(e.x + nx, e.y + ny);
      ctx.lineTo(e.x - nx, e.y - ny);
      ctx.lineTo(s.x - nx, s.y - ny);
      ctx.closePath();
      ctx.fillStyle = useDark ? '#4b5563' : '#cfd8dc';
      ctx.fill();
      // Outer lines
      ctx.strokeStyle = useDark ? '#9ca3af' : '#546e7a';
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.moveTo(s.x + nx, s.y + ny); ctx.lineTo(e.x + nx, e.y + ny);
      ctx.moveTo(s.x - nx, s.y - ny); ctx.lineTo(e.x - nx, e.y - ny);
      ctx.stroke();
      ctx.restore();
      drawMeasure(ctx, s.x, s.y, e.x, e.y, zoom);
      break;
    }
    case 'room': {
      const { start: s, end: e } = el;
      const rx = Math.min(s.x, e.x), ry = Math.min(s.y, e.y);
      const rw = Math.abs(e.x - s.x), rh = Math.abs(e.y - s.y);
      // Fill
      ctx.fillStyle = el.fillColor || '#dbeafe';
      ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.fill();
      // Hatch pattern border effect
      ctx.strokeStyle = el.color || '#3b82f6';
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();
      // Area label
      const area = (rw / PPF) * (rh / PPF);
      const label = el.label || 'Room';
      ctx.fillStyle = el.color || '#1d4ed8';
      ctx.font = `bold ${14 / zoom}px Poppins, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, rx + rw/2, ry + rh/2 - 9/zoom);
      ctx.font = `${11 / zoom}px Poppins, sans-serif`;
      ctx.fillStyle = (el.color || '#1d4ed8') + 'cc';
      ctx.fillText(`${area.toFixed(0)} sq ft`, rx + rw/2, ry + rh/2 + 7/zoom);
      drawMeasure(ctx, rx, ry, rx + rw, ry, zoom);
      drawMeasure(ctx, rx, ry, rx, ry + rh, zoom);
      break;
    }
    case 'door': {
      const { start: s, end: e } = el;
      const dx = e.x - s.x, dy = e.y - s.y;
      const doorLen = Math.hypot(dx, dy);
      // Door frame line
      ctx.strokeStyle = useDark ? '#d1d5db' : '#2c3e50';
      ctx.lineWidth = 3 / zoom;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      // Swing arc
      ctx.strokeStyle = useDark ? '#f87171' : '#e74c3c';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([3/zoom, 3/zoom]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, doorLen, Math.atan2(dy, dx) - Math.PI/2, Math.atan2(dy, dx));
      ctx.stroke();
      // Door panel line
      ctx.setLineDash([]);
      const perpAngle = Math.atan2(dy, dx) - Math.PI/2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(perpAngle) * doorLen, s.y + Math.sin(perpAngle) * doorLen);
      ctx.stroke();
      break;
    }
    case 'window': {
      const { start: s, end: e } = el;
      const dx = e.x - s.x, dy = e.y - s.y;
      const len = Math.hypot(dx, dy);
      const t = 8 / zoom;
      const nx = -dy / len * t, ny = dx / len * t;
      ctx.strokeStyle = useDark ? '#93c5fd' : '#0369a1';
      ctx.lineWidth = 2 / zoom;
      // Frame
      ctx.beginPath();
      ctx.moveTo(s.x + nx/2, s.y + ny/2); ctx.lineTo(e.x + nx/2, e.y + ny/2);
      ctx.moveTo(s.x - nx/2, s.y - ny/2); ctx.lineTo(e.x - nx/2, e.y - ny/2);
      ctx.stroke();
      // Glass (center line)
      ctx.strokeStyle = useDark ? '#bfdbfe' : '#7dd3fc';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      // End caps
      ctx.strokeStyle = useDark ? '#93c5fd' : '#0369a1';
      ctx.lineWidth = 3 / zoom;
      ctx.beginPath();
      ctx.moveTo(s.x - nx/2, s.y - ny/2); ctx.lineTo(s.x + nx/2, s.y + ny/2);
      ctx.moveTo(e.x - nx/2, e.y - ny/2); ctx.lineTo(e.x + nx/2, e.y + ny/2);
      ctx.stroke();
      break;
    }
    case 'stairs': {
      const { start: s, end: e } = el;
      const dx = e.x - s.x, dy = e.y - s.y;
      const steps = el.steps || 8;
      ctx.strokeStyle = useDark ? '#d1d5db' : '#374151';
      ctx.lineWidth = 1.5 / zoom;
      // Border
      ctx.strokeRect(s.x, s.y, dx, dy);
      // Treads
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const tx = s.x + dx * t, ty = s.y + dy * t;
        ctx.beginPath();
        if (Math.abs(dx) > Math.abs(dy)) {
          ctx.moveTo(tx, s.y); ctx.lineTo(tx, e.y);
        } else {
          ctx.moveTo(s.x, ty); ctx.lineTo(e.x, ty);
        }
        ctx.stroke();
      }
      // Arrow for direction
      const mx = s.x + dx/2, my = s.y + dy/2;
      ctx.strokeStyle = useDark ? '#60a5fa' : '#2563eb';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      if (Math.abs(dx) > Math.abs(dy)) {
        ctx.moveTo(mx - 10/zoom, my); ctx.lineTo(mx + 10/zoom, my);
        ctx.moveTo(mx + 6/zoom, my - 4/zoom); ctx.lineTo(mx + 10/zoom, my); ctx.lineTo(mx + 6/zoom, my + 4/zoom);
      } else {
        ctx.moveTo(mx, my - 10/zoom); ctx.lineTo(mx, my + 10/zoom);
        ctx.moveTo(mx - 4/zoom, my + 6/zoom); ctx.lineTo(mx, my + 10/zoom); ctx.lineTo(mx + 4/zoom, my + 6/zoom);
      }
      ctx.stroke();
      break;
    }
    case 'line': {
      const { start: s, end: e } = el;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      drawMeasure(ctx, s.x, s.y, e.x, e.y, zoom);
      break;
    }
    case 'rectangle': {
      const { start: s, end: e } = el;
      ctx.beginPath();
      ctx.rect(Math.min(s.x,e.x), Math.min(s.y,e.y), Math.abs(e.x-s.x), Math.abs(e.y-s.y));
      if (el.fill) { ctx.fillStyle = el.fill; ctx.fill(); }
      ctx.stroke();
      drawMeasure(ctx, Math.min(s.x,e.x), Math.min(s.y,e.y), Math.max(s.x,e.x), Math.min(s.y,e.y), zoom);
      drawMeasure(ctx, Math.min(s.x,e.x), Math.min(s.y,e.y), Math.min(s.x,e.x), Math.max(s.y,e.y), zoom);
      break;
    }
    case 'circle': {
      const r = Math.hypot(el.end.x - el.start.x, el.end.y - el.start.y);
      ctx.beginPath(); ctx.arc(el.start.x, el.start.y, r, 0, Math.PI * 2);
      if (el.fill) { ctx.fillStyle = el.fill; ctx.fill(); }
      ctx.stroke();
      drawMeasure(ctx, el.start.x, el.start.y, el.start.x + r, el.start.y, zoom);
      break;
    }
    case 'path': {
      if (!el.points || el.points.length < 2) break;
      ctx.beginPath();
      el.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
      break;
    }
    case 'text': {
      ctx.font = `${(el.fontSize || 16) / zoom}px Poppins, sans-serif`;
      ctx.fillStyle = el.color || '#2c3e50';
      // Background
      const tw = ctx.measureText(el.text).width;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(el.x - 2/zoom, el.y - (el.fontSize||16)/zoom - 2/zoom, tw + 4/zoom, (el.fontSize||16)/zoom + 4/zoom);
      ctx.fillStyle = el.color || '#2c3e50';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(el.text, el.x, el.y);
      break;
    }
    case 'dimension': {
      const { start: s, end: e } = el;
      const dx = e.x - s.x, dy = e.y - s.y;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len * 12/zoom, ny = dx / len * 12/zoom;
      ctx.strokeStyle = el.color || '#f59e0b';
      ctx.lineWidth = 1.5 / zoom;
      // extension lines
      ctx.beginPath();
      ctx.moveTo(s.x + nx, s.y + ny); ctx.lineTo(s.x - nx, s.y - ny);
      ctx.moveTo(e.x + nx, e.y + ny); ctx.lineTo(e.x - nx, e.y - ny);
      ctx.stroke();
      // dimension line
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      // arrows
      const ang = Math.atan2(dy, dx);
      const as = 8/zoom;
      [[s.x, s.y, ang + Math.PI],[e.x, e.y, ang]].forEach(([px, py, a]) => {
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
    case 'preset': {
      drawPresetSymbol(ctx, el, zoom);
      break;
    }
    default: break;
  }

  // Selection highlight
  if (isSelected) {
    ctx.setLineDash([5/zoom, 3/zoom]);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2 / zoom;
    if (el.start && el.end) {
      const ex = [el.start.x, el.end.x, ...(el.x !== undefined ? [el.x] : [])];
      const ey = [el.start.y, el.end.y, ...(el.y !== undefined ? [el.y] : [])];
      const pad = 10/zoom;
      ctx.strokeRect(
        Math.min(...ex) - pad, Math.min(...ey) - pad,
        Math.abs(el.end.x - el.start.x) + 2*pad, Math.abs(el.end.y - el.start.y) + 2*pad
      );
    } else if (el.x !== undefined && el.w !== undefined) {
      const pad = 6/zoom;
      ctx.strokeRect(el.x - pad, el.y - pad, el.w + 2*pad, el.h + 2*pad);
      // Resize handles
      ctx.setLineDash([]);
      ctx.fillStyle = '#3b82f6';
      [[el.x, el.y],[el.x+el.w, el.y],[el.x, el.y+el.h],[el.x+el.w, el.y+el.h]].forEach(([hx,hy]) => {
        ctx.beginPath(); ctx.arc(hx, hy, 4/zoom, 0, Math.PI*2); ctx.fill();
      });
    }
    ctx.setLineDash([]);
  }

  ctx.restore();
};

// ═══════════════════════════════════════════════════════════
// 3-D CANVAS VIEWER  (pure JS perspective renderer)
// ═══════════════════════════════════════════════════════════
const project3D = (wx, wy, wz, rotX, rotY, scale, viewW, viewH) => {
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  const x1 = wx * cosY + wz * sinY;
  const z1 = -wx * sinY + wz * cosY;
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  const y1 = wy * cosX - z1 * sinX;
  const z2 = wy * sinX + z1 * cosX;
  const fov = 700;
  const pz = fov / (fov + z2 + 400);
  return { sx: viewW/2 + x1 * pz * scale, sy: viewH/2 + y1 * pz * scale, depth: z2 };
};

const Canvas3D = () => {
  const { page, visLayers } = useC();
  const canvasRef = useRef(null);
  const [rot, setRot] = useState({ x: 0.45, y: 0.6 });
  const [drag, setDrag] = useState(null);
  const [zoom3, setZoom3] = useState(0.55);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const els = (page?.elements || []).filter(e => visLayers.has(e.layer || 'walls'));
    ctx.clearRect(0, 0, W, H);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(1, '#1e293b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Compute bounding box center
    let xs = [], zs = [];
    els.forEach(el => {
      if (el.start) { xs.push(el.start.x, el.end.x); zs.push(el.start.y, el.end.y); }
      if (el.x !== undefined) { xs.push(el.x, el.x + (el.w||0)); zs.push(el.y, el.y + (el.h||0)); }
    });
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 600;
    const cz = zs.length ? (Math.min(...zs) + Math.max(...zs)) / 2 : 400;
    const scale = zoom3 * 100;
    const p = (wx, wy, wz) => project3D(wx - cx, wy, wz - cz, rot.x, rot.y, scale, W, H);

    // Collect all faces for painter's algorithm
    const faces = [];

    // Floor grid
    const gridStep = 100; // 5 feet
    const gMin = -800, gMax = 800;
    for (let gx = gMin; gx <= gMax; gx += gridStep) {
      const a = p(cx + gx, 0, cz + gMin), b = p(cx + gx, 0, cz + gMax);
      faces.push({ type: 'line', pts: [a, b], color: 'rgba(148,163,184,0.12)', depth: (a.depth + b.depth) / 2 });
    }
    for (let gz = gMin; gz <= gMax; gz += gridStep) {
      const a = p(cx + gMin, 0, cz + gz), b = p(cx + gMax, 0, cz + gz);
      faces.push({ type: 'line', pts: [a, b], color: 'rgba(148,163,184,0.12)', depth: (a.depth + b.depth) / 2 });
    }

    // Rooms — floor fill
    els.filter(e => e.type === 'room').forEach(el => {
      const { start: s, end: e } = el;
      const x0 = Math.min(s.x, e.x), z0 = Math.min(s.y, e.y);
      const x1 = Math.max(s.x, e.x), z1 = Math.max(s.y, e.y);
      const corners = [p(x0,0,z0), p(x1,0,z0), p(x1,0,z1), p(x0,0,z1)];
      const depth = corners.reduce((a,c)=>a+c.depth,0)/4;
      faces.push({ type: 'poly', pts: corners, fill: (el.fillColor||'#dbeafe')+'55', stroke: (el.color||'#3b82f6')+'44', depth });
    });

    // Walls — 3D boxes
    els.filter(e => e.type === 'wall').forEach(el => {
      const { start: s, end: e } = el;
      const dx = e.x - s.x, dz = e.y - s.y;
      const len = Math.hypot(dx, dz) || 1;
      const t = (el.thickness || DEF_WALL_T);
      const nx = -dz / len * t/2, nz = dx / len * t/2;
      const wallH = WALL_H_PX;
      // 8 corners: [floor, ceiling] x [front-left, front-right, back-left, back-right]
      const C = [
        p(s.x+nx, 0, s.y+nz), p(e.x+nx, 0, e.y+nz),
        p(e.x-nx, 0, e.y-nz), p(s.x-nx, 0, s.y-nz),
        p(s.x+nx, wallH, s.y+nz), p(e.x+nx, wallH, e.y+nz),
        p(e.x-nx, wallH, e.y-nz), p(s.x-nx, wallH, s.y-nz),
      ];
      const wallFaces = [
        { pts:[C[4],C[5],C[6],C[7]], fill:'#cbd5e1', stroke:'#94a3b8' }, // top
        { pts:[C[0],C[1],C[5],C[4]], fill:'#94a3b8', stroke:'#64748b' }, // front
        { pts:[C[3],C[2],C[6],C[7]], fill:'#64748b', stroke:'#475569' }, // back
        { pts:[C[0],C[3],C[7],C[4]], fill:'#7c8ca0', stroke:'#5a6b7d' }, // left
        { pts:[C[1],C[2],C[6],C[5]], fill:'#7c8ca0', stroke:'#5a6b7d' }, // right
      ];
      wallFaces.forEach(f => {
        const depth = f.pts.reduce((a,c)=>a+c.depth,0)/f.pts.length;
        faces.push({ type:'poly', ...f, depth });
      });
    });

    // Preset elements — simple 3D boxes
    els.filter(e => e.type === 'preset').forEach(el => {
      const boxH = el.layer === 'furniture' ? 30 : 20;
      const x0=el.x, z0=el.y, x1=el.x+el.w, z1=el.y+el.h;
      const C = [
        p(x0,0,z0), p(x1,0,z0), p(x1,0,z1), p(x0,0,z1),
        p(x0,boxH,z0), p(x1,boxH,z0), p(x1,boxH,z1), p(x0,boxH,z1),
      ];
      const fill = el.fill || '#dbeafe';
      const stroke = el.stroke || '#3b82f6';
      [[C[4],C[5],C[6],C[7],fill],[C[0],C[1],C[5],C[4],fill+'aa'],[C[3],C[2],C[6],C[7],fill+'88']].forEach(([...pts2], i) => {
        const f = { type:'poly', pts: pts2.slice(0,4), fill: pts2[4], stroke, depth: pts2.slice(0,4).reduce((a,c)=>a+c.depth,0)/4 };
        faces.push(f);
      });
    });

    // Sort by depth (painter's algorithm)
    faces.sort((a, b) => b.depth - a.depth);

    // Draw
    faces.forEach(f => {
      if (f.type === 'line') {
        ctx.beginPath(); ctx.moveTo(f.pts[0].sx, f.pts[0].sy); ctx.lineTo(f.pts[1].sx, f.pts[1].sy);
        ctx.strokeStyle = f.color; ctx.lineWidth = 1; ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(f.pts[0].sx, f.pts[0].sy);
        f.pts.slice(1).forEach(pt => ctx.lineTo(pt.sx, pt.sy));
        ctx.closePath();
        if (f.fill) { ctx.fillStyle = f.fill; ctx.fill(); }
        if (f.stroke) { ctx.strokeStyle = f.stroke; ctx.lineWidth = 0.8; ctx.stroke(); }
      }
    });

    // Overlay hint
    ctx.fillStyle = 'rgba(148,163,184,0.5)';
    ctx.font = '12px Poppins, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Drag to orbit  ·  Scroll to zoom', 12, H - 14);
  }, [page, rot, zoom3, visLayers]);

  const handleMouseDown = (e) => setDrag({ x: e.clientX, y: e.clientY, rx: rot.x, ry: rot.y });
  const handleMouseMove = (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) * 0.008;
    const dy = (e.clientY - drag.y) * 0.006;
    setRot({ x: Math.max(0.05, Math.min(1.4, drag.rx + dy)), y: drag.ry + dx });
  };
  const handleMouseUp = () => setDrag(null);
  const handleWheel = (e) => { e.preventDefault(); setZoom3(z => Math.max(0.15, Math.min(2, z - e.deltaY * 0.0008))); };

  return (
    <div style={{ width:'100%', height:'100%', position:'relative' }}>
      <canvas
        ref={canvasRef}
        width={1200}
        height={750}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ width:'100%', height:'100%', cursor: drag ? 'grabbing':'grab', display:'block' }}
      />
      {(!page?.elements?.length || !page.elements.some(e => ['wall','room'].includes(e.type))) && (
        <div style={{
          position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          textAlign:'center', pointerEvents:'none'
        }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🏗️</div>
          <p style={{ color:'#94a3b8', fontSize:14, fontFamily:'Poppins, sans-serif', lineHeight:1.6 }}>
            Draw walls and rooms in 2D<br/>then switch back here to see your 3D model.
          </p>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// CANVAS 2-D
// ═══════════════════════════════════════════════════════════
const Canvas2D = () => {
  const {
    page, tool, color, fillColor, strokeW, showGrid, gridSize, snap: doSnap,
    zoom, setZoom, pan, setPan, setEls, selId, setSelId, selEl, visLayers,
    curLayer
  } = useC();

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [tempEl, setTempEl] = useState(null);
  const [dragOffset, setDragOffset] = useState(null);
  const [panStart, setPanStart] = useState(null);
  const [pathPoints, setPathPoints] = useState([]);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Resize canvas to container
  useEffect(() => {
    const resize = () => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const newWidth = wrap.clientWidth;
      const newHeight = wrap.clientHeight;
      // Only update if size actually changed to prevent infinite loop
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
      }
    };
    resize();
    
    let rafId = null;
    const ro = new ResizeObserver(() => {
      // Use rAF to batch resize updates and prevent loop
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(resize);
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  // Coordinate helpers
  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    let x = (e.clientX - rect.left - pan.x) / zoom;
    let y = (e.clientY - rect.top - pan.y) / zoom;
    if (doSnap) { x = snapV(x, gridSize); y = snapV(y, gridSize); }
    return { x, y };
  };

  // Hit testing
  const hitTest = (pos) => {
    const tol = 10 / zoom;
    return [...page.elements].reverse().find(el => {
      if (!visLayers.has(el.layer || 'walls')) return false;
      if (el.x !== undefined && el.w !== undefined) {
        return pos.x >= el.x - tol && pos.x <= el.x + el.w + tol &&
               pos.y >= el.y - tol && pos.y <= el.y + el.h + tol;
      }
      if (el.type === 'circle' && el.start && el.end) {
        const r = Math.hypot(el.end.x - el.start.x, el.end.y - el.start.y);
        return Math.abs(Math.hypot(pos.x - el.start.x, pos.y - el.start.y) - r) <= tol;
      }
      if (el.type === 'path' && el.points) {
        return el.points.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) <= tol * 2);
      }
      if (el.type === 'text') {
        const tw = (el.text?.length || 0) * (el.fontSize || 16) * 0.55;
        return pos.x >= el.x - tol && pos.x <= el.x + tw + tol &&
               pos.y >= el.y - (el.fontSize||16) - tol && pos.y <= el.y + tol;
      }
      if (el.start && el.end) {
        if (['room','rectangle','door','stairs'].includes(el.type)) {
          const mx = Math.min(el.start.x,el.end.x), my = Math.min(el.start.y,el.end.y);
          const mw = Math.abs(el.end.x-el.start.x), mh = Math.abs(el.end.y-el.start.y);
          return pos.x >= mx - tol && pos.x <= mx+mw+tol && pos.y >= my-tol && pos.y <= my+mh+tol;
        }
        // Line-based
        const dx = el.end.x - el.start.x, dy = el.end.y - el.start.y;
        const len2 = dx*dx + dy*dy;
        if (len2 === 0) return Math.hypot(pos.x-el.start.x, pos.y-el.start.y) <= tol;
        const t = Math.max(0, Math.min(1, ((pos.x-el.start.x)*dx + (pos.y-el.start.y)*dy)/len2));
        return Math.hypot(pos.x-(el.start.x+t*dx), pos.y-(el.start.y+t*dy)) <= tol;
      }
      return false;
    });
  };

  const getLayer = (toolId) => {
    if (['wall','room','door','window','stairs'].includes(toolId)) return 'walls';
    if (Object.keys(PRESETS).some(k => PRESETS[k].layer === 'fixtures' && k === toolId)) return 'fixtures';
    if (Object.keys(PRESETS).some(k => PRESETS[k].layer === 'furniture' && k === toolId)) return 'furniture';
    if (['text','dimension'].includes(toolId)) return 'annotations';
    return curLayer;
  };

  const handleMouseDown = (e) => {
    if (e.button === 1 || tool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }
    const pos = getPos(e);

    if (tool === 'select') {
      const hit = hitTest(pos);
      if (hit) {
        setSelId(hit.id);
        if (hit.x !== undefined) setDragOffset({ x: pos.x - hit.x, y: pos.y - hit.y });
        else if (hit.start) setDragOffset({ x: pos.x - hit.start.x, y: pos.y - hit.start.y });
      } else {
        setSelId(null);
      }
      setIsDrawing(true);
      setStartPos(pos);
      return;
    }

    if (tool === 'eraser') {
      const hit = hitTest(pos);
      if (hit) setEls(page.elements.filter(e => e.id !== hit.id));
      return;
    }

    if (tool === 'text') {
      const text = prompt('Enter label:');
      if (text) {
        setEls([...page.elements, {
          id: Date.now(), type: 'text', text, x: pos.x, y: pos.y,
          color, fontSize: 16, layer: 'annotations'
        }]);
      }
      return;
    }

    // Preset placement
    if (PRESETS[tool]) {
      const preset = PRESETS[tool];
      const newEl = {
        id: Date.now(), type: 'preset', subtype: tool,
        x: pos.x - preset.w/2, y: pos.y - preset.h/2,
        w: preset.w, h: preset.h, fill: preset.fill, stroke: preset.stroke,
        sym: preset.sym, label: preset.label, layer: preset.layer,
      };
      setEls([...page.elements, newEl]);
      setSelId(newEl.id);
      return;
    }

    setIsDrawing(true);
    setStartPos(pos);
    if (tool === 'pen') setPathPoints([pos]);
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }
    if (!isDrawing || !startPos) return;
    const pos = getPos(e);

    if (tool === 'select' && selEl) {
      if (!dragOffset) return;
      const updated = page.elements.map(el => {
        if (el.id !== selId) return el;
        if (el.x !== undefined) return { ...el, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y };
        if (el.type === 'text') return { ...el, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y };
        if (el.start) {
          const dx = pos.x - dragOffset.x - el.start.x;
          const dy = pos.y - dragOffset.y - el.start.y;
          return { ...el, start: { x: el.start.x+dx, y: el.start.y+dy }, end: { x: el.end.x+dx, y: el.end.y+dy } };
        }
        return el;
      });
      setEls(updated, false);
      return;
    }

    if (tool === 'pen') {
      setPathPoints(prev => [...prev, pos]);
      setTempEl({ id: 'temp', type: 'path', points: [...pathPoints, pos], color, strokeWidth: strokeW, layer: curLayer });
      return;
    }

    // Ortho lock for walls, doors, windows, lines
    let end = pos;
    if (['wall','door','window','line','dimension'].includes(tool)) {
      const dx = Math.abs(pos.x - startPos.x), dy = Math.abs(pos.y - startPos.y);
      if (dx < 15 / zoom) end = { ...pos, x: startPos.x };
      else if (dy < 15 / zoom) end = { ...pos, y: startPos.y };
    }

    const base = {
      start: startPos, end,
      color, strokeWidth: strokeW,
      layer: getLayer(tool),
    };

    if (tool === 'wall')      setTempEl({ ...base, type:'wall', thickness: DEF_WALL_T });
    else if (tool === 'room') setTempEl({ ...base, type:'room', fillColor, label:'Room' });
    else if (tool === 'door') setTempEl({ ...base, type:'door' });
    else if (tool === 'window') setTempEl({ ...base, type:'window' });
    else if (tool === 'stairs') setTempEl({ ...base, type:'stairs', steps:8 });
    else if (tool === 'line') setTempEl({ ...base, type:'line' });
    else if (tool === 'rectangle') setTempEl({ ...base, type:'rectangle' });
    else if (tool === 'circle') setTempEl({ ...base, type:'circle' });
    else if (tool === 'dimension') setTempEl({ ...base, type:'dimension' });
  };

  const handleMouseUp = (e) => {
    if (isPanning) { setIsPanning(false); return; }
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === 'select') {
      if (selEl) setEls(page.elements, true); // commit drag to history
      setDragOffset(null);
      setStartPos(null);
      return;
    }

    if (tool === 'pen' && pathPoints.length > 1) {
      setEls([...page.elements, {
        id: Date.now(), type:'path', points: pathPoints,
        color, strokeWidth: strokeW, layer: curLayer
      }]);
    } else if (tempEl) {
      const dist = tempEl.start ? Math.hypot(tempEl.end.x-tempEl.start.x, tempEl.end.y-tempEl.start.y) : 0;
      if (dist > 5 / zoom) {
        const newEl = { ...tempEl, id: Date.now() };
        if (newEl.type === 'room') newEl.fillColor = fillColor;
        setEls([...page.elements, newEl]);
        setSelId(newEl.id);
      }
    }

    setTempEl(null);
    setPathPoints([]);
    setStartPos(null);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, zoom * delta));
    setPan({ x: mx - (mx - pan.x) * (newZoom / zoom), y: my - (my - pan.y) * (newZoom / zoom) });
    setZoom(newZoom);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selId) { setEls(page.elements.filter(el => el.id !== selId)); setSelId(null); } }
      if (e.key === 'Escape') setSelId(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selId, page.elements, setEls, setSelId]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.save();

    // Background
    ctx.fillStyle = isDark ? '#1e293b' : '#f8fafc';
    ctx.fillRect(0, 0, W, H);

    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Grid
    if (showGrid) {
      const ww = W / zoom, wh = H / zoom;
      const offX = -pan.x / zoom, offY = -pan.y / zoom;
      ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      for (let x = Math.floor(offX / gridSize) * gridSize; x < offX + ww; x += gridSize) {
        ctx.moveTo(x, offY); ctx.lineTo(x, offY + wh);
      }
      for (let y = Math.floor(offY / gridSize) * gridSize; y < offY + wh; y += gridSize) {
        ctx.moveTo(offX, y); ctx.lineTo(offX + ww, y);
      }
      ctx.stroke();
      // Major grid (5x)
      ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      const mg = gridSize * 5;
      for (let x = Math.floor(offX / mg) * mg; x < offX + ww; x += mg) {
        ctx.moveTo(x, offY); ctx.lineTo(x, offY + wh);
      }
      for (let y = Math.floor(offY / mg) * mg; y < offY + wh; y += mg) {
        ctx.moveTo(offX, y); ctx.lineTo(offX + ww, y);
      }
      ctx.stroke();
    }

    // Draw elements
    const visEls = page.elements.filter(e => visLayers.has(e.layer || 'walls'));
    // Rooms first (as background), then structural, then fixtures/furniture, then annotations
    const order = ['rooms','walls','fixtures','furniture','annotations'];
    order.forEach(layerId => {
      visEls.filter(e => (e.layer || 'walls') === layerId).forEach(el => {
        drawEl(ctx, el, el.id === selId, zoom, isDark);
      });
    });

    // Temp element
    if (tempEl) drawEl(ctx, tempEl, false, zoom, isDark);

    ctx.restore();
  }, [page, tempEl, selId, showGrid, gridSize, zoom, pan, visLayers, isDark]);

  const getCursor = () => {
    if (tool === 'pan' || isPanning) return isDark ? 'grabbing':'grab';
    if (tool === 'select') return 'default';
    if (tool === 'text') return 'text';
    if (tool === 'eraser') return 'cell';
    if (PRESETS[tool]) return 'copy';
    return 'crosshair';
  };

  return (
    <div ref={wrapRef} style={{ width:'100%', height:'100%', position:'relative', overflow:'hidden' }}>
      <canvas
        id="fp-canvas"
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ display:'block', cursor: getCursor() }}
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════
const TOOL_GROUPS = [
  {
    id: 'select', label: 'Select & Navigate',
    tools: [
      { id:'select',  label:'Select',  icon: <MousePointer size={16}/>,  tip:'Select & Move (V)' },
      { id:'pan',     label:'Pan',     icon: <Move size={16}/>,          tip:'Pan Canvas (H)' },
      { id:'eraser',  label:'Eraser',  icon: <Eraser size={16}/>,        tip:'Erase Element' },
    ]
  },
  {
    id: 'structural', label: 'Structure',
    tools: [
      { id:'wall',    label:'Wall',    icon: <Edit3 size={16}/>,         tip:'Draw Wall (W)' },
      { id:'room',    label:'Room',    icon: <Square size={16}/>,        tip:'Draw Room (R)' },
      { id:'door',    label:'Door',    icon: <DoorOpen size={16}/>,      tip:'Place Door (D)' },
      { id:'window',  label:'Window',  icon: <Maximize size={16}/>,      tip:'Place Window (N)' },
      { id:'stairs',  label:'Stairs',  icon: <Layers size={16}/>,        tip:'Draw Stairs' },
    ]
  },
  {
    id: 'draw', label: 'Draw',
    tools: [
      { id:'pen',       label:'Pen',       icon: <Pen size={16}/>,        tip:'Freehand (P)' },
      { id:'line',      label:'Line',      icon: <Minus size={16}/>,      tip:'Line (L)' },
      { id:'rectangle', label:'Rectangle', icon: <Square size={16}/>,     tip:'Rectangle' },
      { id:'circle',    label:'Circle',    icon: <Circle size={16}/>,     tip:'Circle' },
      { id:'dimension', label:'Dimension', icon: <Ruler size={16}/>,      tip:'Dimension Line' },
      { id:'text',      label:'Text',      icon: <Type size={16}/>,       tip:'Text Label (T)' },
    ]
  },
  {
    id: 'fixtures', label: 'Fixtures',
    tools: [
      { id:'toilet',  label:'Toilet',  icon:'🚽', tip:'Place Toilet' },
      { id:'sink',    label:'Sink',    icon:'🚰', tip:'Place Sink' },
      { id:'bathtub', label:'Bathtub', icon:'🛁', tip:'Place Bathtub' },
      { id:'shower',  label:'Shower',  icon:'🚿', tip:'Place Shower' },
      { id:'counter', label:'Counter', icon:'📦', tip:'Kitchen Counter' },
      { id:'island',  label:'Island',  icon:'📦', tip:'Kitchen Island' },
      { id:'stove',   label:'Stove',   icon:'🍳', tip:'Place Stove' },
      { id:'fridge',  label:'Fridge',  icon:'❄️', tip:'Place Fridge' },
    ]
  },
  {
    id: 'furniture', label: 'Furniture',
    tools: [
      { id:'sofa',     label:'Sofa',         icon:'🛋️', tip:'Place Sofa' },
      { id:'loveseat', label:'Loveseat',     icon:'🛋️', tip:'Place Loveseat' },
      { id:'armchair', label:'Armchair',     icon:'🪑', tip:'Place Armchair' },
      { id:'bed_q',    label:'Queen Bed',    icon:'🛏️', tip:'Queen Bed' },
      { id:'bed_t',    label:'Twin Bed',     icon:'🛏️', tip:'Twin Bed' },
      { id:'desk',     label:'Desk',         icon:'🖥️', tip:'Place Desk' },
      { id:'table_d',  label:'Dining Table', icon:'🍽️', tip:'Dining Table' },
      { id:'table_c',  label:'Coffee Table', icon:'☕', tip:'Coffee Table' },
      { id:'dresser',  label:'Dresser',      icon:'🗄️', tip:'Dresser' },
      { id:'wardrobe', label:'Wardrobe',     icon:'👔', tip:'Wardrobe' },
    ]
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
          width: '100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'6px 10px', background:'rgba(255,255,255,0.06)', border:'none',
          color:'rgba(255,255,255,0.7)', cursor:'pointer', borderRadius:6,
          fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px',
          fontFamily:'var(--font-family)', marginBottom: expanded ? 4 : 0,
        }}
      >
        {group.label}
        {expanded ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
      </button>
      {expanded && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
          {group.tools.map(t => {
            const active = tool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                title={t.tip}
                style={{
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  gap:3, padding:'8px 4px',
                  background: active
                    ? 'linear-gradient(135deg, var(--secondary) 0%, var(--secondary-dark) 100%)'
                    : 'rgba(255,255,255,0.06)',
                  border: active ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  color: active ? '#fff' : 'rgba(255,255,255,0.75)',
                  cursor:'pointer', borderRadius:8,
                  transition:'all 0.2s',
                  boxShadow: active ? '0 2px 8px rgba(52,152,219,0.4)' : 'none',
                  fontFamily:'var(--font-family)',
                  transform: active ? 'scale(1.03)' : 'scale(1)',
                }}
              >
                <span style={{ fontSize: typeof t.icon === 'string' ? 14 : 'inherit', lineHeight:1 }}>
                  {t.icon}
                </span>
                <span style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>
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
  const { color, setColor, fillColor, setFillColor, strokeW, setStrokeW, selEl, dupSel, delSel, rotateSel } = useC();
  const [expanded, setExpanded] = useState({ select:true, structural:true, draw:false, fixtures:false, furniture:false });
  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  return (
    <div style={{
      width:130, minWidth:130, background:'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
      display:'flex', flexDirection:'column', gap:2, padding:'12px 8px',
      overflowY:'auto', borderRight:'1px solid rgba(255,255,255,0.06)',
    }}>
      {TOOL_GROUPS.map(g => (
        <ToolSection key={g.id} group={g} expanded={expanded[g.id]} toggle={toggle}/>
      ))}

      <div style={{ borderTop:'1px solid rgba(255,255,255,0.1)', margin:'8px 0 4px', paddingTop:8 }}>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:6 }}>Stroke</div>
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          style={{ width:'100%', height:30, border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, cursor:'pointer', padding:2, background:'transparent' }}/>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:4, marginTop:8 }}>Fill (rooms)</div>
        <input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)}
          style={{ width:'100%', height:30, border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, cursor:'pointer', padding:2, background:'transparent' }}/>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:4, marginTop:8 }}>
          Width: {strokeW}px
        </div>
        <input type="range" min="1" max="16" value={strokeW} onChange={e => setStrokeW(+e.target.value)}
          style={{ width:'100%' }}/>
      </div>

      {selEl && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.1)', marginTop:4, paddingTop:8, display:'flex', flexDirection:'column', gap:4 }}>
          <button onClick={rotateSel} title="Rotate 90°" style={toolActionBtn('#10b981')}>
            <RotateCw size={13}/> Rotate
          </button>
          <button onClick={dupSel} title="Duplicate" style={toolActionBtn('#3b82f6')}>
            <Copy size={13}/> Duplicate
          </button>
          <button onClick={delSel} title="Delete" style={toolActionBtn('#ef4444')}>
            <Trash2 size={13}/> Delete
          </button>
        </div>
      )}
    </div>
  );
};

const toolActionBtn = (clr) => ({
  display:'flex', alignItems:'center', gap:5,
  padding:'7px 10px', border:'none', borderRadius:6, cursor:'pointer',
  background:`rgba(${clr==='#10b981'?'16,185,129':clr==='#3b82f6'?'59,130,246':'239,68,68'},0.15)`,
  color: clr, fontSize:11, fontWeight:600, fontFamily:'var(--font-family)',
  transition:'all 0.2s',
});

// ═══════════════════════════════════════════════════════════
// TOP TOOLBAR
// ═══════════════════════════════════════════════════════════
const TopToolbar = () => {
  const { zoom, setZoom, setPan, showGrid, setShowGrid, snap, setSnap, gridSize, setGridSize, undo, redo, hIdx, hist, clearAll } = useC();
  const isDark = document.documentElement.classList.contains('dark');
  const tbStyle = {
    background: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.97)',
    padding:'8px 14px', borderRadius:12, display:'flex', gap:8, alignItems:'center',
    boxShadow:'0 4px 20px rgba(0,0,0,0.15)', backdropFilter:'blur(10px)',
    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
  };
  const btn = (active) => ({
    display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34,
    border:'none', borderRadius:8, cursor:'pointer',
    background: active ? 'var(--secondary)' : (isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)'),
    color: active ? '#fff' : (isDark?'rgba(255,255,255,0.8)':'#374151'),
    transition:'all 0.2s', fontFamily:'var(--font-family)',
  });
  const sep = { width:1, height:24, background: isDark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.1)' };

  return (
    <div style={{ position:'absolute', top:14, left:'50%', transform:'translateX(-50%)', zIndex:20, display:'flex', gap:10 }}>
      <div style={tbStyle}>
        <button onClick={() => { setZoom(1); setPan({x:0,y:0}); }} style={btn(false)} title="Reset View">
          <Maximize2 size={15}/>
        </button>
        <button onClick={() => setZoom(z => Math.max(0.1, z/1.25))} style={btn(false)} title="Zoom Out"><ZoomOut size={15}/></button>
        <span style={{ fontSize:13, minWidth:48, textAlign:'center', fontWeight:700, color: isDark?'#e2e8f4':'#1f2937', fontFamily:'var(--font-family)' }}>
          {Math.round(zoom*100)}%
        </span>
        <button onClick={() => setZoom(z => Math.min(5, z*1.25))} style={btn(false)} title="Zoom In"><ZoomIn size={15}/></button>
        <div style={sep}/>
        <button onClick={() => setShowGrid(!showGrid)} style={btn(showGrid)} title="Grid"><Grid3x3 size={15}/></button>
        <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer', fontSize:12, fontWeight:600, color: isDark?'rgba(255,255,255,0.7)':'#374151', fontFamily:'var(--font-family)' }}>
          <input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} style={{ accentColor:'var(--secondary)' }}/>
          Snap
        </label>
        <select value={gridSize} onChange={e => setGridSize(+e.target.value)} style={{ padding:'4px 6px', borderRadius:6, border: isDark?'1px solid rgba(255,255,255,0.15)':'1px solid #d1d5db', fontSize:12, cursor:'pointer', fontFamily:'var(--font-family)', background: isDark?'#1e293b':'#fff', color: isDark?'#e2e8f4':'#374151' }}>
          <option value="10">10px (6")</option>
          <option value="20">20px (1')</option>
          <option value="40">40px (2')</option>
          <option value="100">100px (5')</option>
        </select>
        <div style={sep}/>
        <button onClick={undo} disabled={hIdx<=0} style={{ ...btn(false), opacity: hIdx<=0?0.35:1 }} title="Undo (Ctrl+Z)"><Undo size={15}/></button>
        <button onClick={redo} disabled={hIdx>=hist.length-1} style={{ ...btn(false), opacity: hIdx>=hist.length-1?0.35:1 }} title="Redo"><Redo size={15}/></button>
        <div style={sep}/>
        <button onClick={clearAll} style={{ ...btn(false), color:'#ef4444' }} title="Clear Canvas"><Trash2 size={15}/></button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════
const Sidebar = () => {
  const {
    selEl, updateSelEl, pages, pid, setPid, addPage, delPage,
    layers, curLayer, setCurLayer, toggleLayer, sideTab, setSideTab,
  } = useC();
  // Extract needed values for use in conditional renders
  const ctxLayers = layers;
  const ctxPages = pages;
  const sb = {
    width:260, minWidth:260, background:'var(--surface)', borderLeft:'1px solid var(--border)',
    display:'flex', flexDirection:'column', overflowY:'hidden',
  };
  const tabStyle = (active) => ({
    flex:1, padding:'10px 4px', border:'none', cursor:'pointer', fontFamily:'var(--font-family)',
    fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.7px',
    background: active ? 'var(--secondary)' : 'transparent',
    color: active ? '#fff' : 'var(--text-light)',
    borderBottom: active ? 'none' : '2px solid var(--border)',
    transition:'all 0.2s',
  });
  const lbl = { fontSize:11, fontWeight:700, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:4, fontFamily:'var(--font-family)' };
  const inp = {
    width:'100%', padding:'7px 10px', borderRadius:6,
    border:'1px solid var(--border)', fontSize:13, color:'var(--text)',
    background:'var(--surface-raised, #f7f9fc)', fontFamily:'var(--font-family)',
  };

  return (
    <div style={sb}>
      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {[['props','Properties'],['layers','Layers'],['pages','Pages']].map(([id,label]) => (
          <button key={id} onClick={() => setSideTab(id)} style={tabStyle(sideTab===id)}>{label}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:14 }}>

        {/* PROPERTIES */}
        {sideTab === 'props' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {selEl ? (
              <>
                <div style={{ padding:12, background:'linear-gradient(135deg,var(--secondary),var(--secondary-dark))', borderRadius:10, color:'#fff', fontFamily:'var(--font-family)' }}>
                  <div style={{ fontSize:11, opacity:0.8, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.7px' }}>Selected</div>
                  <div style={{ fontSize:16, fontWeight:700 }}>
                    {selEl.type === 'preset' ? (PRESETS[selEl.subtype]?.label || selEl.type) : selEl.type.charAt(0).toUpperCase()+selEl.type.slice(1)}
                  </div>
                </div>
                {/* Color */}
                {selEl.color !== undefined && (
                  <div>
                    <label style={lbl}>Color</label>
                    <input type="color" value={selEl.color || '#2c3e50'} onChange={e => updateSelEl('color', e.target.value)}
                      style={{ width:'100%', height:36, borderRadius:8, border:'1px solid var(--border)', cursor:'pointer', padding:2 }}/>
                  </div>
                )}
                {/* Fill */}
                {selEl.fillColor !== undefined && (
                  <div>
                    <label style={lbl}>Fill Color</label>
                    <input type="color" value={selEl.fillColor || '#dbeafe'} onChange={e => updateSelEl('fillColor', e.target.value)}
                      style={{ width:'100%', height:36, borderRadius:8, border:'1px solid var(--border)', cursor:'pointer', padding:2 }}/>
                  </div>
                )}
                {/* Room label */}
                {selEl.type === 'room' && (
                  <div>
                    <label style={lbl}>Room Label</label>
                    <input style={inp} value={selEl.label || ''} onChange={e => updateSelEl('label', e.target.value)} placeholder="e.g. Living Room"/>
                  </div>
                )}
                {/* Stroke width */}
                {selEl.strokeWidth !== undefined && (
                  <div>
                    <label style={lbl}>Stroke Width: {selEl.strokeWidth}px</label>
                    <input type="range" min="1" max="20" value={selEl.strokeWidth} onChange={e => updateSelEl('strokeWidth', +e.target.value)} style={{ width:'100%', accentColor:'var(--secondary)' }}/>
                  </div>
                )}
                {/* Wall thickness */}
                {selEl.type === 'wall' && (
                  <div>
                    <label style={lbl}>Wall Thickness: {selEl.thickness || DEF_WALL_T}px</label>
                    <input type="range" min="6" max="40" value={selEl.thickness || DEF_WALL_T} onChange={e => updateSelEl('thickness', +e.target.value)} style={{ width:'100%', accentColor:'var(--secondary)' }}/>
                    <div style={{ fontSize:11, color:'var(--text-light)', marginTop:4, fontFamily:'var(--font-family)' }}>
                      ≈ {toFt(selEl.thickness || DEF_WALL_T)} thick
                    </div>
                  </div>
                )}
                {/* Stairs steps */}
                {selEl.type === 'stairs' && (
                  <div>
                    <label style={lbl}>Steps: {selEl.steps || 8}</label>
                    <input type="range" min="3" max="20" value={selEl.steps || 8} onChange={e => updateSelEl('steps', +e.target.value)} style={{ width:'100%', accentColor:'var(--secondary)' }}/>
                  </div>
                )}
                {/* Text properties */}
                {selEl.type === 'text' && (
                  <>
                    <div>
                      <label style={lbl}>Text Content</label>
                      <input style={inp} value={selEl.text || ''} onChange={e => updateSelEl('text', e.target.value)}/>
                    </div>
                    <div>
                      <label style={lbl}>Font Size: {selEl.fontSize || 16}px</label>
                      <input type="range" min="8" max="72" value={selEl.fontSize || 16} onChange={e => updateSelEl('fontSize', +e.target.value)} style={{ width:'100%', accentColor:'var(--secondary)' }}/>
                    </div>
                  </>
                )}
                {/* Dimensions readout */}
                {selEl.start && selEl.end && (
                  <div style={{ padding:10, background:'var(--background)', borderRadius:8, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-light)', marginBottom:6, fontFamily:'var(--font-family)' }}>Dimensions</div>
                    {['wall','line','door','window'].includes(selEl.type) && (
                      <div style={{ fontSize:13, color:'var(--text)', fontFamily:'var(--font-family)' }}>
                        Length: <b>{toFt(Math.hypot(selEl.end.x-selEl.start.x, selEl.end.y-selEl.start.y))}</b>
                      </div>
                    )}
                    {['room','rectangle','stairs'].includes(selEl.type) && (
                      <>
                        <div style={{ fontSize:13, color:'var(--text)', fontFamily:'var(--font-family)' }}>W: <b>{toFt(Math.abs(selEl.end.x-selEl.start.x))}</b></div>
                        <div style={{ fontSize:13, color:'var(--text)', fontFamily:'var(--font-family)' }}>H: <b>{toFt(Math.abs(selEl.end.y-selEl.start.y))}</b></div>
                        <div style={{ fontSize:13, color:'var(--text)', fontFamily:'var(--font-family)' }}>
                          Area: <b>{((Math.abs(selEl.end.x-selEl.start.x)/PPF) * (Math.abs(selEl.end.y-selEl.start.y)/PPF)).toFixed(1)} sq ft</b>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {selEl.w !== undefined && (
                  <div style={{ padding:10, background:'var(--background)', borderRadius:8, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-light)', marginBottom:6, fontFamily:'var(--font-family)' }}>Dimensions</div>
                    <div style={{ fontSize:13, color:'var(--text)', fontFamily:'var(--font-family)' }}>W: <b>{toFt(selEl.w)}</b></div>
                    <div style={{ fontSize:13, color:'var(--text)', fontFamily:'var(--font-family)' }}>H: <b>{toFt(selEl.h)}</b></div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding:16, background:'linear-gradient(135deg,var(--secondary),var(--secondary-dark))', borderRadius:12, color:'#fff', fontFamily:'var(--font-family)' }}>
                <div style={{ fontSize:24, marginBottom:8 }}>✏️</div>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>Floor Plan Designer</div>
                <div style={{ fontSize:12, opacity:0.85, lineHeight:1.6 }}>
                  Select a tool from the left panel to start drawing. Click any element to edit its properties here.
                </div>
              </div>
            )}
            {/* Quick tip */}
            <div style={{ padding:10, background:'var(--background)', borderRadius:8, border:'1px solid var(--border)', fontFamily:'var(--font-family)' }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-light)', marginBottom:6 }}>Shortcuts</div>
              {[['Del / Backspace','Delete selected'],['Escape','Deselect'],['Scroll','Zoom in/out'],['Middle-drag','Pan canvas'],].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text)', marginBottom:3 }}>
                  <span style={{ background:'var(--surface-raised,#f0f4f8)', padding:'1px 5px', borderRadius:4, fontWeight:600 }}>{k}</span>
                  <span style={{ color:'var(--text-light)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LAYERS */}
        {sideTab === 'layers' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {ctxLayers.map(layer => {
              const isActive = curLayer === layer.id;
              return (
                <div key={layer.id} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                  background: isActive ? 'var(--info-bg, rgba(52,152,219,0.08))' : 'var(--background)',
                  border: isActive ? '1px solid var(--secondary)' : '1px solid var(--border)',
                  borderRadius:10, cursor:'pointer', transition:'all 0.2s',
                }}
                onClick={() => setCurLayer(layer.id)}>
                  <button onClick={e => { e.stopPropagation(); toggleLayer(layer.id); }}
                    style={{ background:'none', border:'none', cursor:'pointer', color: layer.visible ? 'var(--secondary)':'var(--text-muted)', padding:0 }}>
                    {layer.visible ? <Eye size={16}/> : <EyeOff size={16}/>}
                  </button>
                  <span style={{ flex:1, fontSize:13, fontWeight: isActive?700:500, color:'var(--text)', fontFamily:'var(--font-family)' }}>{layer.name}</span>
                  {isActive && <span style={{ fontSize:10, color:'var(--secondary)', fontWeight:700, fontFamily:'var(--font-family)' }}>Active</span>}
                </div>
              );
            })}
            <p style={{ fontSize:11, color:'var(--text-light)', fontFamily:'var(--font-family)', lineHeight:1.6, marginTop:4 }}>
              Click a layer to make it active. Eye icon toggles visibility.
            </p>
          </div>
        )}

        {/* PAGES */}
        {sideTab === 'pages' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button onClick={addPage} style={{
              display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
              background:'linear-gradient(135deg,var(--secondary),var(--secondary-dark))', border:'none',
              color:'#fff', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700,
              fontFamily:'var(--font-family)', marginBottom:4,
            }}>
              <Plus size={16}/> Add Floor
            </button>
            {ctxPages.map(pg => (
              <div key={pg.id} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'10px 12px',
                background: pid===pg.id ? 'var(--info-bg, rgba(52,152,219,0.08))' : 'var(--background)',
                border: pid===pg.id ? '1px solid var(--secondary)' : '1px solid var(--border)',
                borderRadius:10, cursor:'pointer', transition:'all 0.2s',
              }}
              onClick={() => setPid(pg.id)}>
                <span style={{ fontSize:13, fontWeight: pid===pg.id?700:500, color:'var(--text)', fontFamily:'var(--font-family)' }}>{pg.name}</span>
                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'var(--text-light)', fontFamily:'var(--font-family)' }}>{pg.elements.length} el</span>
                  {ctxPages.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); delPage(pg.id); }}
                      style={{ background:'none', border:'none', color:'var(--error)', cursor:'pointer', padding:'0 2px', fontSize:16, lineHeight:1 }}>×</button>
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
  const { view, setView, exportPng, saveJson, loadJson } = useC();
  return (
    <div style={{
      background:'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
      color:'#fff', padding:'12px 20px', display:'flex', alignItems:'center',
      justifyContent:'space-between', flexShrink:0, zIndex:50,
      boxShadow:'0 2px 12px rgba(0,0,0,0.2)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:22 }}>📐</span>
        <div>
          <div style={{ fontSize:17, fontWeight:800, letterSpacing:'0.3px', fontFamily:'var(--font-family)' }}>Floor Plan Designer</div>
          <div style={{ fontSize:10, opacity:0.7, fontWeight:500, fontFamily:'var(--font-family)', letterSpacing:'0.5px' }}>REMODELING STUDIO</div>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display:'flex', gap:0, background:'rgba(255,255,255,0.12)', borderRadius:10, padding:3 }}>
        {[['2d','✏️ 2D Plan'],['3d','🏠 3D View']].map(([id,label]) => (
          <button key={id} onClick={() => setView(id)} style={{
            padding:'7px 18px', border:'none', borderRadius:8, cursor:'pointer',
            background: view===id ? '#fff' : 'transparent',
            color: view===id ? 'var(--primary)' : 'rgba(255,255,255,0.8)',
            fontWeight: view===id ? 700 : 500, fontSize:13, transition:'all 0.25s',
            fontFamily:'var(--font-family)',
            boxShadow: view===id ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <button onClick={exportPng} style={hBtn}>
          <Camera size={15}/> Export PNG
        </button>
        <button onClick={saveJson} style={hBtn}>
          <Save size={15}/> Save
        </button>
        <label style={{ cursor:'pointer' }}>
          <input type="file" accept=".json" onChange={loadJson} style={{ display:'none' }}/>
          <div style={hBtn}><Download size={15}/> Load</div>
        </label>
      </div>
    </div>
  );
};

const hBtn = {
  display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
  background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)',
  color:'#fff', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600,
  transition:'all 0.2s', fontFamily:'var(--font-family)',
};

// ═══════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════
const AppInner = () => {
  const { view } = useC();
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', width:'100%', fontFamily:'var(--font-family)', background:'var(--background)', overflow:'hidden' }}>
      <Header/>
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {view === '2d' && <Toolbox/>}
        <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
          {view === '2d' && (
            <>
              <TopToolbar/>
              <Canvas2D/>
            </>
          )}
          {view === '3d' && <Canvas3D/>}
        </div>
        <Sidebar/>
      </div>
    </div>
  );
};

const FloorPlanDesigner = () => (
  <Provider>
    <AppInner/>
  </Provider>
);

export default FloorPlanDesigner;
