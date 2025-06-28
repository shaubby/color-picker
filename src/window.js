const createWindow = () => {
  // Create the browser window.
  const win = new BrowserWindow({
    width: pickerHeight,
    height: pickerWidth,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const followInterval = setInterval(followMouse, 10);

  // and load the index.html of the app.
  win.loadFile(path.join(__dirname, 'index.html'));

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
  return win;
  //mainWindow.webContents.openDevTools();
};


const followMouse = () => {
  const {x, y} = screen.getCursorScreenPoint();

  if(window && !window.isDestroyed() && window.isVisible()){
    window.setBounds({
      x: x+offsetX,
      y: y+offsetY,
      width: pickerWidth,
      height: pickerHeight,
    })
  }
}


export {
    createWindow
}
