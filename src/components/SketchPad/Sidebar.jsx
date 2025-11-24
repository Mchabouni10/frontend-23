// src/components/SketchPad/Sidebar.jsx
import React from 'react';
import { Plus, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { useSketch } from './SketchContext';

const smallButtonStyle = {
  background: '#3498db',
  border: 'none',
  color: 'white',
  cursor: 'pointer',
  padding: '6px',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.2s',
};

export default function Sidebar() {
  const {
    pages,
    setPages,
    currentPageId,
    setCurrentPageId,
    layers,
    setLayers,
    currentLayer,
    setCurrentLayer,
    furnitureLibrary,
  } = useSketch();

  const addPage = () => {
    const newPage = {
      id: Date.now(),
      name: `Floor Plan ${pages.length + 1}`,
      elements: [],
    };
    setPages([...pages, newPage]);
    setCurrentPageId(newPage.id);
  };

  const deletePage = (pageId) => {
    if (pages.length === 1) {
      alert('Cannot delete the last page');
      return;
    }
    const updatedPages = pages.filter(p => p.id !== pageId);
    setPages(updatedPages);
    if (currentPageId === pageId) {
      setCurrentPageId(updatedPages[0].id);
    }
  };

  const toggleLayerVisibility = (layerId) => {
    setLayers(layers.map(layer =>
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    ));
  };

  const toggleLayerLock = (layerId) => {
    setLayers(layers.map(layer =>
      layer.id === layerId ? { ...layer, locked: !layer.locked } : layer
    ));
  };

  return (
    <div
      style={{
        width: '280px',
        background: '#ecf0f1',
        padding: '15px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Pages Section */}
      <div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '10px' 
        }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
            Pages
          </h3>
          <button 
            onClick={addPage} 
            style={smallButtonStyle}
            onMouseOver={(e) => e.currentTarget.style.background = '#2980b9'}
            onMouseOut={(e) => e.currentTarget.style.background = '#3498db'}
            title="Add Page"
          >
            <Plus size={14} />
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {pages.map((page) => (
            <div
              key={page.id}
              style={{
                padding: '10px',
                background: currentPageId === page.id ? '#bdc3c7' : 'white',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'background 0.2s',
              }}
              onClick={() => setCurrentPageId(page.id)}
              onMouseOver={(e) => {
                if (currentPageId !== page.id) {
                  e.currentTarget.style.background = '#ecf0f1';
                }
              }}
              onMouseOut={(e) => {
                if (currentPageId !== page.id) {
                  e.currentTarget.style.background = 'white';
                }
              }}
            >
              <span style={{ fontSize: '13px' }}>{page.name}</span>
              {pages.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePage(page.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#e74c3c',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '2px 6px',
                  }}
                  title="Delete Page"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Layers Section */}
      <div>
        <h3 style={{ 
          margin: '0 0 10px', 
          fontSize: '14px', 
          fontWeight: 'bold' 
        }}>
          Layers
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {layers.map((layer) => (
            <div
              key={layer.id}
              style={{
                padding: '10px',
                background: currentLayer === layer.id ? '#bdc3c7' : 'white',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: layer.visible ? 1 : 0.5,
                transition: 'all 0.2s',
              }}
              onClick={() => !layer.locked && setCurrentLayer(layer.id)}
            >
              <span style={{ fontSize: '13px', flex: 1 }}>{layer.name}</span>
              
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLayerVisibility(layer.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                  }}
                  title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                >
                  {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLayerLock(layer.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                  }}
                  title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
                >
                  {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Furniture Library Section */}
      <div>
        <h3 style={{ 
          margin: '0 0 10px', 
          fontSize: '14px', 
          fontWeight: 'bold' 
        }}>
          Furniture Library
        </h3>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '8px' 
        }}>
          {furnitureLibrary.map((furn) => (
            <div
              key={furn.id}
              draggable
              style={{
                background: furn.color,
                height: '60px',
                borderRadius: '6px',
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px',
                fontWeight: '500',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: 'transform 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title={`${furn.name} (${furn.width}x${furn.height})`}
            >
              {furn.name}
            </div>
          ))}
        </div>
      </div>

      {/* Element Properties (Future) */}
      <div>
        <h3 style={{ 
          margin: '0 0 10px', 
          fontSize: '14px', 
          fontWeight: 'bold',
          color: '#95a5a6',
        }}>
          Properties
        </h3>
        <div style={{
          padding: '15px',
          background: 'white',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#7f8c8d',
          textAlign: 'center',
        }}>
          Select an element to view properties
        </div>
      </div>
    </div>
  );
}