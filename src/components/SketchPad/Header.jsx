// src/components/SketchPad/Header.jsx
import React from 'react';
import { Camera, Save, Download } from 'lucide-react';
import { useSketch } from './SketchContext';

const iconButtonStyle = {
  background: 'transparent',
  border: 'none',
  color: 'white',
  cursor: 'pointer',
  padding: '6px',
  borderRadius: '4px',
  transition: 'background 0.2s',
};

export default function Header() {
  const { pages, setPages } = useSketch();

  const saveProject = () => {
    const data = { pages, version: '1.0', timestamp: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `floor-plan-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadProject = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result);
        if (data.pages && Array.isArray(data.pages)) {
          setPages(data.pages);
          alert('Project loaded successfully!');
        } else {
          alert('Invalid project file format');
        }
      } catch (err) {
        console.error('Load error:', err);
        alert('Failed to load project file');
      }
    };
    reader.readAsText(file);
  };

  const exportAsPNG = () => {
    // TODO: Implement canvas to PNG export
    alert('Export PNG - Implementation pending');
  };

  const exportAsSVG = () => {
    // TODO: Implement canvas to SVG export
    alert('Export SVG - Implementation pending');
  };

  return (
    <header
      style={{
        background: '#2c3e50',
        color: 'white',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}
    >
      <h1 style={{ 
        margin: 0, 
        fontSize: '20px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px' 
      }}>
        <Camera size={24} />
        Professional Floor Plan Designer
      </h1>
      
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button 
          onClick={saveProject} 
          style={{...iconButtonStyle}}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          title="Save Project"
        >
          <Save size={18} />
        </button>
        
        <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Load Project">
          <input 
            type="file" 
            accept=".json" 
            onChange={loadProject} 
            style={{ display: 'none' }} 
          />
          <div 
            style={{...iconButtonStyle}}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <Download size={18} />
          </div>
        </label>
        
        <button 
          onClick={exportAsPNG} 
          style={{...iconButtonStyle, padding: '6px 12px'}}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
          PNG
        </button>
        
        <button 
          onClick={exportAsSVG} 
          style={{...iconButtonStyle, padding: '6px 12px'}}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
          SVG
        </button>
      </div>
    </header>
  );
}