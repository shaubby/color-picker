const { app, BrowserWindow, ipcMain, screen, Tray, Menu, globalShortcut, dialog, shell } = require('electron');
const path = require('node:path');
const { spawn } = require('child_process');

const getColor = require('./getcolor.js');
const screenshot = require('screenshot-desktop');
const Jimp = require('jimp');
const { loadConfig, saveConfig, getConfigPath } = require('./config.js');
const AutoLaunch = require('auto-launch');

let globalClickDetected = false;
let followInterval = null;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}
let tray = null;
let window = null;
let window2 = null;

const offsetX = -100;
const offsetY = -100;
const pickerHeight = 200;
const pickerWidth=200;
const menuHeight = 230;
const menuWidth=460;
let color = '#ffffff';
let config = loadConfig({shortcut: 'Control+Shift+B', autoLaunch: true});
let shortcut = config.shortcut;

// follow window
const followMouse = () => {
  const {x, y} = screen.getCursorScreenPoint();

  if(window && !window.isDestroyed()){
    window.setBounds({
      x: x+offsetX,
      y: y+offsetY,
      width: pickerWidth,
      height: pickerHeight,
    })
  }
}
const createWindow2 = () => {
  const win = new BrowserWindow({
    width: 400,
    height: 200,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
    resizable: true,
    hasShadow: true,
    alwaysOnTop: true,
  });
  
  win.loadFile(path.join(__dirname, 'info.html'));
  win.focus();
  win.on("close", (event) => {
    win.hide();
  })
  win.on("closed", (event) => {
    window2 = null; // prevent future access to a dead window
  });
  win.webContents.on('console-message', (event, level, message) => {
    console.log(`Renderer: ${message}`);
  });
  return win;
}
// create the window
const createWindow = () => {
  const win = new BrowserWindow({
    width: pickerWidth,
    height: pickerHeight,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: true,
    transparent: true,
  });
  followInterval = setInterval(followMouse, 10);

  win.loadFile(path.join(__dirname,'dist', 'index.html'));
  win.focus();
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

  let autoLaunch = new AutoLaunch({
    name: 'Color Picker',
    path: app.getPath('exe'),
  });
  if(config.autoLaunch == false) {
    autoLaunch.isEnabled().then((isEnabled) => {
      if (isEnabled) {
        autoLaunch.disable();
      }
    });
  } else if(config.autoLaunch == true) {
    autoLaunch.isEnabled().then((isEnabled) => {
      if (!isEnabled) {
        autoLaunch.enable();
      }
    });
  }
  // Add IPC handler for cursor position
  ipcMain.handle('get-cursor-position', () => {
    return screen.getCursorScreenPoint();
  });
  ipcMain.on('close-window', () => {
    if (window) window.close();
  });
  ipcMain.on('resize-window', () => {
    if (window) {
      window.setBounds({
        width: menuWidth,
        height: menuHeight,
      });
      window.center();
      if(followInterval) {
        clearInterval(followInterval);
      }
    }
  });


  // #region handling
    // Add IPC handler for screen sources with cursor exclusion
    ipcMain.handle('get-sources', async () => {
      const { desktopCapturer } = require('electron');
      return await desktopCapturer.getSources({ 
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false
      });
    });

    // Add IPC handler for still image capture without cursor
    ipcMain.handle('capture-screen-image', async (event, { x, y, width, height }) => {
      const { desktopCapturer, screen, nativeImage } = require('electron');
      const display = screen.getPrimaryDisplay();
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: display.size.width, height: display.size.height },
        fetchWindowIcons: false
      });
      if (sources.length > 0) {
        let image = sources[0].thumbnail;
        // Crop to region if parameters provided
        if (typeof x === 'number' && typeof y === 'number' && typeof width === 'number' && typeof height === 'number') {
          image = image.crop({ x, y, width, height });
        }
        return image.toPNG();
      }
      return null;
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
  // #endregion handling 
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
    },
    {
      label: 'Settings',
      click: () => {
        if(!window2 || window2.isDestroyed()) {
          window2 = createWindow2();
        }
        shell.openExternal(getConfigPath())
        window2.show();
        window2.focus();

      },
    }
  ]);
  tray.setContextMenu(contextMenu);

  if (typeof shortcut === 'string' && shortcut.trim().length > 0) {
    globalShortcut.register(shortcut, () => {
      if (!window || window.isDestroyed()) {
        window = createWindow();
      }
      window.show();
      window.focus();
    });
  } else {
    console.error('Invalid shortcut in config:', shortcut);
  }
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (!window){
      window=createWindow();
      window.show(); 
      window.focus();
    }
  });

  // Add IPC handler for global click detection


  
  
  // Set up global Enter key detection
  // Register Enter key as global shortcut

  // Clean up shortcuts when app closes
  app.on('before-quit', () => {
    globalShortcut.unregisterAll();
  });

});



// Cross-platform handling of window-all-closed:
app.on('window-all-closed', (event) => {
  event.preventDefault();
});

