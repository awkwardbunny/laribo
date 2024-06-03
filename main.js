const { app, BrowserWindow } = require('electron')
require('@electron/remote/main').initialize();

const path = require('path')
const url = require('url')

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    icon:__dirname+'/img/app.ico',
    show: false,
    backgroundColor: '#efefef',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  mainWindow.once('ready-to-show', mainWindow.show)
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // mainWindow.on('page-title-updated',(event) => {
  //   event.preventDefault();
  // });

  // Open the DevTools.
  require('@electron/remote/main').enable(mainWindow.webContents);
  mainWindow.webContents.openDevTools()
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.commandLine.appendSwitch('--enable-viewport-meta', 'true');
