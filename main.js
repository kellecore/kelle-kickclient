const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Store active recording processes
const activeRecordings = new Map();

// Get user's Downloads folder
function getDownloadsPath() {
    return app.getPath('downloads');
}

// Generate unique filename for recordings
function generateFilename(streamName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = streamName.replace(/[^a-zA-Z0-9]/g, '_');
    return `KickClient_${safeName}_${timestamp}.mp4`;
}

// Create the main application window
function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true
        },
        title: 'Kelle KickClient',
        autoHideMenuBar: true,
        backgroundColor: '#0e0e10'
    });

    // Load Kick.com
    mainWindow.loadURL('https://kick.com');

    // Inject custom CSS on page load
    mainWindow.webContents.on('did-finish-load', () => {
        const cssPath = path.join(__dirname, 'styles.css');
        if (fs.existsSync(cssPath)) {
            const css = fs.readFileSync(cssPath, 'utf8');
            mainWindow.webContents.insertCSS(css);
        }
    });

    // Inject renderer script
    mainWindow.webContents.on('dom-ready', () => {
        const rendererPath = path.join(__dirname, 'renderer.js');
        if (fs.existsSync(rendererPath)) {
            const rendererCode = fs.readFileSync(rendererPath, 'utf8');
            mainWindow.webContents.executeJavaScript(rendererCode);
        }
    });

    return mainWindow;
}

// IPC Handler: Start Recording
ipcMain.handle('start-recording', async (event, { streamUrl, quality, streamName }) => {
    return new Promise((resolve, reject) => {
        try {
            const filename = generateFilename(streamName || 'stream');
            const outputPath = path.join(getDownloadsPath(), filename);

            console.log(`Starting recording: ${streamUrl}`);
            console.log(`Quality: ${quality}`);
            console.log(`Output: ${outputPath}`);

            let reconnectAttempts = 0;
            const maxReconnectAttempts = 5;
            const reconnectDelay = 3000;

            function startRecording() {
                const command = ffmpeg(streamUrl)
                    .inputOptions([
                        '-live_start_index', '-1',
                        '-reconnect', '1',
                        '-reconnect_streamed', '1',
                        '-reconnect_delay_max', '5',
                        '-timeout', '10000000'
                    ])
                    .outputOptions([
                        '-c:v', 'copy',
                        '-c:a', 'aac',
                        '-bsf:a', 'aac_adtstoasc',
                        '-movflags', '+faststart'
                    ])
                    .output(outputPath)
                    .on('start', (commandLine) => {
                        console.log('FFmpeg started:', commandLine);
                        reconnectAttempts = 0;
                    })
                    .on('progress', (progress) => {
                        // Send progress to renderer
                        event.sender.send('recording-progress', {
                            timemark: progress.timemark,
                            frames: progress.frames
                        });
                    })
                    .on('error', (err) => {
                        console.error('FFmpeg error:', err.message);

                        // Attempt reconnection on stream errors
                        if (reconnectAttempts < maxReconnectAttempts &&
                            (err.message.includes('Connection') ||
                                err.message.includes('timeout') ||
                                err.message.includes('end of file'))) {
                            reconnectAttempts++;
                            console.log(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
                            setTimeout(startRecording, reconnectDelay);
                        } else {
                            activeRecordings.delete(streamUrl);
                            event.sender.send('recording-error', err.message);
                        }
                    })
                    .on('end', () => {
                        console.log('Recording finished');
                        activeRecordings.delete(streamUrl);
                        event.sender.send('recording-complete', {
                            path: outputPath,
                            filename: filename
                        });
                    });

                command.run();
                activeRecordings.set(streamUrl, command);
            }

            startRecording();

            resolve({
                success: true,
                message: `Recording started: ${filename}`,
                path: outputPath
            });

        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
});

// IPC Handler: Stop Recording
ipcMain.handle('stop-recording', async (event, { streamUrl }) => {
    const command = activeRecordings.get(streamUrl);
    if (command) {
        try {
            command.kill('SIGINT');
            activeRecordings.delete(streamUrl);
            return { success: true, message: 'Recording stopped' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    return { success: false, error: 'No active recording found' };
});

// IPC Handler: Get active recordings
ipcMain.handle('get-active-recordings', async () => {
    return Array.from(activeRecordings.keys());
});

// IPC Handler: Download VOD
ipcMain.handle('download-vod', async (event, { vodUrl, vodName }) => {
    return new Promise((resolve, reject) => {
        try {
            const filename = generateFilename(vodName || 'vod');
            const outputPath = path.join(getDownloadsPath(), filename);

            const command = ffmpeg(vodUrl)
                .outputOptions([
                    '-c', 'copy',
                    '-bsf:a', 'aac_adtstoasc'
                ])
                .output(outputPath)
                .on('start', () => {
                    console.log('VOD download started');
                })
                .on('progress', (progress) => {
                    event.sender.send('download-progress', {
                        percent: progress.percent,
                        timemark: progress.timemark
                    });
                })
                .on('error', (err) => {
                    console.error('Download error:', err);
                    event.sender.send('download-error', err.message);
                })
                .on('end', () => {
                    event.sender.send('download-complete', {
                        path: outputPath,
                        filename: filename
                    });
                });

            command.run();
            activeRecordings.set(vodUrl, command);

            resolve({ success: true, message: `Download started: ${filename}` });
        } catch (error) {
            reject({ success: false, error: error.message });
        }
    });
});

// IPC Handler: Show save dialog
ipcMain.handle('show-save-dialog', async (event, { defaultPath }) => {
    const result = await dialog.showSaveDialog({
        defaultPath: path.join(getDownloadsPath(), defaultPath),
        filters: [
            { name: 'Video Files', extensions: ['mp4'] }
        ]
    });
    return result;
});

// IPC Handler: Get watermark settings
ipcMain.handle('get-settings', async () => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    try {
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
    } catch (error) {
        console.error('Error reading settings:', error);
    }
    return { watermarkText: 'kelle' };
});

// IPC Handler: Save settings
ipcMain.handle('save-settings', async (event, settings) => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// App lifecycle
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Stop all active recordings before quitting
    for (const [url, command] of activeRecordings) {
        try {
            command.kill('SIGINT');
        } catch (e) {
            console.error('Error stopping recording:', e);
        }
    }
    activeRecordings.clear();

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle certificate errors for development
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
});
