import React, { useEffect, useRef, useState } from 'react';
import './app.css';

declare global {
    interface Window {
      electronAPI: {
        getSources: () => Promise<Array<{ id: string; name: string; thumbnail: Electron.NativeImage }>>;
        getCursorPosition: () => Promise<{ x: number; y: number }>;
      };
    }
}

export default function App() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [color, setColor] = useState<string>('#ffffff');
    const [cursorPos, setCursorPos] = useState({x:0, y:0})

    useEffect(() => {
        async function startCapture() {
          const sources = await window.electronAPI.getSources();
          const cursorPos = await window.electronAPI.getCursorPosition();
          if (sources.length === 0) return;
    
          const screenSource = sources[0]; // grab first screen
    
          const stream = await (navigator.mediaDevices as any).getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: screenSource.id,
                maxWidth: 3840,
                maxHeight: 2160,
                maxFrameRate: 10,
              },
            },
          });
    
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
    
            const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });
    
            const updateColor = async () => {
              if (!ctx || !videoRef.current) return;
              
              // Get current cursor position
              const currentCursorPos = await window.electronAPI.getCursorPosition();
              
              // Draw small region around center (or mouse coords)
              ctx.drawImage(videoRef.current, currentCursorPos.x-50, currentCursorPos.y-50, 100, 100);
              console.log(currentCursorPos.x, currentCursorPos.y);
              
              // Pick pixel color at center
              const imageData = ctx.getImageData(50, 50, 1, 1);
              const [r, g, b, a] = imageData.data;
    
              setColor(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
    
              requestAnimationFrame(updateColor);
            };
    
            requestAnimationFrame(updateColor);
          }
        }
    
        startCapture();
      }, []);

    return (
        <div className="w-screen h-screen">
            <img src="./bg.svg" className="w-full h-full absolute"></img>
            <img src='./color.svg' className="w-24/96 h-24/32 absolute top-1/8 left-6/96 bg-blue-500"></img>
            <div className="absolute text-white left-[40%] h-full flex items-center justify-center">
                <p className="flex-1">{color}</p>
            </div>
            {/* Hidden video and canvas */}
            <video ref={videoRef} style={{ display: 'none' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
    );
}
