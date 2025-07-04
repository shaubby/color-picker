import React, { useEffect, useRef, useState } from 'react';
import './app.css';

declare global {
  interface Window {
    electronAPI: {
      getSources: () => Promise<Array<{ id: string; name: string; thumbnail: Electron.NativeImage }>>;
      getCursorPosition: () => Promise<{ x: number; y: number }>;
      getGlobalEnter: () => Promise<boolean>;
      startFfmpegCapture: () => Promise<{ file: string; width: number; height: number }>;
      captureScreenImage: (region?: { x: number; y: number; width: number; height: number }) => Promise<Buffer>;
      closeWindow: () => void;
    };
  }
}
function invertColor(hex) {
  if (hex.indexOf('#') === 0) {
    hex = hex.slice(1);
  }
  // Convert hex to RGB
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);              

  // Invert RGB values
  r = 255 - r;
  g = 255 - g;
  b = 255 - b;

  // Convert back to hex
  const toHex = (c) => {
    const hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return "#" + toHex(r) + toHex(g) + toHex(b);
}
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState<string>('#ffffff');
  const [isMouseMoving, setIsMouseMoving] = useState<boolean>(false);
  const [enterPressed, setEnterPressed] = useState<boolean>(false);
  const prevPositionRef = useRef<{ x: number; y: number } | null>(null);
  const stillTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMovingRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout;

    async function updateColorFromScreenshot() {
      const { x, y } = await window.electronAPI.getCursorPosition();
      
      const enterKeyPressed = await window.electronAPI.getGlobalEnter();
      if (enterKeyPressed) {
        setEnterPressed(true);
        clearInterval(intervalId);
      }
      // Check if mouse is moving
      if (prevPositionRef.current) {
        const prevPos = prevPositionRef.current;
        const distance = Math.sqrt((x - prevPos.x) ** 2 + (y - prevPos.y) ** 2);
        const isMoving = distance > 0;
        
        if (isMoving) {
          console.log('Mouse moving, distance:', distance);
          setIsMouseMoving(true);
          isMovingRef.current = true;
          // Clear any existing timeout
          if (stillTimeoutRef.current) {
            clearTimeout(stillTimeoutRef.current);
            stillTimeoutRef.current = null;
          }
        } else {

          // Set a timeout to mark as still after 1 second
          if (!stillTimeoutRef.current) {

            stillTimeoutRef.current = setTimeout(() => {

              setIsMouseMoving(false);
              isMovingRef.current = false;
            }, 10);
          }
        }
      }
      
      // Update previous position for next comparison
      prevPositionRef.current = { x, y };
      
      if (!isMovingRef.current) {
        try {
          // Get cursor position
          const { x, y } = await window.electronAPI.getCursorPosition();
          
          // Check if mouse is moving
          if (prevPositionRef.current) {
            const prevPos = prevPositionRef.current;
            const distance = Math.sqrt((x - prevPos.x) ** 2 + (y - prevPos.y) ** 2);
            setIsMouseMoving(distance > 0);
          }
          prevPositionRef.current = { x, y };
          
          // Define region size
          const regionSize = 20;
          const region = {
            x: Math.max(0, x - Math.floor(regionSize / 2)),
            y: Math.max(0, y - Math.floor(regionSize / 2)),
            width: regionSize,
            height: regionSize
          };
          // Get screenshot buffer (PNG) of region
          const buffer = await window.electronAPI.captureScreenImage(region);
          if (!buffer || !isMounted) return;

          // Create an image from the buffer
          const blob = new Blob([buffer], { type: 'image/png' });
          const url = URL.createObjectURL(blob);
          const img = new window.Image();
          img.src = url;
          img.onload = async () => {
            if (!canvasRef.current) return;
            const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;

            // Resize canvas to match image
            canvasRef.current.width = img.width;
            canvasRef.current.height = img.height;
            ctx.drawImage(img, 0, 0);

            
            const centerX = Math.floor(img.width / 2);
            const centerY = Math.floor(img.height / 2);

            // Get color at center pixel
            const imageData = ctx.getImageData(centerX, centerY, 1, 1);
            const [r, g, b] = imageData.data;
            setColor(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
            // Draw a red square around the center pixel
            ctx.fillStyle = invertColor(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
            ctx.fillRect(centerX-1, centerY-1, 1, 1);
            
            ctx.fillRect(centerX-1, centerY+1, 1, 1);
            ctx.fillRect(centerX+1, centerY+1, 1, 1);
            ctx.fillRect(centerX+1, centerY-1, 1, 1);
            ctx.fillRect(centerX-1, centerY, 1, 1);
            ctx.fillRect(centerX, centerY+1, 1, 1);
            ctx.fillRect(centerX+1, centerY, 1, 1);
            ctx.fillRect(centerX, centerY-1, 1, 1);
            URL.revokeObjectURL(url);
          };
        } catch (error) {
          console.error('Failed to capture screen image:', error);
        }
      }
    }

    // Poll every 100ms
    intervalId = setInterval(updateColorFromScreenshot, 50);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      if (stillTimeoutRef.current) {
        clearTimeout(stillTimeoutRef.current);
      }
    };
  }, []);

  const colorPicker = () => {
    return (
      <div>
      <canvas
        ref={canvasRef}
        className="w-full border-1 border-white bg-black z-10"
        style={{ imageRendering: 'pixelated' }}
      />

        <div className='w-full text-white text-center'>
          {color}
        </div>
        <div className={' p-1 flex items-center justify-center'}>
          <div
            className="w-full h-3 border-1 border-white"
            style={{ backgroundColor: color }}
          ></div>
        </div>
        </div>
    );
  }
  const menu = () => {
    return (
      <div className='w-full h-full flex flex-col items-center justify-center'>
        
        
        <canvas
          ref={canvasRef}
          className="w-1/2 border-1 border-white bg-black z-10"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
    )
  }

  return (
    
    <div className="h-screen bg-black border">
      
      {enterPressed ? (menu()) : (colorPicker()) }
      
  
    </div>
  );
}
