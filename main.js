const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const https = require('https');
const http = require('http');
const DiscordRPC = require('discord-rpc');

// Discord RPC Configuration
const DISCORD_CLIENT_ID = '1450511198750642357'; // Placeholder - user should create their own Discord app
let rpcClient = null;
let rpcConnected = false;
let currentRpcMode = 'streamer'; // off, streamer, kick, custom
let currentStreamerName = '';
let customStatus = 'Kick izliyor';

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

// Initialize Discord RPC
async function initDiscordRPC() {
    try {
        DiscordRPC.register(DISCORD_CLIENT_ID);
        rpcClient = new DiscordRPC.Client({ transport: 'ipc' });

        rpcClient.on('ready', () => {
            console.log('Discord RPC connected');
            rpcConnected = true;
            updateDiscordPresence();
        });

        rpcClient.on('disconnected', () => {
            console.log('Discord RPC disconnected');
            rpcConnected = false;
        });

        await rpcClient.login({ clientId: DISCORD_CLIENT_ID });
    } catch (error) {
        console.error('Discord RPC initialization failed:', error);
        rpcConnected = false;
    }
}

// Update Discord presence
function updateDiscordPresence() {
    if (!rpcClient || !rpcConnected || currentRpcMode === 'off') {
        if (rpcClient && rpcConnected) {
            rpcClient.clearActivity();
        }
        return;
    }

    let details = '';
    let state = 'Kick.com';

    switch (currentRpcMode) {
        case 'streamer':
            details = `${currentStreamerName} izliyor`;
            state = 'Canli Yayin';
            break;
        case 'kick':
            details = 'Kick izliyor';
            state = 'Yayin platformu';
            break;
        case 'custom':
            details = customStatus;
            state = 'Kick.com';
            break;
        default:
            return;
    }

    rpcClient.setActivity({
        details: details,
        state: state,
        startTimestamp: Date.now(),
        largeImageKey: 'kick_logo',
        largeImageText: 'Kelle KickClient',
        smallImageKey: 'live',
        smallImageText: 'Canli',
        instance: false
    });
}

// Update streamer name from URL
function updateStreamerFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/^\/([^\/]+)$/);
        if (pathMatch && pathMatch[1] && !['video', 'videos', 'categories', 'following', 'browse'].includes(pathMatch[1])) {
            currentStreamerName = pathMatch[1];
            if (currentRpcMode === 'streamer') {
                updateDiscordPresence();
            }
        }
    } catch (e) {
        // Invalid URL, ignore
    }
}

// Destroy Discord RPC
function destroyDiscordRPC() {
    if (rpcClient) {
        rpcClient.clearActivity();
        rpcClient.destroy();
        rpcClient = null;
        rpcConnected = false;
    }
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

    // Track URL changes for Discord presence
    mainWindow.webContents.on('did-navigate-in-page', (event, url) => {
        updateStreamerFromUrl(url);
    });

    mainWindow.webContents.on('did-navigate', (event, url) => {
        updateStreamerFromUrl(url);
    });

    // Handle external URLs (OAuth, Google login, etc.) - open in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.includes('accounts.google.com') ||
            url.includes('login.') ||
            url.includes('auth.') ||
            url.includes('oauth') ||
            url.includes('signin') ||
            url.includes('facebook.com/login') ||
            url.includes('appleid.apple.com')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    // Also handle navigation to OAuth URLs
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (url.includes('accounts.google.com') ||
            url.includes('facebook.com/login') ||
            url.includes('appleid.apple.com')) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    return mainWindow;
}

// IPC Handler: Discord RPC controls
ipcMain.handle('discord-rpc-set-mode', async (event, { mode, customText }) => {
    currentRpcMode = mode;
    if (customText) {
        customStatus = customText;
    }

    if (mode !== 'off' && !rpcConnected) {
        await initDiscordRPC();
    } else {
        updateDiscordPresence();
    }

    return { success: true, mode: currentRpcMode, connected: rpcConnected };
});

ipcMain.handle('discord-rpc-get-status', async () => {
    return {
        mode: currentRpcMode,
        connected: rpcConnected,
        streamerName: currentStreamerName,
        customStatus: customStatus
    };
});

ipcMain.handle('discord-rpc-update-streamer', async (event, { streamerName }) => {
    currentStreamerName = streamerName;
    updateDiscordPresence();
    return { success: true };
});

// IPC Handler: Start Recording (Canli Yayin Indir)
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
                        event.sender.send('recording-progress', {
                            timemark: progress.timemark,
                            frames: progress.frames
                        });
                    })
                    .on('error', (err) => {
                        console.error('FFmpeg error:', err.message);
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
                message: `Indirme baslatildi: ${filename}`,
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
            return { success: true, message: 'Indirme durduruldu' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    return { success: false, error: 'Aktif indirme bulunamadi' };
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
            resolve({ success: true, message: `Indirme baslatildi: ${filename}` });
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
            { name: 'Video Dosyalari', extensions: ['mp4'] }
        ]
    });
    return result;
});

// IPC Handler: Get settings
ipcMain.handle('get-settings', async () => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    try {
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
    } catch (error) {
        console.error('Error reading settings:', error);
    }
    return {
        watermarkText: 'kelle',
        discordRpcMode: 'streamer',
        customDiscordStatus: 'Kick izliyor'
    };
});

// IPC Handler: Save settings
ipcMain.handle('save-settings', async (event, settings) => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

        // Apply Discord settings
        if (settings.discordRpcMode !== undefined) {
            currentRpcMode = settings.discordRpcMode;
            if (settings.customDiscordStatus) {
                customStatus = settings.customDiscordStatus;
            }
            if (currentRpcMode !== 'off' && !rpcConnected) {
                await initDiscordRPC();
            } else {
                updateDiscordPresence();
            }
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// App lifecycle
app.whenReady().then(async () => {
    createWindow();

    // Load saved settings and init Discord if needed
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    try {
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            if (settings.discordRpcMode && settings.discordRpcMode !== 'off') {
                currentRpcMode = settings.discordRpcMode;
                if (settings.customDiscordStatus) {
                    customStatus = settings.customDiscordStatus;
                }
                await initDiscordRPC();
            }
        }
    } catch (e) {
        console.error('Error loading settings:', e);
    }

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

    // Cleanup Discord RPC
    destroyDiscordRPC();

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle certificate errors for development
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
});
