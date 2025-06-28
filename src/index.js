const { screen, app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain } = require('electron');
const path = require('node:path');

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
const pickerHeight = 50;
const pickerWidth=150;
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
  win.webContents.openDevTools();
  return win;
  
};


// create app
app.whenReady().then(() => {

  ipcMain.handle('get-pixel-color', async () => {
    try {
      const { x, y } = screen.getCursorScreenPoint();
      const imgBuffer = await screenshot({ format: 'png' });
      const img = await Jimp.read(imgBuffer);
      const pixel = img.getPixelColor(x, y);
      const { r, g, b, a } = Jimp.intToRGBA(pixel);

      const hexColor =
        '#' +
        [r, g, b]
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase();

      return { hex: hexColor, rgba: { r, g, b, a } };
    } catch (error) {
      console.error('Failed to get pixel color:', error);
      return null;
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

