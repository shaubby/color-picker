const { screen, app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain } = require('electron');
const path = require('node:path');
const { spawn } = require('child_process');

const getColor = require('./getcolor.js');
const screenshot = require('screenshot-desktop');
const Jimp = require('jimp');


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let tray = null;
let window = null;

const offsetX = 10;
const offsetY = 5;
const pickerHeight = 300;
const pickerWidth=300;
let color = '#ffffff';

// follow window
const followMouse = () => {
  const {x, y} = screen.getCursorScreenPoint();

  if(window && !window.isDestroyed() && window.isVisible()){
    window.setBounds({
      x: x+offsetX,
      y: y+offsetY,
      width: pickerWidth,
      height: pickerHeight,
    })
    window.focus()
  }
}

// create the window
const createWindow = () => {
  const win = new BrowserWindow({
    width: pickerHeight,
    height: pickerWidth,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
    frame: false,
    alwaysOnTop: true,
    skipTaskbar:true,
    resizable:false,
    hasShadow: false,
    transparent: true,
  });
  const followInterval = setInterval(followMouse, 10);

  win.loadFile(path.join(__dirname,'dist', 'index.html'));
  
  win.on("close", (event) => {
    if(followInterval) {
      clearInterval(followInterval);
    }
    win.hide();
  })
  win.on("closed", (event) => {
    if(followInterval) {
      clearInterval(followInterval);
    }
    window = null; // prevent future access to a dead window
  });
  win.webContents.on('console-message', (event, level, message) => {
    console.log(`Renderer: ${message}`);
  });
  //win.webContents.openDevTools();
  return win;
  
};


// create app
app.whenReady().then(() => {
  // Add IPC handler for cursor position
  ipcMain.handle('get-cursor-position', () => {
    return screen.getCursorScreenPoint();
  });

  // Add IPC handler for screen sources with cursor exclusion
  ipcMain.handle('get-sources', async () => {
    const { desktopCapturer } = require('electron');
    return await desktopCapturer.getSources({ 
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: false
    });
  });

  // Add IPC handler for screen capture without cursor using different method
  ipcMain.handle('get-screen-without-cursor', async () => {
    const { desktopCapturer } = require('electron');
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: false
    });
    
    if (sources.length > 0) {
      return sources[0];
    }
    return null;
  });

  // Add IPC handler for ffmpeg screen capture without cursor
  ipcMain.handle('start-ffmpeg-capture', async () => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const tempDir = path.join(app.getPath('temp'), 'screen-capture');
    const tempFile = path.join(tempDir, 'screen-stream.mp4');
    
    // Create temp directory if it doesn't exist
    const fs = require('fs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    console.log('Starting ffmpeg video stream with file:', tempFile);
    
    // Try different ffmpeg input formats for Windows
    const inputFormats = [
      ['-f', 'gdigrab', '-framerate', '30', '-video_size', `${width}x${height}`, '-i', 'desktop'],
      ['-f', 'dshow', '-i', 'video=screen-capture-recorder', '-framerate', '30'],
      ['-f', 'gdigrab', '-i', 'desktop', '-framerate', '30', '-video_size', `${width}x${height}`]
    ];
    
    for (let i = 0; i < inputFormats.length; i++) {
      try {
        console.log(`Trying ffmpeg format ${i + 1}:`, inputFormats[i]);
        
        return await new Promise((resolve, reject) => {
          const ffmpegArgs = [
            ...inputFormats[i],
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '23',
            '-tune', 'zerolatency',
            '-f', 'mp4',
            '-movflags', 'frag_keyframe+empty_moov',
            '-y',
            tempFile
          ];
          
          console.log('FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));
          
          const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
          
          ffmpegProcess.stdout.on('data', (data) => {
            console.log('FFmpeg stdout:', data.toString());
          });
          
          ffmpegProcess.stderr.on('data', (data) => {
            const output = data.toString();
            console.log('FFmpeg stderr:', output);
            
            // Check if ffmpeg has started encoding frames
            if (output.includes('frame=') && output.includes('fps=')) {
              // Wait a bit more to ensure file is created and has content
              setTimeout(() => {
                console.log('FFmpeg video stream started successfully');
                resolve({
                  file: tempFile,
                  width: width,
                  height: height,
                  process: ffmpegProcess
                });
              }, 2000); // Wait 2 seconds after first frame
            }
          });
          
          ffmpegProcess.on('close', (code) => {
            console.log(`FFmpeg process exited with code ${code}`);
          });
          
          ffmpegProcess.on('error', (err) => {
            console.error('FFmpeg error:', err);
            if (i === inputFormats.length - 1) {
              reject(err);
            }
          });
          
          // Timeout after 10 seconds if no frames are produced
          setTimeout(() => {
            if (!ffmpegProcess.killed) {
              console.log('FFmpeg timeout, killing process');
              ffmpegProcess.kill();
              if (i === inputFormats.length - 1) {
                reject(new Error('FFmpeg timeout'));
              }
            }
          }, 10000);
        });
      } catch (error) {
        console.error(`Format ${i + 1} failed:`, error);
        if (i === inputFormats.length - 1) {
          throw error;
        }
      }
    }
  });

  tray = new Tray(path.join(__dirname, 'icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
    {
      label: 'Open',
      click: () => {
        if(!window || window.isDestroyed()) {
          window = createWindow();
        }
        window.show();
        window.focus();
      },
    }
  ]);
  tray.setContextMenu(contextMenu);

  globalShortcut.register('Control+Shift+B', () =>{
    if(!window || window.isDestroyed()) {
      window = createWindow();
    }
    window.show();
    window.focus();
  })
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (!window){
      window=createWindow();
    }
  });
});



// Cross-platform handling of window-all-closed:
app.on('window-all-closed', (event) => {
  event.preventDefault();
});

