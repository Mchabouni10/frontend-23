// src/components/SketchPad/Canvas.jsx
import React, { useRef, useEffect, useState } from 'react';
import { useSketch } from './SketchContext';

export default function Canvas() {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [currentElement, setCurrentElement] = useState(null);

  const {
    currentPage,
    showGrid,
    gridSize,
    zoom,
    pan,
    tool,
    color,
    strokeWidth,
    pages,
    setPages,
    currentPageId,
    addToHistory,
    snapToGrid,
  } = useSketch();

  // Helper function to snap to grid
  const snapPoint = (x, y) => {
    if (!snapToGrid) return { x, y };
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize,
    };
  };

  // Get canvas coordinates from mouse event
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    
    return snapPoint(x, y);
  };

  // Draw everything on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 0.5 / zoom;
      
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

    // Draw all elements
    if (currentPage?.elements) {
      currentPage.elements.forEach((el) => {
        ctx.strokeStyle = el.color || '#000000';
        ctx.fillStyle = el.color || '#000000';
        ctx.lineWidth = (el.strokeWidth || 2) / zoom;

        switch (el.type) {
          case 'line':
            ctx.beginPath();
            ctx.moveTo(el.start.x, el.start.y);
            ctx.lineTo(el.end.x, el.end.y);
            ctx.stroke();
            break;

          case 'rectangle':
            ctx.strokeRect(el.x, el.y, el.width, el.height);
            if (el.filled) {
              ctx.fillRect(el.x, el.y, el.width, el.height);
            }
            break;

          case 'circle':
            ctx.beginPath();
            const radius = Math.sqrt(
              Math.pow(el.end.x - el.start.x, 2) + 
              Math.pow(el.end.y - el.start.y, 2)
            );
            ctx.arc(el.start.x, el.start.y, radius, 0, 2 * Math.PI);
            ctx.stroke();
            if (el.filled) {
              ctx.fill();
            }
            break;

          case 'path':
            if (el.points && el.points.length > 1) {
              ctx.beginPath();
              ctx.moveTo(el.points[0].x, el.points[0].y);
              for (let i = 1; i < el.points.length; i++) {
                ctx.lineTo(el.points[i].x, el.points[i].y);
              }
              ctx.stroke();
            }
            break;

          case 'text':
            ctx.font = `${el.fontSize || 16}px Arial`;
            ctx.fillText(el.text || '', el.x, el.y);
            break;

          default:
            break;
        }
      });
    }

    // Draw current element being created
    if (currentElement) {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = strokeWidth / zoom;

      switch (currentElement.type) {
        case 'line':
          ctx.beginPath();
          ctx.moveTo(currentElement.start.x, currentElement.start.y);
          ctx.lineTo(currentElement.end.x, currentElement.end.y);
          ctx.stroke();
          break;

        case 'rectangle':
          ctx.strokeRect(
            currentElement.x,
            currentElement.y,
            currentElement.width,
            currentElement.height
          );
          break;

        case 'circle':
          ctx.beginPath();
          const r = Math.sqrt(
            Math.pow(currentElement.end.x - currentElement.start.x, 2) + 
            Math.pow(currentElement.end.y - currentElement.start.y, 2)
          );
          ctx.arc(currentElement.start.x, currentElement.start.y, r, 0, 2 * Math.PI);
          ctx.stroke();
          break;

        default:
          break;
      }
    }

    ctx.restore();
  }, [currentPage, showGrid, gridSize, zoom, pan, currentElement, color, strokeWidth]);

  // Mouse down - start drawing
  const handleMouseDown = (e) => {
    if (tool === 'select') return;
    
    const pos = getCanvasCoords(e);
    setIsDrawing(true);
    setStartPos(pos);

    switch (tool) {
      case 'pen':
        setCurrentElement({
          type: 'path',
          points: [pos],
          color,
          strokeWidth,
        });
        break;

      case 'line':
      case 'circle':
        setCurrentElement({
          type: tool,
          start: pos,
          end: pos,
          color,
          strokeWidth,
        });
        break;

      case 'rectangle':
        setCurrentElement({
          type: 'rectangle',
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          color,
          strokeWidth,
        });
        break;

      case 'text':
        const text = prompt('Enter text:');
        if (text) {
          const newElement = {
            id: Date.now(),
            type: 'text',
            text,
            x: pos.x,
            y: pos.y,
            color,
            fontSize: 16,
          };
          
          const updatedPages = pages.map((p) =>
            p.id === currentPageId
              ? { ...p, elements: [...p.elements, newElement] }
              : p
          );
          setPages(updatedPages);
          addToHistory(updatedPages.find(p => p.id === currentPageId).elements);
        }
        break;

      default:
        break;
    }
  };

  // Mouse move - update drawing
  const handleMouseMove = (e) => {
    if (!isDrawing || !currentElement) return;
    
    const pos = getCanvasCoords(e);

    switch (tool) {
      case 'pen':
        setCurrentElement({
          ...currentElement,
          points: [...currentElement.points, pos],
        });
        break;

      case 'line':
      case 'circle':
        setCurrentElement({
          ...currentElement,
          end: pos,
        });
        break;

      case 'rectangle':
        setCurrentElement({
          ...currentElement,
          width: pos.x - currentElement.x,
          height: pos.y - currentElement.y,
        });
        break;

      default:
        break;
    }
  };

  // Mouse up - finish drawing
  const handleMouseUp = () => {
    if (!isDrawing || !currentElement) return;
    
    const newElement = {
      ...currentElement,
      id: Date.now(),
    };

    const updatedPages = pages.map((p) =>
      p.id === currentPageId
        ? { ...p, elements: [...p.elements, newElement] }
        : p
    );
    
    setPages(updatedPages);
    addToHistory(updatedPages.find(p => p.id === currentPageId).elements);
    
    setIsDrawing(false);
    setStartPos(null);
    setCurrentElement(null);
  };

  const getCursor = () => {
    switch (tool) {
      case 'select':
        return 'grab';
      case 'eraser':
        return 'crosshair';
      case 'text':
        return 'text';
      default:
        return 'crosshair';
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#fafafa',
      overflow: 'hidden',
    }}>
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
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      />
    </div>
  );
}