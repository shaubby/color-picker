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
      openWindow: () => void;
      resizeWindow: () => void;
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
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  // Remove '#' if present
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(x => x + x).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, v = max;

  const d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max === min) {
    h = 0;
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100)
  };
}
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState<string>('#ffffff');
  const [rgb, setRGB] = useState<{ r: number; g: number; b: number }>({ r: 0, g: 0, b: 0 });
  const [colorBg, setColorBg] = useState<string>('bg-black');
  const [rbgBg, setRgbBg] = useState<string>('bg-black');
  const [hsvBg, sethsvBg] = useState<string>('bg-black');
  const [copyText, setCopyText] = useState<string>('');
  const [show, setShow] = useState<boolean>(false);
  const [picker, setPicker] = useState<boolean>(true);

  const escFunction = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      window.electronAPI.closeWindow();
    }
  };

  async function updateColorFromScreenshot(isMounted) {
    try {
      // Get cursor position
      const { x, y } = await window.electronAPI.getCursorPosition();

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
        setRGB({ r, g, b });
        setColor(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
        setShow(true);
        URL.revokeObjectURL(url);
        //window.electronAPI.openWindow()
      };
    } catch (error) {
      console.error('Failed to capture screen image:', error);
    }

  }

  useEffect(() => {
    document.addEventListener("keydown", escFunction, false);
    let isMounted = true;

    // Poll every 100ms
    //intervalId = setInterval(updateColorFromScreenshot, 100);
    //updateColorFromScreenshot(isMounted);


    return () => {
      isMounted = false;
    };
  }, []);

  // #region Click Handling && old color picker
  const handleColorClick = async () => {
    await navigator.clipboard.writeText(color);
    setCopyText('Copied to Clipboard!');
    setTimeout(() => {
      setCopyText('');
    }, 2000);
  }
  const handleRgbClick = async () => {
    await navigator.clipboard.writeText('rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')');
    setCopyText('Copied to Clipboard!');
    setTimeout(() => {
      setCopyText('');
    }, 2000);
  }
  const handleHsvClick = async () => {
    let hsv = hexToHsv(color);
    await navigator.clipboard.writeText('hsv(' + hsv.h + ', ' + hsv.s + ', ' + hsv.v + ')');
    setCopyText('Copied to Clipboard!');
    setTimeout(() => {
      setCopyText('');
    }, 2000);
  }

  const colorPicker = () => {
    return (
      <div>
        <canvas
          ref={canvasRef}
          className="cursor-pointer w-full border-1 border-white bg-black z-10"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* <div className='w-full text-white text-center'>
          {color}
        </div>
        <div className={' p-1 flex items-center justify-center'}>
          <div
            className="w-full h-3 border-1 border-white"
            style={{ backgroundColor: color }}
          ></div>
        </div> */}
      </div>
    );
  }
  //#endregion

  const colorPicker2 = () => {
    const handleClick = () => {
      window.electronAPI.resizeWindow();
      updateColorFromScreenshot(true);
      setPicker(false);
      console.log('Clicked on color picker');
    }
    return (<div className='w-screen h-screen ' style={{ cursor: 'crosshair' }} onClick={handleClick}></div>);
  };

  const menu = () => {
    // Handler for canvas click
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
      const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const imageData = ctx.getImageData(x, y, 1, 1);
      const [r, g, b] = imageData.data;
      setRGB({ r, g, b });
      setColor(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
    };
    return (
      <div className="bg-black border" style={{ display: show ? 'block' : 'none', position: 'relative' }}>
        {/* X button at the top right */}
          
        <div className='drag-region  w-full h-full flex flex-row p-2 border-white border-2 items-center justify-center'>
          
          <canvas 
            ref={canvasRef}
            className="flex-1 no-drag border-1 border-white bg-black z-10"
            style={{ imageRendering: 'pixelated', cursor: 'crosshair' }}
            onClick={handleCanvasClick}
          />
          <div className='drag-region flex-1 flex flex-col gap-1 items-center justify-center text-white text-lg p-2'>
            <div onClick={handleColorClick} className={'no-drag cursor-pointer text-center border-1 border-white p-1 w-full select-none ' + colorBg} onMouseEnter={() => setColorBg('bg-gray-900')} onMouseLeave={() => setColorBg('bg-black')}>{color.toUpperCase()}</div>
            <div onClick={handleRgbClick} className={'no-drag cursor-pointer text-center border-1 border-white p-1 w-full select-none ' + rbgBg} onMouseEnter={() => setRgbBg('bg-gray-900')} onMouseLeave={() => setRgbBg('bg-black')}>{'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')'}</div>
            <div onClick={handleHsvClick} className={'no-drag cursor-pointer text-center border-1 border-white p-1 w-full select-none ' + hsvBg} onMouseEnter={() => sethsvBg('bg-gray-900')} onMouseLeave={() => sethsvBg('bg-black')}>{'hsv(' + hexToHsv(color).h + ', ' + hexToHsv(color).s + ', ' + hexToHsv(color).v + ')'}</div>
            <div className='text-center border-1 border-white p-3 w-full' style={{ backgroundColor: color }}></div>
            <div className='text-center text-sm select-none'>{copyText}</div>
          </div>

          <div
            onClick={() => {window.electronAPI.closeWindow(); }}
            className="no-drag relative select-none cursor-pointer w-8 h-full bg-red-500 border border-white text-white flex items-center justify-center text-lg z-20 relative"
          >
            x
          </div>
        </div>
      </div>
    )
  }

  return (
    picker ? colorPicker2() : menu()
  );
}
