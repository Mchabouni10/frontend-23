import React, { createContext, useContext, useState, useCallback } from 'react';
import { generate3DFromSketch } from '../components/SketchPad/export3D';

const SketchContext = createContext(null);

export const SketchProvider = ({ children }) => {
    const [pages, setPages] = useState([{ id: 1, name: 'Floor Plan 1', elements: [] }]);
    const [currentPageId, setCurrentPageId] = useState(1);
    const [tool, setTool] = useState('select');
    const [color, setColor] = useState('#2c3e50');
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [eraserSize, setEraserSize] = useState(20);
    const [fontSize, setFontSize] = useState(16);
    const [showGrid, setShowGrid] = useState(true);
    const [gridSize, setGridSize] = useState(20);
    const [snapToGrid, setSnapToGrid] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [selectedElement, setSelectedElement] = useState(null);
    const [layers] = useState([
        { id: 'walls', name: 'Walls', visible: true, locked: false },
        { id: 'furniture', name: 'Furniture', visible: true, locked: false },
        { id: 'annotations', name: 'Annotations', visible: true, locked: false },
        { id: 'dimensions', name: 'Dimensions', visible: true, locked: false }
    ]);
    const [currentLayer, setCurrentLayer] = useState('walls');
    const [unit, setUnit] = useState('ft');
    const [recentColors, setRecentColors] = useState(['#2c3e50', '#3498db', '#e74c3c', '#2ecc71', '#f39c12']);
    const [modelGlb, setModelGlb] = useState(null);

    const currentPage = pages.find(p => p.id === currentPageId);

    const addToHistory = useCallback((elements) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(JSON.parse(JSON.stringify(elements)));
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    const undo = () => {
        if (historyIndex > 0) {
            const prevElements = history[historyIndex - 1];
            setPages(pages.map(p => p.id === currentPageId ? { ...p, elements: prevElements } : p));
            setHistoryIndex(historyIndex - 1);
            setSelectedElement(null);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const nextElements = history[historyIndex + 1];
            setPages(pages.map(p => p.id === currentPageId ? { ...p, elements: nextElements } : p));
            setHistoryIndex(historyIndex + 1);
        }
    };

    const deleteSelected = () => {
        if (selectedElement) {
            const newElements = currentPage.elements.filter(el => el.id !== selectedElement.id);
            setPages(pages.map(p => p.id === currentPageId ? { ...p, elements: newElements } : p));
            addToHistory(newElements);
            setSelectedElement(null);
        }
    };

    const clearCanvas = () => {
        if (window.confirm('Are you sure you want to clear the canvas?')) {
            const newElements = [];
            setPages(pages.map(p => p.id === currentPageId ? { ...p, elements: newElements } : p));
            addToHistory(newElements);
            setSelectedElement(null);
        }
    };

    const duplicateSelected = () => {
        if (selectedElement) {
            const newEl = {
                ...selectedElement,
                id: Date.now(),
                x: (selectedElement.x || selectedElement.start?.x || 0) + 20,
                y: (selectedElement.y || selectedElement.start?.y || 0) + 20,
                start: selectedElement.start ? { x: selectedElement.start.x + 20, y: selectedElement.start.y + 20 } : undefined,
                end: selectedElement.end ? { x: selectedElement.end.x + 20, y: selectedElement.end.y + 20 } : undefined,
            };
            const newElements = [...currentPage.elements, newEl];
            setPages(pages.map(p => p.id === currentPageId ? { ...p, elements: newElements } : p));
            addToHistory(newElements);
            setSelectedElement(newEl);
        }
    };

    const generate3D = async () => {
        try {
            const glb = await generate3DFromSketch(currentPage.elements);
            setModelGlb(glb);
        } catch (error) {
            console.error("Failed to generate 3D model", error);
        }
    };

    return (
        <SketchContext.Provider value={{
            pages, setPages, currentPageId, setCurrentPageId, currentPage,
            tool, setTool, color, setColor, strokeWidth, setStrokeWidth,
            eraserSize, setEraserSize, fontSize, setFontSize,
            showGrid, setShowGrid, gridSize, setGridSize, snapToGrid, setSnapToGrid,
            zoom, setZoom, pan, setPan, history, historyIndex, addToHistory, undo, redo,
            layers, currentLayer, setCurrentLayer, unit, setUnit,
            recentColors, setRecentColors,
            selectedElement, setSelectedElement, deleteSelected, duplicateSelected, clearCanvas,
            modelGlb, generate3D
        }}>
            {children}
        </SketchContext.Provider>
    );
};

export const useSketch = () => {
    const ctx = useContext(SketchContext);
    if (!ctx) throw new Error('useSketch must be used within SketchProvider');
    return ctx;
};
