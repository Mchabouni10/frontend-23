//src/components/SketchPad/FloorPlanDesigner.jsx
import React, {
  useRef,
  useEffect,
  useState,
  createContext,
  useContext,
} from "react";
import {
  Camera,
  Save,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo,
  Redo,
  Grid3x3,
  Trash2,
  Move,
  Pen,
  Square,
  Circle,
  Type,
  Minus,
  Edit3,
  DoorOpen,
  Maximize,
  Copy,
  Plus,
  Eye,
  EyeOff,
} from "lucide-react";

// Context for state management
const SketchContext = createContext(null);

const SketchProvider = ({ children }) => {
  const [pages, setPages] = useState([
    { id: 1, name: "Floor Plan 1", elements: [] },
  ]);
  const [currentPageId, setCurrentPageId] = useState(1);
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#2c3e50");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedElement, setSelectedElement] = useState(null);
  const [layers] = useState([
    { id: "walls", name: "Walls", visible: true },
    { id: "furniture", name: "Furniture", visible: true },
    { id: "annotations", name: "Annotations", visible: true },
  ]);
  const [currentLayer, setCurrentLayer] = useState("walls");

  const currentPage = pages.find((p) => p.id === currentPageId);

  const addToHistory = (elements) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...elements]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      const page = pages.find((p) => p.id === currentPageId);
      if (page) {
        page.elements = [...history[historyIndex - 1]];
        setPages([...pages]);
      }
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      const page = pages.find((p) => p.id === currentPageId);
      if (page) {
        page.elements = [...history[historyIndex + 1]];
        setPages([...pages]);
      }
    }
  };

  const clearCanvas = () => {
    if (window.confirm("Clear all elements from this page?")) {
      const updatedPages = pages.map((p) =>
        p.id === currentPageId ? { ...p, elements: [] } : p
      );
      setPages(updatedPages);
      addToHistory([]);
    }
  };

  const deleteSelected = () => {
    if (selectedElement) {
      const updatedElements = currentPage.elements.filter(
        (el) => el.id !== selectedElement.id
      );
      const updatedPages = pages.map((p) =>
        p.id === currentPageId ? { ...p, elements: updatedElements } : p
      );
      setPages(updatedPages);
      addToHistory(updatedElements);
      setSelectedElement(null);
    }
  };

  const duplicateSelected = () => {
    if (selectedElement) {
      const newElement = { ...selectedElement, id: Date.now() };
      if (newElement.start) {
        newElement.start = {
          x: newElement.start.x + 20,
          y: newElement.start.y + 20,
        };
        newElement.end = { x: newElement.end.x + 20, y: newElement.end.y + 20 };
      } else if (newElement.x !== undefined) {
        newElement.x += 20;
        newElement.y += 20;
      }
      const updatedElements = [...currentPage.elements, newElement];
      const updatedPages = pages.map((p) =>
        p.id === currentPageId ? { ...p, elements: updatedElements } : p
      );
      setPages(updatedPages);
      addToHistory(updatedElements);
      setSelectedElement(newElement);
    }
  };

  return (
    <SketchContext.Provider
      value={{
        pages,
        setPages,
        currentPageId,
        setCurrentPageId,
        currentPage,
        tool,
        setTool,
        color,
        setColor,
        strokeWidth,
        setStrokeWidth,
        showGrid,
        setShowGrid,
        gridSize,
        setGridSize,
        snapToGrid,
        setSnapToGrid,
        zoom,
        setZoom,
        pan,
        setPan,
        history,
        historyIndex,
        addToHistory,
        undo,
        redo,
        selectedElement,
        setSelectedElement,
        layers,
        currentLayer,
        setCurrentLayer,
        clearCanvas,
        deleteSelected,
        duplicateSelected,
      }}
    >
      {children}
    </SketchContext.Provider>
  );
};

const useSketch = () => {
  const context = useContext(SketchContext);
  if (!context) throw new Error("useSketch must be used within SketchProvider");
  return context;
};

