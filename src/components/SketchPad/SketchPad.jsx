import React, { useRef, useEffect, useState } from 'react';
import {
  Camera, Grid3x3, Save, Download, Plus, Move, Square, Circle, Type,
  Minus, ZoomIn, ZoomOut, Maximize2, Edit3, Eraser, Pen, Ruler, Undo, Redo, 
  Trash2, Copy, Box, DoorOpen, Maximize, Layout, Triangle
} from 'lucide-react';
import { generate3DFromSketch } from './export3D';
import { useSketch, SketchProvider } from '../../context/SketchContext';

// =====================================================================
// COMPONENTS
// =====================================================================

// =====================================================================
// COMPONENTS
// =====================================================================
const ToolButton = ({ icon, active, onClick, title }) => (
  <button 
    onClick={onClick} 
    style={{ 
      background: active ? 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)' : 'transparent',
      border: 'none',
      color: 'white',
      cursor: 'pointer',
      padding: '10px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.3s ease',
      boxShadow: active ? '0 4px 12px rgba(52, 152, 219, 0.4)' : 'none',
      transform: active ? 'scale(1.05)' : 'scale(1)'
    }} 
    title={title}
    onMouseEnter={(e) => {
      if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
    }}
    onMouseLeave={(e) => {
      if (!active) e.currentTarget.style.background = 'transparent';
    }}
  >
    {icon}
  </button>
);

const Header = () => {
  const { pages, setPages, currentPage } = useSketch();

  const handleExport3D = async () => {
    if (!currentPage || !currentPage.elements || currentPage.elements.length === 0) {
      alert("Please draw something first!");
      return;
    }
    
    try {
      const gltf = await generate3DFromSketch(currentPage.elements);
      const blob = new Blob([gltf], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-3d-${Date.now()}.glb`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export 3D model. See console for details.");
    }
  };

  const saveProject = () => {
    const data = { pages, timestamp: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `floor-plan-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportImage = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `floor-plan-image-${Date.now()}.png`;
      a.click();
    }
  };

  const loadProject = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.pages) setPages(data.pages);
      } catch { alert('Invalid file'); }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)', 
      color: 'white', 
      padding: '16px 24px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)' 
    }}>
      <h1 style={{ 
        margin: 0, 
        fontSize: '24px', 
        fontWeight: '800',
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        letterSpacing: '0.5px'
      }}>
        <Camera size={28} />
        Floor Plan Designer Pro
      </h1>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button 
          onClick={handleExport3D} 
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: '10px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          title="Export 3D Model"
        >
          <Box size={18} />
          Export 3D
        </button>
        <button 
          onClick={exportImage} 
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: '10px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          title="Export Image"
        >
          <Camera size={18} />
          Export PNG
        </button>
        <button 
          onClick={saveProject} 
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: '10px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          title="Save Project"
        >
          <Save size={18} />
          Save
        </button>
        <label style={{ cursor: 'pointer' }}>
          <input type="file" accept=".json" onChange={loadProject} style={{ display: 'none' }} />
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: '10px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          >
            <Download size={18} />
            Load
          </div>
        </label>
      </div>
    </div>
  );
};

