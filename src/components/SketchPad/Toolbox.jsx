// src/components/SketchPad/Toolbox.jsx
import React from 'react';
import {
  Move, Pen, Eraser, Minus, Square, Circle, Type,
  Edit3, Ruler, AlignCenter
} from 'lucide-react';
import { useSketch } from './SketchContext';

const ToolButton = ({ icon, active, onClick, title }) => (
  <button
    onClick={onClick}
    style={{
      background: active ? '#1abc9c' : 'transparent',
      border: 'none',
      color: 'white',
      cursor: 'pointer',
      padding: '8px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s',
    }}
    onMouseOver={(e) => {
      if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
    }}
    onMouseOut={(e) => {
      if (!active) e.currentTarget.style.background = 'transparent';
    }}
    title={title}
  >
    {icon}
  </button>
);

export default function Toolbox() {
  const {
    tool, setTool,
    color, setColor,
    strokeWidth, setStrokeWidth,
    eraserSize, setEraserSize,
    fontSize, setFontSize,
    recentColors, setRecentColors,
  } = useSketch();

  const addRecentColor = (newColor) => {
    if (!recentColors.includes(newColor)) {
      setRecentColors([newColor, ...recentColors.slice(0, 7)]);
    }
  };

  const handleColorChange = (e) => {
    const newColor = e.target.value;
    setColor(newColor);
    addRecentColor(newColor);
  };

  return (
    <div
      style={{
        width: '80px',
        background: '#34495e',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        overflowY: 'auto',
      }}
    >
      {/* Drawing Tools */}
      <ToolButton 
        icon={<Move size={20} />} 
        active={tool === 'select'} 
        onClick={() => setTool('select')} 
        title="Select (V)" 
      />
      <ToolButton 
        icon={<Pen size={20} />} 
        active={tool === 'pen'} 
        onClick={() => setTool('pen')} 
        title="Pen (P)" 
      />
      <ToolButton 
        icon={<Eraser size={20} />} 
        active={tool === 'eraser'} 
        onClick={() => setTool('eraser')} 
        title="Eraser (E)" 
      />
      <ToolButton 
        icon={<Minus size={20} />} 
        active={tool === 'line'} 
        onClick={() => setTool('line')} 
        title="Line (L)" 
      />
      <ToolButton 
        icon={<Square size={20} />} 
        active={tool === 'rectangle'} 
        onClick={() => setTool('rectangle')} 
        title="Rectangle (R)" 
      />
      <ToolButton 
        icon={<Circle size={20} />} 
        active={tool === 'circle'} 
        onClick={() => setTool('circle')} 
        title="Circle (C)" 
      />
      <ToolButton 
        icon={<Type size={20} />} 
        active={tool === 'text'} 
        onClick={() => setTool('text')} 
        title="Text (T)" 
      />
      <ToolButton 
        icon={<Edit3 size={20} />} 
        active={tool === 'wall'} 
        onClick={() => setTool('wall')} 
        title="Wall (W)" 
      />
      <ToolButton 
        icon={<Ruler size={20} />} 
        active={tool === 'measure'} 
        onClick={() => setTool('measure')} 
        title="Measure (M)" 
      />
      <ToolButton 
        icon={<AlignCenter size={20} />} 
        active={tool === 'furniture'} 
        onClick={() => setTool('furniture')} 
        title="Furniture (F)" 
      />

      {/* Divider */}
      <div style={{ borderTop: '1px solid #555', margin: '10px 0' }} />

      {/* Color Picker */}
      <input
        type="color"
        value={color}
        onChange={handleColorChange}
        style={{ 
          width: '60px', 
          height: '30px', 
          border: 'none', 
          cursor: 'pointer',
          borderRadius: '4px',
        }}
        title="Color"
      />

      {/* Recent Colors */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
        {recentColors.map((c, idx) => (
          <div
            key={`${c}-${idx}`}
            onClick={() => setColor(c)}
            style={{
              width: '14px',
              height: '14px',
              background: c,
              cursor: 'pointer',
              border: '1px solid #fff',
              borderRadius: '2px',
            }}
            title={c}
          />
        ))}
      </div>

      {/* Stroke Width */}
      <div style={{ color: 'white', fontSize: '10px', marginTop: '10px' }}>
        <div>Width: {strokeWidth}px</div>
        <input
          type="range"
          min="1"
          max="20"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Eraser Size (conditional) */}
      {tool === 'eraser' && (
        <div style={{ color: 'white', fontSize: '10px' }}>
          <div>Size: {eraserSize}px</div>
          <input
            type="range"
            min="5"
            max="50"
            value={eraserSize}
            onChange={(e) => setEraserSize(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* Font Size (conditional) */}
      {tool === 'text' && (
        <div style={{ color: 'white', fontSize: '10px' }}>
          <div>Font: {fontSize}px</div>
          <input
            type="range"
            min="8"
            max="72"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      )}
    </div>
  );
}