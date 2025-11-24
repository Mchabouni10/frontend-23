// src/components/SketchPage/SketchPage.jsx
import React, { useState } from 'react';
import { SketchProvider, useSketch } from '../../context/SketchContext';
import { SketchPadContent } from '../SketchPad/SketchPad';
import ThreeJSViewer from '../ThreeJSViewer/ThreeJSViewer';
import styles from './SketchPage.module.css';

const SketchPageContent = () => {
  const [activeTab, setActiveTab] = useState('2d');
  const { generate3D } = useSketch();

  const handleTabChange = async (tab) => {
    if (tab === '3d') {
      await generate3D();
    }
    setActiveTab(tab);
  };

  return (
    <div className={styles.sketchPage}>
      <header className={styles.header}>
        <h1>Floor Plan Designer</h1>
        <div className={styles.tabs}>
          <button 
            className={`${styles.tabBtn} ${activeTab === '2d' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('2d')}
          >
            2D Sketch
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === '3d' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('3d')}
          >
            3D Preview
          </button>
        </div>
      </header>

      <main className={styles.content}>
        {activeTab === '2d' ? (
          <SketchPadContent />
        ) : (
          <ThreeJSViewer />
        )}
      </main>
    </div>
  );
};

export default function SketchPage() {
  return (
    <SketchProvider>
      <SketchPageContent />
    </SketchProvider>
  );
}