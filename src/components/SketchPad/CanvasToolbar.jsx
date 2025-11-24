// src/components/SketchPad/CanvasToolbar.jsx
import React from 'react';
import {
  Grid3x3, ZoomIn, ZoomOut, Maximize2, Undo, Redo
} from 'lucide-react';
import { useSketch } from './SketchContext';

const toolbarButtonStyle = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '4px',
  transition: 'background 0.2s',
};

export default function CanvasToolbar() {
  const {
    zoom, setZoom,
    setPan,
    showGrid, setShowGrid,
    snapToGrid, setSnapToGrid,
    snapAngle, setSnapAngle,
    gridSize, setGridSize,
    unit, setUnit,
    undo,
    redo,
    historyIndex,
    history,
  } = useSketch();

  const zoomIn = () => setZoom((z) => Math.min(5, z * 1.2));
  const zoomOut = () => setZoom((z) => Math.max(0.1, z / 1.2));
  const zoomToFit = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div
      style={{
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'white',
        padding: '8px',
        borderRadius: '8px',
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 10,
      }}
    >
      {/* Zoom Controls */}
      <button 
        onClick={zoomOut} 
        style={toolbarButtonStyle}
        onMouseOver={(e) => e.currentTarget.style.background = '#f0f0f0'}
        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        title="Zoom Out"
      >
        <ZoomOut size={16} />
      </button>
      
      <span style={{ 
        fontSize: '14px', 
        minWidth: '60px', 
        textAlign: 'center',
        fontWeight: '500',
      }}>
        {Math.round(zoom * 100)}%
      </span>
      
      <button 
        onClick={zoomIn} 
        style={toolbarButtonStyle}
        onMouseOver={(e) => e.currentTarget.style.background = '#f0f0f0'}
        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        title="Zoom In"
      >
        <ZoomIn size={16} />
      </button>
      
      <button 
        onClick={zoomToFit} 
        style={toolbarButtonStyle}
        onMouseOver={(e) => e.currentTarget.style.background = '#f0f0f0'}
        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        title="Fit to Screen"
      >
        <Maximize2 size={16} />
      </button>

      {/* Divider */}
      <div style={{ borderLeft: '1px solid #ddd', height: '24px', margin: '0 5px' }} />

      {/* Grid Controls */}
      <button
        onClick={() => setShowGrid(!showGrid)}
        style={{
          ...toolbarButtonStyle,
          background: showGrid ? '#3498db' : 'transparent',
          color: showGrid ? 'white' : '#333',
        }}
        title="Toggle Grid"
      >
        <Grid3x3 size={16} />
      </button>

      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '5px', 
        fontSize: '12px',
        cursor: 'pointer',
      }}>
        <input 
          type="checkbox" 
          checked={snapToGrid} 
          onChange={(e) => setSnapToGrid(e.target.checked)} 
        />
        Snap Grid
      </label>

      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '5px', 
        fontSize: '12px',
        cursor: 'pointer',
      }}>
        <input 
          type="checkbox" 
          checked={snapAngle} 
          onChange={(e) => setSnapAngle(e.target.checked)} 
        />
        Snap Angle
      </label>

      <select 
        value={gridSize} 
        onChange={(e) => setGridSize(Number(e.target.value))} 
        style={{ 
          padding: '4px 8px', 
          fontSize: '12px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        <option value="5">5px</option>
        <option value="10">10px</option>
        <option value="20">20px</option>
        <option value="50">50px</option>
      </select>

      {/* Divider */}
      <div style={{ borderLeft: '1px solid #ddd', height: '24px', margin: '0 5px' }} />

      {/* History Controls */}
      <button 
        onClick={undo} 
        style={{
          ...toolbarButtonStyle,
          opacity: canUndo ? 1 : 0.3,
          cursor: canUndo ? 'pointer' : 'not-allowed',
        }}
        disabled={!canUndo}
        onMouseOver={(e) => {
          if (canUndo) e.currentTarget.style.background = '#f0f0f0';
        }}
        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        title="Undo (Ctrl+Z)"
      >
        <Undo size={16} />
      </button>
      
      <button 
        onClick={redo} 
        style={{
          ...toolbarButtonStyle,
          opacity: canRedo ? 1 : 0.3,
          cursor: canRedo ? 'pointer' : 'not-allowed',
        }}
        disabled={!canRedo}
        onMouseOver={(e) => {
          if (canRedo) e.currentTarget.style.background = '#f0f0f0';
        }}
        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        title="Redo (Ctrl+Y)"
      >
        <Redo size={16} />
      </button>

      {/* Divider */}
      <div style={{ borderLeft: '1px solid #ddd', height: '24px', margin: '0 5px' }} />

      {/* Unit Selector */}
      <select 
        value={unit} 
        onChange={(e) => setUnit(e.target.value)} 
        style={{ 
          padding: '4px 8px', 
          fontSize: '12px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        <option value="px">Pixels</option>
        <option value="ft">Feet</option>
        <option value="m">Meters</option>
      </select>
    </div>
  );
}