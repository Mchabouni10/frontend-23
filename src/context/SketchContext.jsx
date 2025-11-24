// src/context/SketchContext.jsx
import React, { createContext, useContext, useState, useRef } from 'react';

export const SketchContext = createContext();

export const SketchProvider = ({ children }) => {
  const [sketchJson, setSketchJson] = useState(null);   // Fabric JSON
  const [sketchPng, setSketchPng] = useState(null);     // dataURL
  const [modelGlb, setModelGlb] = useState(null);       // ArrayBuffer
  const canvasRef = useRef(null);

  const updateSketch = (json, png) => {
    setSketchJson(json);
    setSketchPng(png);
  };

  const updateModel = (glb) => setModelGlb(glb);

  const reset = () => {
    setSketchJson(null);
    setSketchPng(null);
    setModelGlb(null);
  };

  return (
    <SketchContext.Provider
      value={{
        sketchJson,
        sketchPng,
        modelGlb,
        canvasRef,
        updateSketch,
        updateModel,
        reset,
      }}
    >
      {children}
    </SketchContext.Provider>
  );
};

export const useSketch = () => {
  const ctx = useContext(SketchContext);
  if (!ctx) throw new Error('useSketch must be used within SketchProvider');
  return ctx;
};