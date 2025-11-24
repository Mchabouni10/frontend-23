// src/components/SketchPad/export3D.js
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';

/**
 * Convert sketch elements to a 3D GLB model
 */
export async function generate3DFromSketch(elements) {
  return new Promise((resolve, reject) => {
    try {
      const scene = new THREE.Scene();

      if (!elements || elements.length === 0) {
        reject(new Error('Canvas is empty. Please draw something first.'));
        return;
      }

      // Process each element
      elements.forEach((el) => {
        let mesh = null;

        // Scale factor: 20px = 1 unit (approx 1 foot)
        const scale = 1 / 20;

        if (el.type === 'wall' || el.type === 'line') {
          // Create wall/line
          const startX = (el.start.x - 600) * scale; // Center offset (1200/2)
          const startZ = (el.start.y - 400) * scale; // Center offset (800/2)
          const endX = (el.end.x - 600) * scale;
          const endZ = (el.end.y - 400) * scale;

          const length = Math.hypot(endX - startX, endZ - startZ);
          const height = el.type === 'wall' ? 8 : 0.1; // Wall height 8ft, line flat
          const thickness = el.type === 'wall' ? 0.5 : 0.1;

          const geometry = new THREE.BoxGeometry(length, height, thickness);
          const material = new THREE.MeshStandardMaterial({
            color: el.color || '#333333',
            metalness: 0.1,
            roughness: 0.8,
          });
          mesh = new THREE.Mesh(geometry, material);

          // Position at midpoint
          mesh.position.set((startX + endX) / 2, height / 2, (startZ + endZ) / 2);

          // Rotate to align with line
          const angle = Math.atan2(endZ - startZ, endX - startX);
          mesh.rotation.y = -angle; // Negative because Z is down in 2D but forward/back in 3D? 
          // Actually in 3D: X is right, Y is up, Z is forward (or back).
          // In 2D: X is right, Y is down.
          // Mapping: 2D X -> 3D X. 2D Y -> 3D Z.
          // Angle in 2D: atan2(dy, dx). 
          // Rotation around Y axis in 3D.

        } else if (el.type === 'rectangle') {
          // Create box
          const width = Math.abs(el.end.x - el.start.x) * scale;
          const depth = Math.abs(el.end.y - el.start.y) * scale;
          const height = 4; // Arbitrary height for rectangles (furniture?)

          const geometry = new THREE.BoxGeometry(width, height, depth);
          const material = new THREE.MeshStandardMaterial({
            color: el.color || '#3498db',
            metalness: 0.2,
            roughness: 0.7,
          });
          mesh = new THREE.Mesh(geometry, material);

          const centerX = ((el.start.x + el.end.x) / 2 - 600) * scale;
          const centerZ = ((el.start.y + el.end.y) / 2 - 400) * scale;

          mesh.position.set(centerX, height / 2, centerZ);

        } else if (el.type === 'circle') {
          // Create cylinder
          const radius = Math.hypot(el.end.x - el.start.x, el.end.y - el.start.y) * scale;
          const height = 4;

          const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
          const material = new THREE.MeshStandardMaterial({
            color: el.color || '#e74c3c',
            metalness: 0.2,
            roughness: 0.7,
          });
          mesh = new THREE.Mesh(geometry, material);

          const centerX = (el.start.x - 600) * scale;
          const centerZ = (el.start.y - 400) * scale;

          mesh.position.set(centerX, height / 2, centerZ);
          mesh.position.set(centerX, height / 2, centerZ);
        } else if (el.type === 'door') {
          // Create door
          const width = Math.abs(el.end.x - el.start.x) * scale;
          const depth = Math.abs(el.end.y - el.start.y) * scale;
          const height = 7; // Standard door height

          const geometry = new THREE.BoxGeometry(width, height, depth);
          const material = new THREE.MeshStandardMaterial({
            color: '#8B4513',
            metalness: 0.1,
            roughness: 0.6,
          });
          mesh = new THREE.Mesh(geometry, material);

          const centerX = ((el.start.x + el.end.x) / 2 - 600) * scale;
          const centerZ = ((el.start.y + el.end.y) / 2 - 400) * scale;

          mesh.position.set(centerX, height / 2, centerZ);
        } else if (el.type === 'window') {
          // Create window
          const width = Math.abs(el.end.x - el.start.x) * scale;
          const depth = Math.abs(el.end.y - el.start.y) * scale;
          const height = 4; // Window height
          const elevation = 3; // Window elevation

          const geometry = new THREE.BoxGeometry(width, height, depth);
          const material = new THREE.MeshStandardMaterial({
            color: '#87CEEB',
            metalness: 0.5,
            roughness: 0.2,
            transparent: true,
            opacity: 0.6
          });
          mesh = new THREE.Mesh(geometry, material);

          const centerX = ((el.start.x + el.end.x) / 2 - 600) * scale;
          const centerZ = ((el.start.y + el.end.y) / 2 - 400) * scale;

          mesh.position.set(centerX, elevation + height / 2, centerZ);
        } else if (el.type === 'triangle') {
          // Create triangle using shape and extrusion
          const shape = new THREE.Shape();
          const p0 = el.points[0];
          shape.moveTo((p0.x - 600) * scale, (p0.y - 400) * scale);

          for (let i = 1; i < el.points.length; i++) {
            const p = el.points[i];
            shape.lineTo((p.x - 600) * scale, (p.y - 400) * scale);
          }
          shape.lineTo((p0.x - 600) * scale, (p0.y - 400) * scale); // Close shape

          const extrudeSettings = {
            steps: 1,
            depth: 10, // Default height
            bevelEnabled: false,
          };

          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          // Rotate to lay flat on XZ plane
          geometry.rotateX(Math.PI / 2);

          const material = new THREE.MeshStandardMaterial({
            color: el.color,
            metalness: 0.1,
            roughness: 0.8,
          });
          mesh = new THREE.Mesh(geometry, material);
          // No need to set position as points are already transformed
        }

        if (mesh) {
          scene.add(mesh);
        }
      });

      // Add a floor
      const floorGeometry = new THREE.PlaneGeometry(100, 100);
      const floorMaterial = new THREE.MeshStandardMaterial({
        color: '#f0f0f0',
        side: THREE.DoubleSide,
        roughness: 1,
        metalness: 0
      });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);

      // Add lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(10, 20, 10);
      scene.add(dirLight);

      // Export to GLB
      const exporter = new GLTFExporter();
      exporter.parse(
        scene,
        (gltf) => {
          resolve(gltf);
        },
        (error) => {
          console.error('GLTF Export Error:', error);
          reject(error);
        },
        { binary: true }
      );

    } catch (error) {
      console.error('3D Generation Error:', error);
      reject(error);
    }
  });
}