// Header Component
const Header = () => {
  const { pages, currentPageId } = useSketch();

  const saveProject = () => {
    const data = { pages, timestamp: new Date().toISOString() };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
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
        const data = JSON.parse(ev.target.result);
        if (data.pages) {
          window.location.reload();
          alert("Project loaded! Please import again in the new session.");
        }
      } catch {
        alert("Invalid file");
      }
    };
    reader.readAsText(file);
  };

  const exportImage = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    tempCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `floor-plan-${currentPageId}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
        color: "white",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: "24px",
          fontWeight: "700",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <Camera size={28} />
        Floor Plan Designer Pro
      </h1>
      <div style={{ display: "flex", gap: "12px" }}>
        <button onClick={exportImage} style={headerBtnStyle}>
          <Camera size={18} />
          Export PNG
        </button>
        <button onClick={saveProject} style={headerBtnStyle}>
          <Save size={18} />
          Save Project
        </button>
        <label style={{ cursor: "pointer" }}>
          <input
            type="file"
            accept=".json"
            onChange={loadProject}
            style={{ display: "none" }}
          />
          <div style={headerBtnStyle}>
            <Download size={18} />
            Load Project
          </div>
        </label>
      </div>
    </div>
  );
};

const headerBtnStyle = {
  background: "rgba(255,255,255,0.15)",
  border: "none",
  color: "white",
  cursor: "pointer",
  padding: "10px 16px",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  fontWeight: "600",
  transition: "background 0.2s",
};

// Toolbar Component
const Toolbox = () => {
  const {
    tool,
    setTool,
    color,
    setColor,
    strokeWidth,
    setStrokeWidth,
    selectedElement,
    deleteSelected,
    duplicateSelected,
  } = useSketch();

  const tools = [
    { id: "select", icon: <Move size={20} />, label: "Select" },
    { id: "pen", icon: <Pen size={20} />, label: "Pen" },
    { id: "line", icon: <Minus size={20} />, label: "Line" },
    { id: "rectangle", icon: <Square size={20} />, label: "Rectangle" },
    { id: "circle", icon: <Circle size={20} />, label: "Circle" },
    { id: "wall", icon: <Edit3 size={20} />, label: "Wall" },
    { id: "door", icon: <DoorOpen size={20} />, label: "Door" },
    { id: "window", icon: <Maximize size={20} />, label: "Window" },
    { id: "text", icon: <Type size={20} />, label: "Text" },
  ];

  return (
    <div
      style={{
        width: "100px",
        background: "linear-gradient(180deg, #34495e 0%, #2c3e50 100%)",
        padding: "16px 12px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: "11px",
          fontWeight: "600",
          textTransform: "uppercase",
        }}
      >
        Tools
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}
      >
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            style={{
              background:
                tool === t.id
                  ? "linear-gradient(135deg, #3498db 0%, #2980b9 100%)"
                  : "transparent",
              border: "none",
              color: "white",
              cursor: "pointer",
              padding: "10px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
              boxShadow:
                tool === t.id ? "0 2px 8px rgba(52, 152, 219, 0.4)" : "none",
            }}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {selectedElement && (
        <>
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.1)",
              margin: "8px 0",
            }}
          />
          <button onClick={duplicateSelected} style={actionBtnStyle("#2ecc71")}>
            <Copy size={16} />
          </button>
          <button onClick={deleteSelected} style={actionBtnStyle("#e74c3c")}>
            <Trash2 size={16} />
          </button>
        </>
      )}

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          margin: "8px 0",
        }}
      />

      <div
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: "11px",
          fontWeight: "600",
          marginBottom: "4px",
        }}
      >
        Color
      </div>
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        style={{
          width: "100%",
          height: "36px",
          border: "2px solid rgba(255,255,255,0.2)",
          cursor: "pointer",
          borderRadius: "8px",
        }}
      />

      <div
        style={{
          color: "white",
          fontSize: "11px",
          marginTop: "12px",
          fontWeight: "600",
        }}
      >
        Width: {strokeWidth}px
        <input
          type="range"
          min="1"
          max="20"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          style={{ width: "100%", marginTop: "4px" }}
        />
      </div>
    </div>
  );
};

const actionBtnStyle = (color) => ({
  background: `rgba(${
    color === "#2ecc71" ? "46, 204, 113" : "231, 76, 60"
  }, 0.2)`,
  border: `1px solid rgba(${
    color === "#2ecc71" ? "46, 204, 113" : "231, 76, 60"
  }, 0.4)`,
  color: color,
  cursor: "pointer",
  padding: "10px",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "12px",
  fontWeight: "600",
  transition: "all 0.2s",
});

// Canvas Toolbar
const CanvasToolbar = () => {
  const {
    zoom,
    setZoom,
    setPan,
    showGrid,
    setShowGrid,
    snapToGrid,
    setSnapToGrid,
    gridSize,
    setGridSize,
    undo,
    redo,
    historyIndex,
    history,
    clearCanvas,
  } = useSketch();

  return (
    <div
      style={{
        position: "absolute",
        top: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "white",
        padding: "12px 16px",
        borderRadius: "12px",
        display: "flex",
        gap: "12px",
        alignItems: "center",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        zIndex: 10,
      }}
    >
      <button
        onClick={() => setZoom(Math.max(0.1, zoom / 1.2))}
        style={toolbarBtnStyle}
      >
        <ZoomOut size={18} />
      </button>
      <span
        style={{
          fontSize: "15px",
          minWidth: "70px",
          textAlign: "center",
          fontWeight: "600",
        }}
      >
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => setZoom(Math.min(5, zoom * 1.2))}
        style={toolbarBtnStyle}
      >
        <ZoomIn size={18} />
      </button>
      <button
        onClick={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
        style={toolbarBtnStyle}
      >
        <Maximize2 size={18} />
      </button>

      <div style={{ borderLeft: "2px solid #e0e0e0", height: "28px" }} />

      <button
        onClick={() => setShowGrid(!showGrid)}
        style={{
          ...toolbarBtnStyle,
          background: showGrid ? "#3498db" : "white",
          color: showGrid ? "white" : "#2c3e50",
        }}
      >
        <Grid3x3 size={18} />
      </button>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "13px",
          cursor: "pointer",
          fontWeight: "500",
        }}
      >
        <input
          type="checkbox"
          checked={snapToGrid}
          onChange={(e) => setSnapToGrid(e.target.checked)}
        />
        Snap
      </label>
      <select
        value={gridSize}
        onChange={(e) => setGridSize(Number(e.target.value))}
        style={selectStyle}
      >
        <option value="10">10px</option>
        <option value="20">20px</option>
        <option value="50">50px</option>
      </select>

      <div style={{ borderLeft: "2px solid #e0e0e0", height: "28px" }} />

      <button
        onClick={undo}
        disabled={historyIndex <= 0}
        style={{ ...toolbarBtnStyle, opacity: historyIndex <= 0 ? 0.3 : 1 }}
      >
        <Undo size={18} />
      </button>
      <button
        onClick={redo}
        disabled={historyIndex >= history.length - 1}
        style={{
          ...toolbarBtnStyle,
          opacity: historyIndex >= history.length - 1 ? 0.3 : 1,
        }}
      >
        <Redo size={18} />
      </button>

      <div style={{ borderLeft: "2px solid #e0e0e0", height: "28px" }} />

      <button
        onClick={clearCanvas}
        style={{ ...toolbarBtnStyle, color: "#e74c3c" }}
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
};

const toolbarBtnStyle = {
  background: "white",
  border: "none",
  cursor: "pointer",
  padding: "8px",
  borderRadius: "6px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
};

const selectStyle = {
  padding: "6px 10px",
  fontSize: "13px",
  border: "1px solid #e0e0e0",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "500",
  background: "white",
};

// Helper for feet and inches
const PIXELS_PER_FOOT = 20;

const toFeet = (pixels) => {
  const totalInches = Math.round((pixels / PIXELS_PER_FOOT) * 12);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}' ${inches}"`;
};

