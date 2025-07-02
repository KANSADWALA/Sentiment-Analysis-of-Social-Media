// File: main.js

import pkg from 'electron';
const { app, BrowserWindow, ipcMain, dialog } = pkg;
import path from 'path';
import fs from 'fs';
import Store from 'electron-store';
import { spawn } from 'child_process';
import squirrelStartup from 'electron-squirrel-startup';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (squirrelStartup) {
  app.quit();
}

const store = new Store({
  projectName: 'SocialMediaSentimentAnalyzer'
});

let mainWindow;
let pythonServer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));

  const outputDir = path.join(app.getPath('documents'), 'SocialMediaSentimentAnalyzer');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  store.set('outputDirectory', outputDir);
}

// main.js
function startPythonServer() {
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const serverScript = path.join(__dirname, 'flask_server.py');

  // Add environment variables for better performance
  const env = {
    ...process.env,
    OMP_NUM_THREADS: '1',  // Limit OpenMP threads
    TF_NUM_INTEROP_THREADS: '1',  // TensorFlow threads
    TF_NUM_INTRAOP_THREADS: '1'
  };

  const serverProcess = spawn(pythonPath, [serverScript], {
    cwd: __dirname, // VERY IMPORTANT! Ensure working directory correct
    shell: true,    // Important for cross-platform compatibility
    env: env,      // Pass the environment variables
  });

  // Add error handling
  serverProcess.on('error', (err) => {
    console.error('Failed to start Python server:', err);
    if (mainWindow) {
        mainWindow.webContents.send('log-message', 
            `Python server failed to start: ${err.message}`, 'error');
    }
  });

  let serverStarted = false;

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`Python server: ${output}`);
    if (mainWindow) {
      mainWindow.webContents.send('log-message', `Python server: ${output}`, 'info');
    }
    if (output.includes('Running on')) {
      serverStarted = true;
    }
  });

  serverProcess.stderr.on('data', (data) => {
    const error = data.toString();
    console.error(`Python server error: ${error}`);
    if (mainWindow) {
      mainWindow.webContents.send('log-message', `Python server error: ${error}`, 'error');
    }
  });

  serverProcess.on('close', (code) => {
    console.log(`Python server exited with code ${code}`);
    if (!serverStarted) {
      console.error('Python server failed to start.');
    }
  });

  return serverProcess;
}


app.whenReady().then(() => {
  createWindow();
  pythonServer = startPythonServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  if (pythonServer) {
    pythonServer.kill();
  }
});

ipcMain.handle('open-save-dialog', async (event, options) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, options);
  return !canceled && filePath ? filePath : null;
});

ipcMain.handle('open-file-dialog', async (event, options) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, options);
  return !canceled && filePaths.length > 0 ? filePaths[0] : null;
});

// Add missing read-file handler
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
});

// Add write-file handler for completeness
ipcMain.handle('write-file', async (event, filePath, data) => {
  try {
    fs.writeFileSync(filePath, data, 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
});


ipcMain.handle('save-file', async (event, { defaultPath, data }) => {
    try {
        const { filePath, canceled } = await dialog.showSaveDialog({
            defaultPath,
            filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
        });

        if (canceled || !filePath) {
            return { success: false, message: 'Save canceled' };
        }

        fs.writeFileSync(filePath, data, 'binary');
        return { success: true, filePath };
    } catch (err) {
        console.error('[Electron Main] Save File Error:', err);
        return { success: false, message: err.message };
    }
});


ipcMain.handle('show-message-box', async (event, options) => {
  return await dialog.showMessageBox(mainWindow, options);
});

ipcMain.handle('get-output-directory', async () => {
  return store.get('outputDirectory');
});