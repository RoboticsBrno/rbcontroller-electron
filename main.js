// Modules to control application life and create native browser window
const {app, BrowserWindow, Menu, dialog, protocol} = require('electron')
const path = require('path')
const Store = require('electron-store');
const fs = require('fs');
const { execFileSync } = require('child_process');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-software-rasterizer");

const JS_OVERRIDES = [ "nipplejs.min.js", "reconnecting-websocket.min.js" ]
const STORAGE_LOCAL_RES_PATH = "localres.path"
const STORAGE_LOCAL_RES_ENABLED = "localres.enabled"

const store = new Store();

let gLocalResPath = store.get(STORAGE_LOCAL_RES_PATH, "")
let gLocalResEnabled = store.get(STORAGE_LOCAL_RES_ENABLED, false)
let gLocalResOrigin = null

function requestFilter(details) {
  const url = new URL(details.url)

  if(url.pathname.startsWith("/extra/") || url.pathname.endsWith("/layout.json")) {
    return {}
  }

  const res = {
    cancel: false,
  };

  if(url.host.indexOf("cloudflare") !== -1 && url.pathname.endsWith(".min.js")) {
    const suffix = JS_OVERRIDES.find(suffix => url.pathname.endsWith(suffix))
    if(suffix !== undefined) {
      let redir = "file://";
      if(!__dirname.endsWith(".asar")) {
        redir += __dirname + "/bundled/" + suffix;
      } else {
        redir += process.resourcesPath + "/bundled/" + suffix;
      }
      res.redirectURL = redir;
    }
  } else if(gLocalResEnabled && url.pathname.indexOf("..") == -1) {
    const localPath = path.join(gLocalResPath, "data", url.pathname)
    try {
      fs.accessSync(localPath, fs.constants.R_OK)
      res.redirectURL = "gridui://" + localPath + "?original=" + encodeURIComponent(details.url)
      gLocalResOrigin = url.origin
    } catch(e) {
      
    }
  }

  return res
}


function generateLocalResAmalgamations() {
  if(!gLocalResEnabled) {
    return
  }

  const genPath = path.join(gLocalResPath, "post_extra_script.py")
  try {
    fs.accessSync(genPath, fs.constants.R_OK)
  } catch (e) {
    console.error("Can't access " + genPath, e)
    return
  }

  try {
    var res = execFileSync("python3", [ "post_extra_script.py", "generate" ], { cwd: gLocalResPath, timeout: 10000 })
    console.log("Local res amalgamations regenerated", res.toString())
  } catch(e) {
    console.error("Failed to run " + genPath, e)
    return
  }
}

function checkGridUIFolder(gridUiRoot) {
  const checkSubPath = function(sub, dir) {
    try {
      const stat = fs.statSync(path.join(gridUiRoot, sub))
      if(dir && !stat.isDirectory()) {
        return sub + " is not a directory"
      } else if(!dir && !stat.isFile()) {
        return sub + " is not a file"
      }
    } catch(e) {
      return "failed to stat " + sub + " " + e.toString()
    }
    return null
  }

  var err = checkSubPath("platformio.ini", false)
  if(err !== null) return err

  err = checkSubPath("post_extra_script.py", false)
  if(err !== null) return err

  err = checkSubPath("src", true)
  if(err !== null) return err

  err = checkSubPath("web", true)
  if(err !== null) return err

  err = checkSubPath("web/js/00_header.js", false)
  if(err !== null) return err

  return null
}

function onGridUiLocalResourcesClick(menuItem, window, event) {
  if(menuItem.checked) {
    const opts = {
      title: "Select path to RBGridUI root",
      properties: [ "openDirectory" ]
    }
    if(gLocalResPath !== "") {
      opts.defaultPath = gLocalResPath
    }
    const paths = dialog.showOpenDialogSync(window, opts)
    if(paths == undefined) {
      menuItem.checked = false
      return
    }

    const err = checkGridUIFolder(paths[0])
    if(err !== null) {
      menuItem.checked = false
      dialog.showErrorBox("Failed to validate GridUI folder", "Failed to validate path " + paths[0] + " as RBGridUI root. Please select the root folder (where platformio.ini is).\n\n" + err)
      return
    }

    gLocalResEnabled = true
    gLocalResPath = paths[0]
    menuItem.sublabel = gLocalResPath
    store.set(STORAGE_LOCAL_RES_PATH, gLocalResPath)

    generateLocalResAmalgamations()
  } else {
    menuItem.sublabel = undefined
    gLocalResEnabled = false
  }

  store.set(STORAGE_LOCAL_RES_ENABLED, gLocalResEnabled)
  window.loadFile('index.html')
}

function createMenu() {  
  var template = [
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: function(item, focusedWindow) {
            if (focusedWindow) {
              generateLocalResAmalgamations()
              focusedWindow.webContents.reloadIgnoringCache()
            }
          }
        },
        {
          label: 'Toggle Full Screen',
          accelerator: (function() {
            if (process.platform == 'darwin')
              return 'Ctrl+Command+F';
            else
              return 'F11';
          })(),
          click: function(item, focusedWindow) {
            if (focusedWindow)
              focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: (function() {
            if (process.platform == 'darwin')
              return 'Alt+Command+I';
            else
              return 'Ctrl+Shift+I';
          })(),
          click: function(item, focusedWindow) {
            if (focusedWindow)
              focusedWindow.toggleDevTools();
          }
        },
        {
          label: 'GridUI resources from local folder',
          sublabel: gLocalResEnabled ? gLocalResPath : undefined,
          type: "checkbox",
          accelerator: 'CmdOrCtrl+O',
          checked: gLocalResEnabled,
          click: onGridUiLocalResourcesClick,
        }
      ]
    },
    {
      label: 'Window',
      role: 'window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          role: 'close'
        },
      ]
    },
  ];

  if (process.platform == 'darwin') {
    template.unshift({
      label: 'Electron',
      submenu: [
        {
          label: 'About Electron',
          role: 'about'
        },
        {
          type: 'separator'
        },
        {
          label: 'Services',
          role: 'services',
          submenu: []
        },
        {
          type: 'separator'
        },
        {
          label: 'Hide Electron',
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        {
          type: 'separator'
        },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: function() { app.quit(); }
        },
      ]
    });
    template[3].submenu.push(
      {
        type: 'separator'
      },
      {
        label: 'Bring All to Front',
        role: 'front'
      }
    );
  }

  var menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
    icon: path.join(__dirname, 'assets/icon.png'),
  })

  createMenu()

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  protocol.registerHttpProtocol('gridui', (request, callback)=>{
    const url = new URL(request.url)

    try {
      fs.accessSync(url.pathname, fs.access.R_OK)
      request.url = "file://" + url.pathname
    } catch {
      let commonIdx = 0
      while(commonIdx < gLocalResPath.length && commonIdx < url.pathname.length) {
        if(gLocalResPath.charAt(commonIdx) === url.pathname.charAt(commonIdx)) {
          ++commonIdx;
        } else {
          break;
        }
      }

      request.url = gLocalResOrigin + "/" + url.pathname.substring(commonIdx)
    }

    callback(request)
  })

  mainWindow.webContents.session.webRequest.onBeforeRequest({ urls: [ "*://*/*" ] }, (details, callback) => {
      callback(requestFilter(details))
  });

  mainWindow.maximize();

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
