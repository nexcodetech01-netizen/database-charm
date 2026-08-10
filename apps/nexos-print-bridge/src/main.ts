import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let fastifyProcess: ChildProcess | null = null;
const isDev = process.env.NODE_ENV === 'development';

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveConfig(config: any) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function startFastify() {
  const serverPath = isDev 
    ? path.join(__dirname, 'server.ts') 
    : path.join(process.resourcesPath, 'app', 'dist', 'server.js');

  const command = isDev ? 'npx' : 'node';
  const args = isDev ? ['tsx', serverPath] : [serverPath];

  fastifyProcess = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, PORT: '8081' }
  });

  fastifyProcess.on('error', (err) => {
    console.error('Failed to start Fastify:', err);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false, // Iniciar oculto conforme requisito
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Em produção carregaremos uma interface React/HTML para o painel
  if (isDev) {
    mainWindow.loadURL('http://localhost:8080/bridge-panel');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));
  }

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
    return false;
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray-icon.png'));
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'NexOS Print Bridge', enabled: false },
    { type: 'separator' },
    { label: 'Abrir Painel', click: () => mainWindow?.show() },
    { label: 'Impressoras', click: () => {
        mainWindow?.show();
        mainWindow?.webContents.send('navigate', 'printers');
    }},
    { label: 'Histórico', click: () => {
        mainWindow?.show();
        mainWindow?.webContents.send('navigate', 'history');
    }},
    { label: 'Reiniciar Bridge', click: () => {
        fastifyProcess?.kill();
        startFastify();
    }},
    { label: 'Ver Logs', click: () => {
        const logPath = path.join(app.getPath('userData'), 'logs', 'bridge.log');
        if (fs.existsSync(logPath)) {
            shell.openPath(logPath);
        }
    }},
    { type: 'separator' },
    { label: 'Encerrar', click: () => {
        app.isQuitting = true;
        app.quit();
    }}
  ]);

  tray.setToolTip('NexOS Print Bridge');
  tray.setContextMenu(contextMenu);
  
  tray.on('double-click', () => {
    mainWindow?.show();
  });
}

app.on('ready', () => {
  startFastify();
  createWindow();
  createTray();
  
  // Auto-start logic (opcional dependendo do pacote de instalador usado, 
  // mas Electron tem suporte nativo)
  const config = loadConfig();
  if (config.autoStart) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe')
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Manter rodando na bandeja
  }
});

app.on('before-quit', () => {
  fastifyProcess?.kill();
});

ipcMain.on('get-config', (event) => {
  event.returnValue = loadConfig();
});

ipcMain.on('save-config', (event, newConfig) => {
  const config = loadConfig();
  const merged = { ...config, ...newConfig };
  saveConfig(merged);
  
  if (merged.autoStart !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: merged.autoStart,
      path: app.getPath('exe')
    });
  }
});