const Toolbox = () => {
  const { tool, setTool, color, setColor, strokeWidth, setStrokeWidth, eraserSize, setEraserSize, 
          fontSize, setFontSize, recentColors, setRecentColors, selectedElement, deleteSelected, duplicateSelected } = useSketch();

  const addRecentColor = (c) => {
    if (!recentColors.includes(c)) setRecentColors([c, ...recentColors.slice(0, 7)]);
  };

  return (
    <div style={{ 
      width: '100px', 
      background: 'linear-gradient(180deg, #34495e 0%, #2c3e50 100%)', 
      padding: '12px', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '12px', 
      overflowY: 'auto',
      boxShadow: '2px 0 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Tools
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <ToolButton icon={<Move size={20} />} active={tool === 'select'} onClick={() => setTool('select')} title="Select (V)" />
        <ToolButton icon={<Pen size={20} />} active={tool === 'pen'} onClick={() => setTool('pen')} title="Pen (P)" />
        <ToolButton icon={<Eraser size={20} />} active={tool === 'eraser'} onClick={() => setTool('eraser')} title="Eraser (E)" />
        <ToolButton icon={<Minus size={20} />} active={tool === 'line'} onClick={() => setTool('line')} title="Line (L)" />
        <ToolButton icon={<Square size={20} />} active={tool === 'rectangle'} onClick={() => setTool('rectangle')} title="Rectangle (R)" />
        <ToolButton icon={<Triangle size={20} />} active={tool === 'triangle'} onClick={() => setTool('triangle')} title="Triangle" />
        <ToolButton icon={<Circle size={20} />} active={tool === 'circle'} onClick={() => setTool('circle')} title="Circle (C)" />
        <ToolButton icon={<Layout size={20} />} active={tool === 'room'} onClick={() => setTool('room')} title="Room" />
        <ToolButton icon={<Type size={20} />} active={tool === 'text'} onClick={() => setTool('text')} title="Text (T)" />
        <ToolButton icon={<Ruler size={20} />} active={tool === 'measure'} onClick={() => setTool('measure')} title="Measure (M)" />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }} />

      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Build
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <ToolButton icon={<Edit3 size={20} />} active={tool === 'wall'} onClick={() => setTool('wall')} title="Wall (W)" />
        <ToolButton icon={<DoorOpen size={20} />} active={tool === 'door'} onClick={() => setTool('door')} title="Door (D)" />
        <ToolButton icon={<Maximize size={20} />} active={tool === 'window'} onClick={() => setTool('window')} title="Window (O)" />
      </div>
      
      <div style={{ borderTop: '2px solid rgba(255,255,255,0.1)', margin: '12px 0' }} />
      
      {selectedElement && (
        <>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Selected
          </div>
          <button
            onClick={duplicateSelected}
            style={{
              background: 'rgba(46, 204, 113, 0.2)',
              border: '1px solid rgba(46, 204, 113, 0.4)',
              color: '#2ecc71',
              cursor: 'pointer',
              padding: '10px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(46, 204, 113, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(46, 204, 113, 0.2)'}
          >
            <Copy size={16} />
          </button>
          <button
            onClick={deleteSelected}
            style={{
              background: 'rgba(231, 76, 60, 0.2)',
              border: '1px solid rgba(231, 76, 60, 0.4)',
              color: '#e74c3c',
              cursor: 'pointer',
              padding: '10px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(231, 76, 60, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(231, 76, 60, 0.2)'}
          >
            <Trash2 size={16} />
          </button>
          <div style={{ borderTop: '2px solid rgba(255,255,255,0.1)', margin: '12px 0' }} />
        </>
      )}
      
      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Color
      </div>
      <input 
        type="color" 
        value={color} 
        onChange={(e) => { setColor(e.target.value); addRecentColor(e.target.value); }} 
        style={{ 
          width: '100%', 
          height: '36px', 
          border: '2px solid rgba(255,255,255,0.2)', 
          cursor: 'pointer', 
          borderRadius: '8px',
          transition: 'all 0.3s ease'
        }} 
      />
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
        {recentColors.map((c, i) => (
          <div 
            key={i} 
            onClick={() => setColor(c)} 
            style={{ 
              width: '18px', 
              height: '18px', 
              background: c, 
              cursor: 'pointer', 
              border: '2px solid rgba(255,255,255,0.3)', 
              borderRadius: '4px',
              transition: 'all 0.2s ease',
              boxShadow: color === c ? '0 0 0 2px #3498db' : 'none'
            }} 
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          />
        ))}
      </div>
      
      <div style={{ color: 'white', fontSize: '11px', marginTop: '12px', fontWeight: '600' }}>
        Stroke: {strokeWidth}px
        <input 
          type="range" 
          min="1" 
          max="20" 
          value={strokeWidth} 
          onChange={(e) => setStrokeWidth(Number(e.target.value))} 
          style={{ width: '100%', marginTop: '4px' }} 
        />
      </div>
      
      {tool === 'eraser' && (
        <div style={{ color: 'white', fontSize: '11px', fontWeight: '600' }}>
          Size: {eraserSize}px
          <input 
            type="range" 
            min="5" 
            max="50" 
            value={eraserSize} 
            onChange={(e) => setEraserSize(Number(e.target.value))} 
            style={{ width: '100%', marginTop: '4px' }} 
          />
        </div>
      )}
      
      {tool === 'text' && (
        <div style={{ color: 'white', fontSize: '11px', fontWeight: '600' }}>
          Font: {fontSize}px
          <input 
            type="range" 
            min="8" 
            max="72" 
            value={fontSize} 
            onChange={(e) => setFontSize(Number(e.target.value))} 
            style={{ width: '100%', marginTop: '4px' }} 
          />
        </div>
      )}
    </div>
  );
};

const CanvasToolbar = () => {
  const { zoom, setZoom, setPan, showGrid, setShowGrid, snapToGrid, setSnapToGrid, gridSize, setGridSize, 
          undo, redo, historyIndex, history, clearCanvas } = useSketch();

  const btnStyle = {
    background: 'white',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  return (
    <div style={{ 
      position: 'absolute', 
      top: '16px', 
      left: '50%', 
      transform: 'translateX(-50%)', 
      background: 'white', 
      padding: '12px 16px', 
      borderRadius: '12px', 
      display: 'flex', 
      gap: '12px', 
      alignItems: 'center', 
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)', 
      zIndex: 10 
    }}>
      <button 
        onClick={() => setZoom(Math.max(0.1, zoom / 1.2))} 
        style={btnStyle}
        onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
      >
        <ZoomOut size={18} />
      </button>
      <span style={{ fontSize: '15px', minWidth: '70px', textAlign: 'center', fontWeight: '600', color: '#2c3e50' }}>
        {Math.round(zoom * 100)}%
      </span>
      <button 
        onClick={() => setZoom(Math.min(5, zoom * 1.2))} 
        style={btnStyle}
        onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
      >
        <ZoomIn size={18} />
      </button>
      <button 
        onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} 
        style={btnStyle}
        onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
      >
        <Maximize2 size={18} />
      </button>
      
      <div style={{ borderLeft: '2px solid #e0e0e0', height: '28px', margin: '0 6px' }} />
      
      <button 
        onClick={() => setShowGrid(!showGrid)} 
        style={{ 
          ...btnStyle, 
          background: showGrid ? 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)' : 'white', 
          color: showGrid ? 'white' : '#2c3e50' 
        }}
      >
        <Grid3x3 size={18} />
      </button>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', color: '#2c3e50' }}>
        <input 
          type="checkbox" 
          checked={snapToGrid} 
          onChange={(e) => setSnapToGrid(e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
        Snap
      </label>
      <select 
        value={gridSize} 
        onChange={(e) => setGridSize(Number(e.target.value))} 
        style={{ 
          padding: '6px 10px', 
          fontSize: '13px', 
          border: '1px solid #e0e0e0', 
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: '500',
          color: '#2c3e50',
          background: 'white'
        }}
      >
        <option value="5">5px</option>
        <option value="10">10px</option>
        <option value="20">20px</option>
        <option value="50">50px</option>
      </select>
      
      <div style={{ borderLeft: '2px solid #e0e0e0', height: '28px', margin: '0 6px' }} />
      
      <button 
        onClick={undo} 
        disabled={historyIndex <= 0} 
        style={{ 
          ...btnStyle, 
          opacity: historyIndex <= 0 ? 0.3 : 1,
          cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer'
        }}
        onMouseEnter={(e) => {
          if (historyIndex > 0) e.currentTarget.style.background = '#f0f0f0';
        }}
        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
      >
        <Undo size={18} />
      </button>
      <button 
        onClick={redo} 
        disabled={historyIndex >= history.length - 1} 
        style={{ 
          ...btnStyle, 
          opacity: historyIndex >= history.length - 1 ? 0.3 : 1,
          cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer'
        }}
        onMouseEnter={(e) => {
          if (historyIndex < history.length - 1) e.currentTarget.style.background = '#f0f0f0';
        }}
        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
      >
        <Redo size={18} />
      </button>
      
      <div style={{ borderLeft: '2px solid #e0e0e0', height: '28px', margin: '0 6px' }} />

      <button 
        onClick={clearCanvas} 
        style={{ 
          ...btnStyle, 
          color: '#e74c3c' 
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#fceaea'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
        title="Clear Canvas"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
};

const Canvas = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [dragOffset, setDragOffset] = useState(null);
  const [tempElement, setTempElement] = useState(null);
  const { currentPage, showGrid, gridSize, zoom, pan, tool, color, strokeWidth, eraserSize, 
          snapToGrid, pages, setPages, currentPageId, addToHistory, currentLayer, selectedElement, setSelectedElement, unit } = useSketch();

  const snapPoint = (x, y) => {
    if (!snapToGrid) return { x, y };
    return { x: Math.round(x / gridSize) * gridSize, y: Math.round(y / gridSize) * gridSize };
  };

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    return snapPoint(x, y);
  };

  const isPointInElement = (x, y, el) => {
    const tolerance = 10 / zoom;
    
    if (el.type === 'text') {
      const textWidth = el.text.length * el.fontSize * 0.6;
      return x >= el.x - tolerance && x <= el.x + textWidth + tolerance &&
             y >= el.y - el.fontSize - tolerance && y <= el.y + tolerance;
    }
    
    if (el.type === 'circle') {
      const r = Math.hypot(el.end.x - el.start.x, el.end.y - el.start.y);
      const dist = Math.hypot(x - el.start.x, y - el.start.y);
      return Math.abs(dist - r) <= tolerance;
    }
    
    if (el.type === 'rectangle' || el.type === 'door' || el.type === 'window') {
      const minX = Math.min(el.start.x, el.end.x);
      const maxX = Math.max(el.start.x, el.end.x);
      const minY = Math.min(el.start.y, el.end.y);
      const maxY = Math.max(el.start.y, el.end.y);
      return x >= minX - tolerance && x <= maxX + tolerance &&
             y >= minY - tolerance && y <= maxY + tolerance;
    }
    
    if (el.type === 'line' || el.type === 'wall' || el.type === 'measure') {
      const dist = pointToLineDistance(x, y, el.start.x, el.start.y, el.end.x, el.end.y);
      return dist <= tolerance;
    }
    
    if (el.type === 'path' || el.type === 'triangle') {
      return el.points.some(p => Math.hypot(p.x - x, p.y - y) <= tolerance);
    }
    
    return false;
  };

  const pointToLineDistance = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  };

  const handleMouseDown = (e) => {
    const pos = getCanvasCoords(e);
    setStartPos(pos);

    if (tool === 'select') {
      const clicked = [...currentPage.elements].reverse().find(el => isPointInElement(pos.x, pos.y, el));
      if (clicked) {
        setSelectedElement(clicked);
        setIsDragging(true);
        if (clicked.type === 'text') {
          setDragOffset({ x: pos.x - clicked.x, y: pos.y - clicked.y });
        } else if (clicked.start) {
          setDragOffset({ x: pos.x - clicked.start.x, y: pos.y - clicked.start.y });
        }
      } else {
        setSelectedElement(null);
      }
      return;
    }

    setIsDrawing(true);

    if (tool === 'text') {
      // Text is now added via Sidebar
      setIsDrawing(false);
      return;
    }
  };

  const handleMouseMove = (e) => {
    const pos = getCanvasCoords(e);

    if (tool === 'select' && isDragging && selectedElement) {
      const updatedElements = currentPage.elements.map(el => {
        if (el.id === selectedElement.id) {
          if (el.type === 'text') {
            return { ...el, x: pos.x - (dragOffset?.x || 0), y: pos.y - (dragOffset?.y || 0) };
          } else if (el.start && el.end) {
            const dx = pos.x - (dragOffset?.x || 0) - el.start.x;
            const dy = pos.y - (dragOffset?.y || 0) - el.start.y;
            return { ...el, start: { x: el.start.x + dx, y: el.start.y + dy }, end: { x: el.end.x + dx, y: el.end.y + dy } };
          }
        }
        return el;
      });
      setPages(pages.map(p => p.id === currentPageId ? { ...p, elements: updatedElements } : p));
      setSelectedElement(updatedElements.find(el => el.id === selectedElement.id));
      return;
    }

    if (!isDrawing || !startPos) return;

    if (tool === 'pen') {
      const newEl = { id: Date.now(), type: 'path', points: [startPos, pos], color, strokeWidth, layer: currentLayer };
      setPages(pages.map(p => p.id === currentPageId ? { ...p, elements: [...p.elements, newEl] } : p));
      setStartPos(pos);
    } else if (tool === 'eraser') {
      const filtered = currentPage.elements.filter(el => {
        if (el.type === 'path') return !el.points.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < eraserSize);
        return true;
      });
      setPages(pages.map(p => p.id === currentPageId ? { ...p, elements: filtered } : p));
    } else if (['line', 'rectangle', 'circle', 'wall', 'measure', 'door', 'window'].includes(tool)) {
      setTempElement({ type: tool, start: startPos, end: pos, color, strokeWidth: tool === 'wall' ? 8 : strokeWidth, layer: currentLayer });
    }
  };

  const handleMouseUp = () => {
    if (isDragging && selectedElement) {
      addToHistory(currentPage.elements);
      setIsDragging(false);
      setDragOffset(null);
      return;
    }

    if (!isDrawing) return;
    
    if (tempElement) {
      const newEl = { id: Date.now(), ...tempElement };
      const newElements = [...currentPage.elements, newEl];
      setPages(pages.map(p => p.id === currentPageId ? { ...p, elements: newElements } : p));
      addToHistory(newElements);
      setTempElement(null);
    } else if (tool === 'pen') {
      addToHistory(currentPage.elements);
    }
    
    setIsDrawing(false);
    setStartPos(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Helper to format length based on unit
    // Helper to format length based on unit - Enforcing Feet and Inches
    const formatLength = (pixels) => {
      // Always use Feet and Inches logic
      const feet = pixels / 20; // Assumption: 20px = 1ft
      const ft = Math.floor(feet);
      const inches = Math.round((feet - ft) * 12);
      if (inches === 12) return `${ft + 1}' 0"`;
      return `${ft}' ${inches}"`;
    };

    // Helper to format area based on unit
    // Helper to format area based on unit - Enforcing Sq Ft
    const formatArea = (sqPixels) => {
      // Always use Sq Ft logic
      const sqFeet = sqPixels / 400; // 20px * 20px = 400 sq px = 1 sq ft
      return `${sqFeet.toFixed(2)} sq ft`;
    };

    // Helper to draw dimensions
    const drawDimensions = (el) => {
      ctx.save();
      ctx.fillStyle = '#2c3e50';
      ctx.font = `bold ${12 / zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      
      // Background for text to make it readable
      const drawTextWithBg = (text, x, y, angle = 0) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        const metrics = ctx.measureText(text);
        const padding = 2 / zoom;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(-metrics.width / 2 - padding, -14 / zoom, metrics.width + padding * 2, 14 / zoom);
        ctx.fillStyle = '#2c3e50';
        ctx.fillText(text, 0, 0);
        ctx.restore();
      };

      if (el.type === 'line' || el.type === 'wall' || el.type === 'measure') {
        const midX = (el.start.x + el.end.x) / 2;
        const midY = (el.start.y + el.end.y) / 2;
        const length = Math.hypot(el.end.x - el.start.x, el.end.y - el.start.y);
        const text = formatLength(length);
        
        // Calculate angle
        let angle = Math.atan2(el.end.y - el.start.y, el.end.x - el.start.x);
        // Keep text upright
        if (angle > Math.PI / 2) angle -= Math.PI;
        if (angle < -Math.PI / 2) angle += Math.PI;
        
        drawTextWithBg(text, midX, midY - 5 / zoom, angle);
      } else if (['rectangle', 'door', 'window'].includes(el.type)) {
        const width = Math.abs(el.end.x - el.start.x);
        const height = Math.abs(el.end.y - el.start.y);
        const minX = Math.min(el.start.x, el.end.x);
        const maxX = Math.max(el.start.x, el.end.x);
        const minY = Math.min(el.start.y, el.end.y);
        const maxY = Math.max(el.start.y, el.end.y);
        
        // Offset for doors/windows to avoid overlap
        const offset = (el.type === 'door' || el.type === 'window') ? 25 / zoom : 5 / zoom;
        
        // Top width
        drawTextWithBg(formatLength(width), (minX + maxX) / 2, minY - offset);
        // Left height
        drawTextWithBg(formatLength(height), minX - offset, (minY + maxY) / 2, -Math.PI / 2);
        
        // Area in center (only for rectangle)
        if (el.type === 'rectangle') {
          const area = width * height;
          drawTextWithBg(formatArea(area), (minX + maxX) / 2, (minY + maxY) / 2);
        }
      }
      ctx.restore();
    };

    if (showGrid) {
      ctx.strokeStyle = '#e8ecf0';
      ctx.lineWidth = 1 / zoom;
      for (let x = 0; x < canvas.width / zoom; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height / zoom);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height / zoom; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width / zoom, y);
        ctx.stroke();
      }
    }

    currentPage.elements.forEach(el => {
      const isSelected = selectedElement?.id === el.id;
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = (el.strokeWidth || 2) / zoom;

      if (el.type === 'path' || el.type === 'triangle') {
        ctx.beginPath();
        el.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        if (el.type === 'triangle') ctx.closePath();
        ctx.stroke();
      } else if (el.type === 'line' || el.type === 'wall') {
        ctx.beginPath();
        ctx.moveTo(el.start.x, el.start.y);
        ctx.lineTo(el.end.x, el.end.y);
        ctx.stroke();
      } else if (el.type === 'rectangle') {
        ctx.strokeRect(el.start.x, el.start.y, el.end.x - el.start.x, el.end.y - el.start.y);
      } else if (el.type === 'circle') {
        const r = Math.hypot(el.end.x - el.start.x, el.end.y - el.start.y);
        ctx.beginPath();
        ctx.arc(el.start.x, el.start.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (el.type === 'text') {
        ctx.font = `${el.fontSize}px Arial`;
        ctx.fillText(el.text, el.x, el.y);
      } else if (el.type === 'measure') {
        ctx.strokeStyle = '#e74c3c';
        ctx.beginPath();
        ctx.moveTo(el.start.x, el.start.y);
        ctx.lineTo(el.end.x, el.end.y);
        ctx.stroke();
      } else if (el.type === 'door') {
        // Draw door as a standard architectural symbol
        const w = el.end.x - el.start.x;
        const h = el.end.y - el.start.y;
        const isVertical = Math.abs(h) > Math.abs(w);
        
        ctx.save();
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2 / zoom;
        
        // Draw the opening (frame)
        ctx.strokeRect(el.start.x, el.start.y, w, h);
        
        // Draw the door swing
        ctx.beginPath();
        if (isVertical) {
          // Vertical door
          const doorSize = Math.abs(h);
          const hingeY = h > 0 ? el.start.y : el.end.y;
          // const openX = el.start.x + (w > 0 ? w : 0); // Unused variable removed
          
          // Draw door panel (open 90 degrees)
          ctx.moveTo(el.start.x, hingeY);
          ctx.lineTo(el.start.x + (w > 0 ? -doorSize : doorSize), hingeY);
          
          // Draw arc
          ctx.moveTo(el.start.x + (w > 0 ? -doorSize : doorSize), hingeY);
          ctx.arc(el.start.x, hingeY, doorSize, w > 0 ? Math.PI : 0, w > 0 ? Math.PI * 1.5 : Math.PI * 0.5, w > 0);
        } else {
          // Horizontal door
          const doorSize = Math.abs(w);
          const hingeX = w > 0 ? el.start.x : el.end.x;
          
          // Draw door panel (open 90 degrees)
          ctx.moveTo(hingeX, el.start.y);
          ctx.lineTo(hingeX, el.start.y + (h > 0 ? -doorSize : doorSize));
          
          // Draw arc
          ctx.moveTo(hingeX, el.start.y + (h > 0 ? -doorSize : doorSize));
          ctx.arc(hingeX, el.start.y, doorSize, h > 0 ? Math.PI * 1.5 : Math.PI * 0.5, h > 0 ? 0 : Math.PI, h > 0);
        }
        ctx.stroke();
        ctx.restore();
        
      } else if (el.type === 'window') {
        // Draw window as a standard symbol (rectangle with center line)
        const w = el.end.x - el.start.x;
        const h = el.end.y - el.start.y;
        
        ctx.save();
        ctx.strokeStyle = '#2980b9';
        ctx.fillStyle = 'white';
        ctx.lineWidth = 2 / zoom;
        
        // Outer frame
        ctx.fillRect(el.start.x, el.start.y, w, h);
        ctx.strokeRect(el.start.x, el.start.y, w, h);
        
        // Inner glass line
        ctx.beginPath();
        if (Math.abs(w) > Math.abs(h)) {
          // Horizontal window
          ctx.moveTo(el.start.x, el.start.y + h/2);
          ctx.lineTo(el.end.x, el.start.y + h/2);
        } else {
          // Vertical window
          ctx.moveTo(el.start.x + w/2, el.start.y);
          ctx.lineTo(el.start.x + w/2, el.end.y);
        }
        ctx.stroke();
        ctx.restore();
      }
      
      // Draw dimensions for specific types
      if (['line', 'wall', 'measure', 'rectangle', 'door', 'window'].includes(el.type)) {
        drawDimensions(el);
      }

      if (isSelected) {
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([5 / zoom, 5 / zoom]);
        
        if (el.type === 'text') {
          const textWidth = el.text.length * el.fontSize * 0.6;
          ctx.strokeRect(el.x - 5, el.y - el.fontSize - 5, textWidth + 10, el.fontSize + 10);
        } else if (el.type === 'circle') {
          const r = Math.hypot(el.end.x - el.start.x, el.end.y - el.start.y);
          ctx.beginPath();
          ctx.arc(el.start.x, el.start.y, r + 5 / zoom, 0, Math.PI * 2);
          ctx.stroke();
        } else if (el.type === 'rectangle' || el.type === 'door' || el.type === 'window') {
          ctx.strokeRect(el.start.x - 5 / zoom, el.start.y - 5 / zoom, 
                         el.end.x - el.start.x + 10 / zoom, el.end.y - el.start.y + 10 / zoom);
        } else if (el.start && el.end) {
          const minX = Math.min(el.start.x, el.end.x) - 5 / zoom;
          const minY = Math.min(el.start.y, el.end.y) - 5 / zoom;
          const maxX = Math.max(el.start.x, el.end.x) + 5 / zoom;
          const maxY = Math.max(el.start.y, el.end.y) + 5 / zoom;
          ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        }
        
        ctx.setLineDash([]);
      }
    });

    if (tempElement) {
      ctx.strokeStyle = tempElement.color;
      ctx.lineWidth = tempElement.strokeWidth / zoom;
      if (tempElement.type === 'line' || tempElement.type === 'wall') {
        ctx.beginPath();
        ctx.moveTo(tempElement.start.x, tempElement.start.y);
        ctx.lineTo(tempElement.end.x, tempElement.end.y);
        ctx.stroke();
      } else if (['rectangle', 'door', 'window'].includes(tempElement.type)) {
        ctx.strokeRect(tempElement.start.x, tempElement.start.y, tempElement.end.x - tempElement.start.x, tempElement.end.y - tempElement.start.y);
      } else if (tempElement.type === 'circle') {
        const r = Math.hypot(tempElement.end.x - tempElement.start.x, tempElement.end.y - tempElement.start.y);
        ctx.beginPath();
        ctx.arc(tempElement.start.x, tempElement.start.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Draw dimensions for temp element too
      if (['line', 'wall', 'measure', 'rectangle', 'door', 'window'].includes(tempElement.type)) {
        drawDimensions(tempElement);
      }
    }

    ctx.restore();
    }, [currentPage, showGrid, gridSize, zoom, pan, tempElement, selectedElement, unit]);

  const getCursor = () => {
    if (tool === 'select') return isDragging ? 'grabbing' : 'grab';
    if (tool === 'eraser') return 'crosshair';
    if (tool === 'text') return 'text';
    return 'crosshair';
  };

  return (
    <canvas 
      ref={canvasRef} 
      width={1200} 
      height={800} 
      onMouseDown={handleMouseDown} 
      onMouseMove={handleMouseMove} 
      onMouseUp={handleMouseUp} 
      onMouseLeave={handleMouseUp}
      style={{ 
        cursor: getCursor(), 
        display: 'block',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        borderRadius: '4px'
      }} 
    />
  );
};

const PropertiesSection = () => {
  const { tool, color, strokeWidth, currentPage, pages, setPages, currentPageId, addToHistory, currentLayer, fontSize } = useSketch();
  const [width, setWidth] = useState(10);
  const [height, setHeight] = useState(10);
  const [length, setLength] = useState(10);

  const [textInput, setTextInput] = useState('');

  const handleAddShape = () => {
    const scale = 20; // Hardcoded: 20px = 1ft
    const w = parseFloat(width) * scale;
    const h = parseFloat(height) * scale;
    const l = parseFloat(length) * scale;
    
    const centerX = 600;
    const centerY = 400;
    
    let newElements = [];

    if (tool === 'text') {
      if (!textInput.trim()) return;
      newElements.push({
        id: Date.now(),
        type: 'text',
        text: textInput,
        x: centerX,
        y: centerY,
        fontSize,
        color,
        layer: currentLayer
      });
      setTextInput(''); // Clear input after adding
    } else if (tool === 'rectangle') {
      newElements.push({
        id: Date.now(),
        type: 'rectangle',
        start: { x: centerX - w/2, y: centerY - h/2 },
        end: { x: centerX + w/2, y: centerY + h/2 },
        color,
        strokeWidth,
        layer: currentLayer
      });
    } else if (tool === 'triangle') {
      // Equilateral triangle
      const h = (Math.sqrt(3)/2) * w;
      newElements.push({
        id: Date.now(),
        type: 'triangle',
        points: [
          { x: centerX, y: centerY - h/2 },
          { x: centerX - w/2, y: centerY + h/2 },
          { x: centerX + w/2, y: centerY + h/2 }
        ],
        color,
        strokeWidth,
        layer: currentLayer
      });
    } else if (tool === 'room') {
      // Create 4 walls
      const id = Date.now();
      const wallWidth = 8; // 8px thickness
      const halfW = w/2;
      const halfH = h/2;
      
      // Top
      newElements.push({ id: id, type: 'wall', start: { x: centerX - halfW, y: centerY - halfH }, end: { x: centerX + halfW, y: centerY - halfH }, color, strokeWidth: wallWidth, layer: currentLayer });
      // Right
      newElements.push({ id: id+1, type: 'wall', start: { x: centerX + halfW, y: centerY - halfH }, end: { x: centerX + halfW, y: centerY + halfH }, color, strokeWidth: wallWidth, layer: currentLayer });
      // Bottom
      newElements.push({ id: id+2, type: 'wall', start: { x: centerX + halfW, y: centerY + halfH }, end: { x: centerX - halfW, y: centerY + halfH }, color, strokeWidth: wallWidth, layer: currentLayer });
      // Left
      newElements.push({ id: id+3, type: 'wall', start: { x: centerX - halfW, y: centerY + halfH }, end: { x: centerX - halfW, y: centerY - halfH }, color, strokeWidth: wallWidth, layer: currentLayer });
    } else if (tool === 'circle') {
      newElements.push({
        id: Date.now(),
        type: 'circle',
        start: { x: centerX, y: centerY },
        end: { x: centerX + w/2, y: centerY },
        color,
        strokeWidth,
        layer: currentLayer
      });
    } else if (tool === 'wall' || tool === 'line') {
      newElements.push({
        id: Date.now(),
        type: tool,
        start: { x: centerX - l/2, y: centerY },
        end: { x: centerX + l/2, y: centerY },
        color,
        strokeWidth: tool === 'wall' ? 8 : strokeWidth,
        layer: currentLayer
      });
    }

    if (newElements.length > 0) {
      const updatedElements = [...currentPage.elements, ...newElements];
      setPages(pages.map(p => p.id === currentPageId ? { ...p, elements: updatedElements } : p));
      addToHistory(updatedElements);
    }
  };

  if (!['rectangle', 'circle', 'wall', 'line', 'room', 'triangle', 'text'].includes(tool)) return null;

  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '700', color: '#2c3e50', letterSpacing: '0.5px' }}>
        Add {tool.charAt(0).toUpperCase() + tool.slice(1)}
      </h3>
      
      {(tool === 'rectangle' || tool === 'circle' || tool === 'room' || tool === 'triangle') && (
        <>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>Width / Diameter / Base (ft)</label>
            <input 
              type="number" 
              value={width} 
              onChange={(e) => setWidth(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #bdc3c7' }}
            />
          </div>
          {(tool === 'rectangle' || tool === 'room') && (
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>Height (ft)</label>
              <input 
                type="number" 
                value={height} 
                onChange={(e) => setHeight(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #bdc3c7' }}
              />
            </div>
          )}
        </>
      )}

      {(tool === 'text') && (
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>Text Content</label>
          <input 
            type="text" 
            value={textInput} 
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Enter text here..."
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #bdc3c7' }}
          />
        </div>
      )}

      {(tool === 'wall' || tool === 'line') && (
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>Length (ft)</label>
          <input 
            type="number" 
            value={length} 
            onChange={(e) => setLength(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #bdc3c7' }}
          />
        </div>
      )}

      <button 
        onClick={handleAddShape}
        style={{
          width: '100%',
          background: '#3498db',
          color: 'white',
          border: 'none',
          padding: '10px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: '600',
          marginTop: '8px'
        }}
      >
        Add to Canvas
      </button>
    </div>
  );
};

const Sidebar = () => {
  const { pages, setPages, currentPageId, setCurrentPageId, layers, currentLayer, setCurrentLayer } = useSketch();

  const addPage = () => {
    const newPage = { id: Date.now(), name: `Floor Plan ${pages.length + 1}`, elements: [] };
    setPages([...pages, newPage]);
    setCurrentPageId(newPage.id);
  };

  const deletePage = (id) => {
    if (pages.length === 1) return;
    setPages(pages.filter(p => p.id !== id));
    if (currentPageId === id) setCurrentPageId(pages[0].id);
  };

  return (
    <div style={{ 
      width: '300px', 
      background: 'linear-gradient(180deg, #f8f9fa 0%, #ecf0f1 100%)', 
      padding: '20px', 
      overflowY: 'auto', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '24px',
      boxShadow: '-2px 0 8px rgba(0,0,0,0.05)'
    }}>
      <PropertiesSection />
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#2c3e50', letterSpacing: '0.5px' }}>Pages</h3>
          <button 
            onClick={addPage} 
            style={{
              background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(52, 152, 219, 0.3)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Plus size={16} />
          </button>
        </div>
        {pages.map(page => (
          <div 
            key={page.id} 
            style={{ 
              padding: '12px 16px', 
              background: currentPageId === page.id ? 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)' : 'white', 
              color: currentPageId === page.id ? 'white' : '#2c3e50',
              borderRadius: '10px', 
              cursor: 'pointer', 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
              transition: 'all 0.3s ease',
              boxShadow: currentPageId === page.id ? '0 4px 12px rgba(52, 152, 219, 0.4)' : '0 2px 4px rgba(0,0,0,0.05)',
              fontWeight: currentPageId === page.id ? '600' : '500'
            }}
            onClick={() => setCurrentPageId(page.id)}
            onMouseEnter={(e) => {
              if (currentPageId !== page.id) e.currentTarget.style.background = '#f0f0f0';
            }}
            onMouseLeave={(e) => {
              if (currentPageId !== page.id) e.currentTarget.style.background = 'white';
            }}
          >
            <span style={{ fontSize: '14px' }}>{page.name}</span>
            {pages.length > 1 && (
              <button 
                onClick={(e) => { e.stopPropagation(); deletePage(page.id); }} 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: currentPageId === page.id ? 'white' : '#e74c3c', 
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  padding: '0 4px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '700', color: '#2c3e50', letterSpacing: '0.5px' }}>Layers</h3>
        {layers.map(layer => (
          <div 
            key={layer.id} 
            style={{ 
              padding: '12px 16px', 
              background: currentLayer === layer.id ? 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)' : 'white',
              color: currentLayer === layer.id ? 'white' : '#2c3e50',
              borderRadius: '10px', 
              cursor: 'pointer', 
              marginBottom: '8px',
              transition: 'all 0.3s ease',
              boxShadow: currentLayer === layer.id ? '0 4px 12px rgba(46, 204, 113, 0.4)' : '0 2px 4px rgba(0,0,0,0.05)',
              fontWeight: currentLayer === layer.id ? '600' : '500'
            }}
            onClick={() => setCurrentLayer(layer.id)}
            onMouseEnter={(e) => {
              if (currentLayer !== layer.id) e.currentTarget.style.background = '#f0f0f0';
            }}
            onMouseLeave={(e) => {
              if (currentLayer !== layer.id) e.currentTarget.style.background = 'white';
            }}
          >
            <span style={{ fontSize: '14px' }}>{layer.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};



export const SketchPadContent = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <Header />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Toolbox />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#fafbfc' }}>
          <CanvasToolbar />
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Canvas />
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
};

export default function FloorPlanDesigner() {
  return (
    <SketchProvider>
      <SketchPadContent />
    </SketchProvider>
  );
}