// Canvas Component
const Canvas = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [dragOffset, setDragOffset] = useState(null);
  const [tempElement, setTempElement] = useState(null);

  const {
    currentPage,
    showGrid,
    gridSize,
    zoom,
    pan,
    tool,
    color,
    strokeWidth,
    snapToGrid,
    pages,
    setPages,
    currentPageId,
    addToHistory,
    selectedElement,
    setSelectedElement,
    currentLayer,
  } = useSketch();

  const snapPoint = (x, y) => {
    if (!snapToGrid) return { x, y };
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize,
    };
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

    if (el.type === "text") {
      const textWidth = el.text.length * el.fontSize * 0.6;
      return (
        x >= el.x - tolerance &&
        x <= el.x + textWidth + tolerance &&
        y >= el.y - el.fontSize - tolerance &&
        y <= el.y + tolerance
      );
    }

    if (el.type === "circle") {
      const r = Math.hypot(el.end.x - el.start.x, el.end.y - el.start.y);
      const dist = Math.hypot(x - el.start.x, y - el.start.y);
      return Math.abs(dist - r) <= tolerance;
    }

    if (el.type === "rectangle" || el.type === "door" || el.type === "window") {
      const minX = Math.min(el.start.x, el.end.x);
      const maxX = Math.max(el.start.x, el.end.x);
      const minY = Math.min(el.start.y, el.end.y);
      const maxY = Math.max(el.start.y, el.end.y);
      return (
        x >= minX - tolerance &&
        x <= maxX + tolerance &&
        y >= minY - tolerance &&
        y <= maxY + tolerance
      );
    }

    if (el.type === "line" || el.type === "wall") {
      const dx = el.end.x - el.start.x;
      const dy = el.end.y - el.start.y;
      const len = Math.hypot(dx, dy);
      if (len === 0)
        return Math.hypot(x - el.start.x, y - el.start.y) <= tolerance;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((x - el.start.x) * dx + (y - el.start.y) * dy) / (len * len)
        )
      );
      const projX = el.start.x + t * dx;
      const projY = el.start.y + t * dy;
      return Math.hypot(x - projX, y - projY) <= tolerance;
    }

    if (el.type === "path") {
      return el.points.some((p) => Math.hypot(p.x - x, p.y - y) <= tolerance);
    }

    return false;
  };

  const handleMouseDown = (e) => {
    const pos = getCanvasCoords(e);
    setStartPos(pos);

    if (tool === "select") {
      const clicked = [...currentPage.elements]
        .reverse()
        .find((el) => isPointInElement(pos.x, pos.y, el));
      if (clicked) {
        setSelectedElement(clicked);
        setIsDragging(true);
        if (clicked.type === "text") {
          setDragOffset({ x: pos.x - clicked.x, y: pos.y - clicked.y });
        } else if (clicked.start) {
          setDragOffset({
            x: pos.x - clicked.start.x,
            y: pos.y - clicked.start.y,
          });
        }
      } else {
        setSelectedElement(null);
      }
      return;
    }

    if (tool === "text") {
      const text = prompt("Enter text:");
      if (text) {
        const newEl = {
          id: Date.now(),
          type: "text",
          text,
          x: pos.x,
          y: pos.y,
          color,
          fontSize: 16,
          layer: currentLayer,
        };
        const newElements = [...currentPage.elements, newEl];
        setPages(
          pages.map((p) =>
            p.id === currentPageId ? { ...p, elements: newElements } : p
          )
        );
        addToHistory(newElements);
      }
      return;
    }

    setIsDrawing(true);
  };

  const handleMouseMove = (e) => {
    const pos = getCanvasCoords(e);

    if (tool === "select" && isDragging && selectedElement) {
      const updatedElements = currentPage.elements.map((el) => {
        if (el.id === selectedElement.id) {
          if (el.type === "text") {
            return {
              ...el,
              x: pos.x - (dragOffset?.x || 0),
              y: pos.y - (dragOffset?.y || 0),
            };
          } else if (el.start && el.end) {
            const dx = pos.x - (dragOffset?.x || 0) - el.start.x;
            const dy = pos.y - (dragOffset?.y || 0) - el.start.y;
            return {
              ...el,
              start: { x: el.start.x + dx, y: el.start.y + dy },
              end: { x: el.end.x + dx, y: el.end.y + dy },
            };
          }
        }
        return el;
      });
      setPages(
        pages.map((p) =>
          p.id === currentPageId ? { ...p, elements: updatedElements } : p
        )
      );
      setSelectedElement(
        updatedElements.find((el) => el.id === selectedElement.id)
      );
      return;
    }

    if (!isDrawing || !startPos) return;

    if (tool === "pen") {
      const newEl = {
        id: Date.now(),
        type: "path",
        points: [startPos, pos],
        color,
        strokeWidth,
        layer: currentLayer,
      };
      setPages(
        pages.map((p) =>
          p.id === currentPageId
            ? { ...p, elements: [...p.elements, newEl] }
            : p
        )
      );
      setStartPos(pos);
    } else if (
      ["line", "rectangle", "circle", "wall", "door", "window"].includes(tool)
    ) {
      setTempElement({
        type: tool,
        start: startPos,
        end: pos,
        color,
        strokeWidth: tool === "wall" ? 12 : strokeWidth,
        layer: currentLayer,
      });
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
      // Auto-align vertical/horizontal for walls/lines if close
      if (["wall", "line", "window", "door"].includes(tempElement.type)) {
        const dx = Math.abs(tempElement.end.x - tempElement.start.x);
        const dy = Math.abs(tempElement.end.y - tempElement.start.y);
        if (dx < 10) tempElement.end.x = tempElement.start.x;
        if (dy < 10) tempElement.end.y = tempElement.start.y;
      }

      const newEl = { id: Date.now(), ...tempElement };
      const newElements = [...currentPage.elements, newEl];
      setPages(
        pages.map((p) =>
          p.id === currentPageId ? { ...p, elements: newElements } : p
        )
      );
      addToHistory(newElements);
      setTempElement(null);
    } else if (tool === "pen") {
      addToHistory(currentPage.elements);
    }

    setIsDrawing(false);
    setStartPos(null);
  };

  const drawMeasurement = (ctx, start, end, offset = 0) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);

    if (length < 20) return; // Don't label tiny segments

    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);

    // Ensure text is always upright
    if (Math.abs(angle) > Math.PI / 2) {
      ctx.rotate(Math.PI);
    }

    ctx.fillStyle = "#2c3e50";
    ctx.font = "bold 12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    // Draw background for text readability
    const text = toFeet(length);
    const metrics = ctx.measureText(text);
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillRect(-metrics.width / 2 - 4, -18, metrics.width + 8, 16);

    ctx.fillStyle = "#2c3e50";
    ctx.fillText(text, 0, -4);

    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw Grid
    if (showGrid) {
      // Major lines
      ctx.strokeStyle = "#dcdde1";
      ctx.lineWidth = 1 / zoom;
      const majorGrid = gridSize * 5; // 5ft lines

      // Minor grid
      ctx.beginPath();
      for (let x = 0; x < canvas.width / zoom; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height / zoom);
      }
      for (let y = 0; y < canvas.height / zoom; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width / zoom, y);
      }
      ctx.stroke();

      // Major grid
      ctx.strokeStyle = "#bdc3c7";
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      for (let x = 0; x < canvas.width / zoom; x += majorGrid) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height / zoom);
      }
      for (let y = 0; y < canvas.height / zoom; y += majorGrid) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width / zoom, y);
      }
      ctx.stroke();
    }

    const drawElement = (el, isSelected = false) => {
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = (el.strokeWidth || 2) / zoom;

      if (el.type === "path") {
        ctx.beginPath();
        el.points.forEach((p, i) =>
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
        );
        ctx.stroke();
      } else if (el.type === "line") {
        ctx.beginPath();
        ctx.moveTo(el.start.x, el.start.y);
        ctx.lineTo(el.end.x, el.end.y);
        ctx.stroke();
        drawMeasurement(ctx, el.start, el.end);
      } else if (el.type === "wall") {
        // Professional Wall Rendering (Double line with fill)
        const dx = el.end.x - el.start.x;
        const dy = el.end.y - el.start.y;
        const len = Math.hypot(dx, dy);
        const thickness = el.strokeWidth || 12;

        ctx.save();
        ctx.translate(el.start.x, el.start.y);
        ctx.rotate(Math.atan2(dy, dx));

        // Wall fill
        ctx.fillStyle = "#cfd8dc";
        ctx.fillRect(0, -thickness / 2, len, thickness);

        // Wall borders
        ctx.strokeStyle = "#546e7a";
        ctx.lineWidth = 2 / zoom;
        ctx.beginPath();
        ctx.moveTo(0, -thickness / 2);
        ctx.lineTo(len, -thickness / 2);
        ctx.moveTo(0, thickness / 2);
        ctx.lineTo(len, thickness / 2);
        ctx.stroke();

        ctx.restore();

        drawMeasurement(ctx, el.start, el.end);
      } else if (el.type === "rectangle") {
        ctx.strokeRect(
          el.start.x,
          el.start.y,
          el.end.x - el.start.x,
          el.end.y - el.start.y
        );
        // Measure width/height
        drawMeasurement(ctx, el.start, { x: el.end.x, y: el.start.y });
        drawMeasurement(ctx, el.start, { x: el.start.x, y: el.end.y });
      } else if (el.type === "circle") {
        const r = Math.hypot(el.end.x - el.start.x, el.end.y - el.start.y);
        ctx.beginPath();
        ctx.arc(el.start.x, el.start.y, r, 0, Math.PI * 2);
        ctx.stroke();
        // Measure radius
        drawMeasurement(ctx, el.start, { x: el.start.x + r, y: el.start.y });
      } else if (el.type === "text") {
        ctx.font = `${el.fontSize || 16}px Inter, sans-serif`;
        ctx.fillStyle = el.color;
        ctx.fillText(el.text, el.x, el.y);
      } else if (el.type === "door") {
        const w = el.end.x - el.start.x;
        const h = el.end.y - el.start.y;

        // Draw door arc

        ctx.beginPath();
        ctx.moveTo(el.start.x, el.start.y);
        ctx.lineTo(el.end.x, el.start.y); // Frame
        ctx.lineTo(el.end.x, el.end.y); // Frame
        ctx.lineTo(el.start.x, el.end.y); // Frame
        ctx.closePath();
        ctx.strokeStyle = "#bdc3c7"; // Frame color
        ctx.lineWidth = 1 / zoom;
        ctx.stroke();

        // Swing Arc
        ctx.beginPath();
        ctx.strokeStyle = "#e74c3c";
        ctx.lineWidth = 2 / zoom;

        // Simple representation: always arc from start towards end
        // A real robust door would need direction state, but this is a good start
        ctx.beginPath();
        if (Math.abs(w) > Math.abs(h)) {
          // Horizontal door
          ctx.arc(
            el.start.x,
            el.start.y,
            Math.abs(w),
            0,
            (Math.PI / 2) * (w > 0 ? 1 : -1),
            w < 0
          );
          ctx.moveTo(el.start.x, el.start.y);
          ctx.lineTo(el.start.x, el.start.y + Math.abs(w) * (w > 0 ? 1 : -1));
        } else {
          // Vertical door
          ctx.arc(
            el.start.x,
            el.start.y,
            Math.abs(h),
            0,
            (Math.PI / 2) * (h > 0 ? 1 : -1),
            h < 0
          );
          ctx.moveTo(el.start.x, el.start.y);
          ctx.lineTo(el.start.x + Math.abs(h) * (h > 0 ? 1 : -1), el.start.y);
        }
        ctx.stroke();
      } else if (el.type === "window") {
        const w = el.end.x - el.start.x;
        const h = el.end.y - el.start.y;

        // Window Frame
        ctx.fillStyle = "white";
        ctx.fillRect(el.start.x, el.start.y, w, h);
        ctx.strokeStyle = "#34495e";
        ctx.lineWidth = 2 / zoom;
        ctx.strokeRect(el.start.x, el.start.y, w, h);

        // Glass/Sill
        ctx.beginPath();
        ctx.lineWidth = 1 / zoom;
        if (Math.abs(w) > Math.abs(h)) {
          // Horizontal window
          ctx.moveTo(el.start.x, el.start.y + h / 2 - 2);
          ctx.lineTo(el.end.x, el.start.y + h / 2 - 2);
          ctx.moveTo(el.start.x, el.start.y + h / 2 + 2);
          ctx.lineTo(el.end.x, el.start.y + h / 2 + 2);
        } else {
          // Vertical window
          ctx.moveTo(el.start.x + w / 2 - 2, el.start.y);
          ctx.lineTo(el.start.x + w / 2 - 2, el.end.y);
          ctx.moveTo(el.start.x + w / 2 + 2, el.start.y);
          ctx.lineTo(el.start.x + w / 2 + 2, el.end.y);
        }
        ctx.stroke();
      }

      if (isSelected) {
        ctx.strokeStyle = "#3498db";
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([5 / zoom, 5 / zoom]);

        if (el.start && el.end) {
          const minX = Math.min(el.start.x, el.end.x) - 10 / zoom;
          const minY = Math.min(el.start.y, el.end.y) - 10 / zoom;
          const w = Math.abs(el.end.x - el.start.x) + 20 / zoom;
          const h = Math.abs(el.end.y - el.start.y) + 20 / zoom;
          ctx.strokeRect(minX, minY, w, h);
        }

        ctx.setLineDash([]);
      }
    };

    currentPage.elements.forEach((el) =>
      drawElement(el, selectedElement?.id === el.id)
    );

    if (tempElement) {
      drawElement(tempElement, false);
    }

    ctx.restore();
  }, [
    currentPage,
    showGrid,
    gridSize,
    zoom,
    pan,
    tempElement,
    selectedElement,
  ]);

  const getCursor = () => {
    if (tool === "select") return isDragging ? "grabbing" : "grab";
    if (tool === "text") return "text";
    return "crosshair";
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
        display: "block",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        borderRadius: "4px",
        background: "white", // Blueprint background could be nice, but stick to clean white for professional look
      }}
    />
  );
};

