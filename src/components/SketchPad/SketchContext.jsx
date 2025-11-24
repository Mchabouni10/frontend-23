// src/components/SketchPad/SketchContext.jsx
import React, { createContext, useContext, useState } from 'react';
import { generate3DFromSketch } from './export3D';

const SketchContext = createContext(null);

export const SketchProvider = ({ children }) => {
  // Pages management
  const [pages, setPages] = useState([
    { id: 1, name: 'Floor Plan 1', elements: [] },
  ]);
  const [currentPageId, setCurrentPageId] = useState(1);
  
  // Drawing tools
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [eraserSize, setEraserSize] = useState(20);
  const [fontSize, setFontSize] = useState(16);
  
  // Grid settings
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [snapAngle, setSnapAngle] = useState(true);
  
  // View controls
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // History for undo/redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Selection and editing
  const [selectedElements, setSelectedElements] = useState([]);
  const [editingTextId, setEditingTextId] = useState(null);
  
  // Layers management
  const [layers, setLayers] = useState([
    { id: 'walls', name: 'Walls', visible: true, locked: false, order: 0 },
    { id: 'furniture', name: 'Furniture', visible: true, locked: false, order: 1 },
    { id: 'annotations', name: 'Annotations', visible: true, locked: false, order: 2 },
    { id: 'dimensions', name: 'Dimensions', visible: true, locked: false, order: 3 },
  ]);
  const [currentLayer, setCurrentLayer] = useState('walls');
  
  // Measurements
  const [showMeasurements, setShowMeasurements] = useState(true);
  const [unit, setUnit] = useState('px');
  
  // Furniture library
  const [furnitureLibrary] = useState([
    { id: 'bed', name: 'Bed', width: 80, height: 100, color: '#8B4513' },
    { id: 'table', name: 'Table', width: 60, height: 60, color: '#654321' },
    { id: 'sofa', name: 'Sofa', width: 100, height: 40, color: '#4A4A4A' },
    { id: 'chair', name: 'Chair', width: 30, height: 30, color: '#696969' },
  ]);
  
  // UI state
  const [recentColors, setRecentColors] = useState(['#000000', '#FF0000', '#0000FF', '#00FF00']);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false);
  const [draggingFurniture, setDraggingFurniture] = useState(null);
  
  // 3D Model State
  const [modelGlb, setModelGlb] = useState(null);
  
  // Computed value
  const currentPage = pages.find((p) => p.id === currentPageId);
  
  // History management functions
  const addToHistory = (elements) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(elements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };
  
  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      const page = pages.find(p => p.id === currentPageId);
      if (page) {
        page.elements = history[historyIndex - 1];
        setPages([...pages]);
      }
    }
  };
  
  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      const page = pages.find(p => p.id === currentPageId);
      if (page) {
        page.elements = history[historyIndex + 1];
        setPages([...pages]);
      }
    }
  };

  const generate3D = async () => {
    const page = pages.find(p => p.id === currentPageId);
    if (!page || !page.elements) return;
    
    try {
      const glbData = await generate3DFromSketch(page.elements);
      setModelGlb(glbData);
    } catch (error) {
      console.error("Failed to generate 3D model:", error);
    }
  };

  const value = {
    // Pages
    pages, setPages,
    currentPageId, setCurrentPageId,
    currentPage,
    
    // Tools
    tool, setTool,
    color, setColor,
    strokeWidth, setStrokeWidth,
    eraserSize, setEraserSize,
    fontSize, setFontSize,
    
    // Grid
    showGrid, setShowGrid,
    gridSize, setGridSize,
    snapToGrid, setSnapToGrid,
    snapAngle, setSnapAngle,
    
    // View
    zoom, setZoom,
    pan, setPan,
    
    // History
    history, setHistory,
    historyIndex, setHistoryIndex,
    addToHistory,
    undo,
    redo,
    
    // Selection
    selectedElements, setSelectedElements,
    editingTextId, setEditingTextId,
    
    // Layers
    layers, setLayers,
    currentLayer, setCurrentLayer,
    
    // Measurements
    showMeasurements, setShowMeasurements,
    unit, setUnit,
    
    // Furniture
    furnitureLibrary,
    draggingFurniture, setDraggingFurniture,
    
    // UI
    recentColors, setRecentColors,
    showPropertiesPanel, setShowPropertiesPanel,
    
    // 3D
    modelGlb,
    generate3D,
  };

  return <SketchContext.Provider value={value}>{children}</SketchContext.Provider>;
};

export const useSketch = () => {
  const context = useContext(SketchContext);
  if (!context) {
    throw new Error('useSketch must be used within SketchProvider');
  }
  return context;
};