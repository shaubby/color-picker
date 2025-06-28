import React, { useEffect, useRef, useState } from 'react';
import './app.css';

declare global {
    interface Window {
        electronAPI: {
            getPixelColor: () => Promise<{ hex: string; rgba: { r: number; g: number; b: number; a: number } } | null>;
        }
    }
}
export default function App() {
    const [color, setColor] = useState<string>('#FFFFFF');

    useEffect(() => {
        const interval = setInterval(async () => {
            const result = await window.electronAPI.getPixelColor();
            if (result && result.hex) {
                setColor(result.hex);
            }
        }, 50); // poll every 250ms, adjust as needed

        return () => clearInterval(interval);
    }, []);



    return (
        <div className="w-screen h-screen">
            <img src="./bg.svg" className="w-full h-full absolute"></img>
            <img src='./color.svg' className="w-24/96 h-24/32 absolute top-1/8 left-6/96 bg-blue-500"></img>
            <div className="absolute text-white left-[40%] h-full flex items-center justify-center">
                <p className="flex-1">{color}</p>
            </div>
        </div>
    );
}