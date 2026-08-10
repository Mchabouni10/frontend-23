import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faEraser } from '@fortawesome/free-solid-svg-icons';
import './SignaturePad.css';

export default function SignaturePad({ onSave, onCancel }) {
  const sigCanvas = useRef({});
  const [error, setError] = useState('');

  const clear = () => {
    sigCanvas.current.clear();
    setError('');
  };

  const save = () => {
    if (sigCanvas.current.isEmpty()) {
      setError('Please provide a signature first.');
      return;
    }
    const dataUrl = sigCanvas.current.getCanvas().toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="signature-modal-overlay">
      <div className="signature-modal">
        <div className="signature-header">
          <h3>Sign Estimate</h3>
          <button className="signature-close-btn" onClick={onCancel}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <div className="signature-body">
          <p>By signing below, you agree to the terms and authorize the work to begin.</p>
          <div className="signature-canvas-container">
            <SignatureCanvas 
              ref={sigCanvas}
              penColor="black"
              canvasProps={{ className: 'signature-canvas' }}
            />
          </div>
          {error && <p className="signature-error">{error}</p>}
        </div>

        <div className="signature-footer">
          <button className="signature-btn signature-btn-clear" onClick={clear}>
            <FontAwesomeIcon icon={faEraser} /> Clear
          </button>
          <button className="signature-btn signature-btn-save" onClick={save}>
            <FontAwesomeIcon icon={faSave} /> Save Signature
          </button>
        </div>
      </div>
    </div>
  );
}
