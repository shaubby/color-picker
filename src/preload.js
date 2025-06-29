// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');
var ffmpeg = require('ffmpeg');

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  getCursorPosition: () => ipcRenderer.invoke('get-cursor-position'),
  getVideoStream: () => ipcRenderer.invoke('get-video-stream', sourceId),
});
