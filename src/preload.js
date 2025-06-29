// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  getCursorPosition: () => ipcRenderer.invoke('get-cursor-position'),
  startFfmpegCapture: () => ipcRenderer.invoke('start-ffmpeg-capture'),
});
