import React, { useEffect, useRef, useState } from 'react';
import './app.css';

declare global {
  interface Window {
    electronAPI: {
      getSources: () => Promise<Array<{ id: string; name: string; thumbnail: Electron.NativeImage }>>;
      getCursorPosition: () => Promise<{ x: number; y: number }>;
      startFfmpegCapture: () => Promise<{ file: string; width: number; height: number }>;
    };
  }
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState<string>('#ffffff');
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    async function startCapture() {
      try {
        // Start ffmpeg video stream capture without cursor
        const { file: videoFile, width, height } = await window.electronAPI.startFfmpegCapture();
        
        console.log('FFmpeg video stream started, loading video file:', videoFile);
        
        if (videoRef.current) {
          // Set the video source to the ffmpeg output file
          videoRef.current.src = `file://${videoFile}`;
          videoRef.current.play();

          const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });

          // Set canvas size to small region
          if (canvasRef.current) {
            canvasRef.current.width = 100;
            canvasRef.current.height = 100;
          }

          const updateColor = async () => {
            if (!ctx || !videoRef.current) return;

            // Get current cursor position
            const currentCursorPos = await window.electronAPI.getCursorPosition();

            // Draw small region around cursor position
            ctx.drawImage(videoRef.current, currentCursorPos.x - 5, currentCursorPos.y - 5, 10, 10, 0, 0, 100, 100);

            // Pick pixel color at center of the canvas
            const imageData = ctx.getImageData(50, 50, 1, 1);
            const [r, g, b, a] = imageData.data;
            const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            setColor(color);

            requestAnimationFrame(updateColor);
          };

          requestAnimationFrame(updateColor);
        }
      } catch (error) {
        console.error('FFmpeg capture failed, falling back to desktopCapturer:', error);
        // Fallback to original method
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
              maxWidth: 2560,
              maxHeight: 1440,
              maxFrameRate: 10,
            },
          },
        });

        const videoRef = document.createElement('video');
        videoRef.srcObject = stream;
        videoRef.play();

        const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });

        // Set canvas size to small region
        if (canvasRef.current) {
          canvasRef.current.width = 100;
          canvasRef.current.height = 100;
        }

        const updateColor = async () => {
          if (!ctx || !videoRef) return;
          
          // Get current cursor position
          const currentCursorPos = await window.electronAPI.getCursorPosition();
          
          // Draw small region around cursor position
          ctx.drawImage(videoRef, currentCursorPos.x - 5, currentCursorPos.y - 5, 10, 10, 0, 0, 100, 100);
          
          // Pick pixel color at center of the canvas
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
      <div className="absolute text-white left-[40%] h-full flex items-center justify-center">
        <p className="flex-1">{color}</p>
      </div>
      {/* Hidden video and canvas */}
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ width: '150px', height: '150px', border: '1px solid black' }} />
    </div>
  );
}