// Helper function to parse user input (e.g. "10", "10.5", "10' 6"") to pixels
const parseFeet = (input) => {
  if (!input) return 0;
  const str = String(input).trim();

  if (str.includes("'") || str.includes('"')) {
    const parts = str.split("'");
    const feet = parseFloat(parts[0] || 0);
    const inches = parseFloat((parts[1] || "").replace('"', "") || 0);
    return ((feet * 12 + inches) / 12) * PIXELS_PER_FOOT;
  }

  return parseFloat(str) * PIXELS_PER_FOOT; // Default to feet if just a number
};

// Sidebar Component
const Sidebar = () => {
  const {
    pages,
    setPages,
    currentPageId,
    setCurrentPageId,
    layers,
    currentLayer,
    setCurrentLayer,
    selectedElement,
    setSelectedElement,
    currentPage,
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

  const deletePage = (id) => {
    if (pages.length === 1) return;
    setPages(pages.filter((p) => p.id !== id));
    if (currentPageId === id) setCurrentPageId(pages[0].id);
  };

  const updateSelectedElement = (key, value) => {
    if (!selectedElement) return;
    const updatedElements = currentPage.elements.map((el) =>
      el.id === selectedElement.id ? { ...el, [key]: value } : el
    );
    setPages(
      pages.map((p) =>
        p.id === currentPageId ? { ...p, elements: updatedElements } : p
      )
    );
    setSelectedElement({ ...selectedElement, [key]: value });
  };

  const handleMeasurementChange = (type, value) => {
    if (!selectedElement) return;

    let newPixelValue;
    if (!isNaN(value)) {
      newPixelValue = parseFloat(value) * PIXELS_PER_FOOT;
    } else {
      newPixelValue = parseFeet(value);
    }

    if (isNaN(newPixelValue)) return;

    let updatedElement = { ...selectedElement };

    if (type === "length") {
      if (selectedElement.type === "circle") {
        const angle = Math.atan2(
          selectedElement.end.y - selectedElement.start.y,
          selectedElement.end.x - selectedElement.start.x
        );
        updatedElement.end = {
          x: selectedElement.start.x + Math.cos(angle) * newPixelValue,
          y: selectedElement.start.y + Math.sin(angle) * newPixelValue,
        };
      } else if (selectedElement.start && selectedElement.end) {
        const angle = Math.atan2(
          selectedElement.end.y - selectedElement.start.y,
          selectedElement.end.x - selectedElement.start.x
        );
        updatedElement.end = {
          x: selectedElement.start.x + Math.cos(angle) * newPixelValue,
          y: selectedElement.start.y + Math.sin(angle) * newPixelValue,
        };
      }
    } else if (type === "width") {
      if (selectedElement.start && selectedElement.end) {
        const currentHeight = Math.abs(
          selectedElement.end.y - selectedElement.start.y
        );
        updatedElement.end = {
          x: selectedElement.start.x + newPixelValue,
          y: selectedElement.start.y + currentHeight,
        };
      }
    } else if (type === "height") {
      if (selectedElement.start && selectedElement.end) {
        const currentWidth = Math.abs(
          selectedElement.end.x - selectedElement.start.x
        );
        updatedElement.end = {
          x: selectedElement.start.x + currentWidth,
          y: selectedElement.start.y + newPixelValue,
        };
      }
    }

    const updatedElements = currentPage.elements.map((el) =>
      el.id === selectedElement.id ? updatedElement : el
    );
    setPages(
      pages.map((p) =>
        p.id === currentPageId ? { ...p, elements: updatedElements } : p
      )
    );
    setSelectedElement(updatedElement);
  };

  return (
    <div
      style={{
        width: "280px",
        background: "linear-gradient(180deg, #f8f9fa 0%, #ecf0f1 100%)",
        padding: "20px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        borderLeft: "1px solid #e0e0e0",
      }}
    >
      {selectedElement ? (
        <div
          style={{
            background: "white",
            padding: "16px",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e0e0e0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "15px",
                fontWeight: "700",
                color: "#2c3e50",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Edit3 size={16} /> Properties
            </h3>
            <span
              style={{
                fontSize: "11px",
                background: "#e8ecf0",
                padding: "2px 8px",
                borderRadius: "10px",
                color: "#7f8c8d",
              }}
            >
              {selectedElement.type.toUpperCase()}
            </span>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {/* Measurements (Editable) */}
            {selectedElement.start && selectedElement.end && (
              <div
                style={{
                  background: "#f8f9fa",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0",
                }}
              >
                <label
                  style={{
                    ...labelStyle,
                    marginBottom: "8px",
                    color: "#2980b9",
                  }}
                >
                  Dimensions
                </label>

                {["line", "wall", "circle"].includes(selectedElement.type) && (
                  <div style={{ marginBottom: "8px" }}>
                    <label style={smallLabelStyle}>Length / Radius</label>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <input
                        type="text"
                        defaultValue={toFeet(
                          Math.hypot(
                            selectedElement.end.x - selectedElement.start.x,
                            selectedElement.end.y - selectedElement.start.y
                          )
                        ).replace(" ft", "")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            handleMeasurementChange(
                              "length",
                              e.currentTarget.value
                            );
                        }}
                        onBlur={(e) =>
                          handleMeasurementChange(
                            "length",
                            e.currentTarget.value
                          )
                        }
                        style={measurementInputStyle}
                      />
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#7f8c8d",
                          alignSelf: "center",
                        }}
                      >
                        ft
                      </span>
                    </div>
                  </div>
                )}

                {["rectangle", "window", "door"].includes(
                  selectedElement.type
                ) && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <label style={smallLabelStyle}>Width</label>
                      <input
                        type="text"
                        defaultValue={toFeet(
                          Math.abs(
                            selectedElement.end.x - selectedElement.start.x
                          )
                        ).replace(" ft", "")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            handleMeasurementChange(
                              "width",
                              e.currentTarget.value
                            );
                        }}
                        onBlur={(e) =>
                          handleMeasurementChange(
                            "width",
                            e.currentTarget.value
                          )
                        }
                        style={measurementInputStyle}
                      />
                    </div>
                    <div>
                      <label style={smallLabelStyle}>Height</label>
                      <input
                        type="text"
                        defaultValue={toFeet(
                          Math.abs(
                            selectedElement.end.y - selectedElement.start.y
                          )
                        ).replace(" ft", "")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            handleMeasurementChange(
                              "height",
                              e.currentTarget.value
                            );
                        }}
                        onBlur={(e) =>
                          handleMeasurementChange(
                            "height",
                            e.currentTarget.value
                          )
                        }
                        style={measurementInputStyle}
                      />
                    </div>
                  </div>
                )}
                <div
                  style={{
                    fontSize: "10px",
                    color: "#95a5a6",
                    marginTop: "4px",
                    fontStyle: "italic",
                  }}
                >
                  Type value & press Enter (e.g. 10 or 10' 6")
                </div>
              </div>
            )}

            <div>
              <label style={labelStyle}>Color</label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="color"
                  value={selectedElement.color}
                  onChange={(e) =>
                    updateSelectedElement("color", e.target.value)
                  }
                  style={{
                    width: "30px",
                    height: "30px",
                    padding: 0,
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                />
                <span style={{ fontSize: "13px", color: "#7f8c8d" }}>
                  {selectedElement.color}
                </span>
              </div>
            </div>

            {(selectedElement.type === "wall" ||
              selectedElement.type === "line" ||
              selectedElement.strokeWidth !== undefined) && (
              <div>
                <label style={labelStyle}>
                  Thickness ({selectedElement.strokeWidth}px)
                </label>
                <input
                  type="range"
                  min="1"
                  max="40"
                  value={selectedElement.strokeWidth || 1}
                  onChange={(e) =>
                    updateSelectedElement(
                      "strokeWidth",
                      parseInt(e.target.value)
                    )
                  }
                  style={{ width: "100%" }}
                />
              </div>
            )}

            {selectedElement.type === "text" && (
              <>
                <div>
                  <label style={labelStyle}>Content</label>
                  <input
                    type="text"
                    value={selectedElement.text}
                    onChange={(e) =>
                      updateSelectedElement("text", e.target.value)
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Font Size ({selectedElement.fontSize}px)
                  </label>
                  <input
                    type="range"
                    min="8"
                    max="72"
                    value={selectedElement.fontSize}
                    onChange={(e) =>
                      updateSelectedElement(
                        "fontSize",
                        parseInt(e.target.value)
                      )
                    }
                    style={{ width: "100%" }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: "20px",
            background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
            borderRadius: "12px",
            color: "white",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(52, 152, 219, 0.3)",
          }}
        >
          <h3 style={{ margin: "0 0 8px", fontSize: "18px" }}>Welcome Pro!</h3>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              opacity: 0.9,
              lineHeight: "1.5",
            }}
          >
            Select an object to edit its properties, or choose a tool to start
            drawing.
          </p>
        </div>
      )}

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: "700",
              color: "#2c3e50",
            }}
          >
            Pages
          </h3>
          <button onClick={addPage} style={addBtnStyle}>
            <Plus size={16} />
          </button>
        </div>
        {pages.map((page) => (
          <div
            key={page.id}
            style={{
              padding: "12px 16px",
              background: currentPageId === page.id ? "white" : "transparent",
              border:
                currentPageId === page.id
                  ? "1px solid #3498db"
                  : "1px solid transparent",
              color: "#2c3e50",
              borderRadius: "10px",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
              transition: "all 0.2s",
              boxShadow:
                currentPageId === page.id
                  ? "0 2px 8px rgba(52, 152, 219, 0.15)"
                  : "none",
              fontWeight: currentPageId === page.id ? "600" : "500",
            }}
            onClick={() => setCurrentPageId(page.id)}
          >
            <span style={{ fontSize: "14px" }}>{page.name}</span>
            {pages.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deletePage(page.id);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#e74c3c",
                  cursor: "pointer",
                  fontSize: "18px",
                  fontWeight: "bold",
                  padding: "0 4px",
                  opacity: 0.6,
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <div>
        <h3
          style={{
            margin: "0 0 12px",
            fontSize: "16px",
            fontWeight: "700",
            color: "#2c3e50",
          }}
        >
          Layers
        </h3>
        {layers.map((layer) => (
          <div
            key={layer.id}
            style={{
              padding: "12px 16px",
              background: currentLayer === layer.id ? "white" : "transparent",
              border:
                currentLayer === layer.id
                  ? "1px solid #2ecc71"
                  : "1px solid transparent",
              color: "#2c3e50",
              borderRadius: "10px",
              cursor: "pointer",
              marginBottom: "8px",
              transition: "all 0.2s",
              boxShadow:
                currentLayer === layer.id
                  ? "0 2px 8px rgba(46, 204, 113, 0.15)"
                  : "none",
              fontWeight: currentLayer === layer.id ? "600" : "500",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
            onClick={() => setCurrentLayer(layer.id)}
          >
            <span style={{ fontSize: "14px" }}>{layer.name}</span>
            {layer.visible ? (
              <Eye size={16} color="#27ae60" />
            ) : (
              <EyeOff size={16} color="#95a5a6" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const labelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: "600",
  color: "#7f8c8d",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const smallLabelStyle = {
  ...labelStyle,
  fontSize: "11px",
  marginBottom: "4px",
  color: "#95a5a6",
};

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #dcdde1",
  fontSize: "14px",
  color: "#2c3e50",
  outline: "none",
  transition: "border 0.2s",
};

const measurementInputStyle = {
  ...inputStyle,
  padding: "6px 8px",
  textAlign: "center",
  fontWeight: "600",
  color: "#2980b9",
};

const addBtnStyle = {
  background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
  border: "none",
  color: "white",
  cursor: "pointer",
  padding: "6px",
  borderRadius: "6px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s",
  boxShadow: "0 2px 6px rgba(52, 152, 219, 0.2)",
};

// Main App
const App = () => {
  return (
    <SketchProvider>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <Header />
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <Toolbox />
          <div
            style={{
              flex: 1,
              position: "relative",
              overflow: "hidden",
              background: "#fafbfc",
            }}
          >
            <CanvasToolbar />
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "80px 20px 20px",
              }}
            >
              <Canvas />
            </div>
          </div>
          <Sidebar />
        </div>
      </div>
    </SketchProvider>
  );
};

export default App;
