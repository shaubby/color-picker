import React from "react";
import './app.css';
export default function App() {
    console.log("yay");
    return (
        <div className="w-screen h-screen">
            <img src="./bg.svg" className="w-full h-full absolute"></img>
            <img src='./color.svg' className="w-24/96 h-24/32 absolute top-1/8 left-6/96 bg-blue-500"></img>
            <div className="absolute text-white left-[40%] h-full flex items-center justify-center">
                <p className="flex-1">ioer</p>
            </div>
        </div>
    );
}