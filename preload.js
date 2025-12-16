const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('kickClient', {
    // Recording controls (Canli Yayin Indirme)
    startRecording: (options) => ipcRenderer.invoke('start-recording', options),
    stopRecording: (options) => ipcRenderer.invoke('stop-recording', options),
    getActiveRecordings: () => ipcRenderer.invoke('get-active-recordings'),

    // VOD download (Arsiv Indirme)
    downloadVod: (options) => ipcRenderer.invoke('download-vod', options),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // Discord RPC
    discordSetMode: (options) => ipcRenderer.invoke('discord-rpc-set-mode', options),
    discordGetStatus: () => ipcRenderer.invoke('discord-rpc-get-status'),
    discordUpdateStreamer: (options) => ipcRenderer.invoke('discord-rpc-update-streamer', options),

    // Dialog
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),

    // Event listeners
    onRecordingProgress: (callback) => {
        ipcRenderer.on('recording-progress', (event, data) => callback(data));
    },
    onRecordingComplete: (callback) => {
        ipcRenderer.on('recording-complete', (event, data) => callback(data));
    },
    onRecordingError: (callback) => {
        ipcRenderer.on('recording-error', (event, error) => callback(error));
    },
    onDownloadProgress: (callback) => {
        ipcRenderer.on('download-progress', (event, data) => callback(data));
    },
    onDownloadComplete: (callback) => {
        ipcRenderer.on('download-complete', (event, data) => callback(data));
    },
    onDownloadError: (callback) => {
        ipcRenderer.on('download-error', (event, error) => callback(error));
    }
});

// Inject custom UI elements when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    console.log('KickClient: Preload script loaded');

    // Create a style element for injected controls
    const style = document.createElement('style');
    style.textContent = `
        .kickclient-record-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px 12px;
            margin: 0 4px;
            background: #53FC18;
            border: none;
            border-radius: 6px;
            color: #000;
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            gap: 6px;
        }
        
        .kickclient-record-btn:hover {
            transform: scale(1.05);
            background: #4ae015;
        }
        
        .kickclient-record-btn.recording {
            background: #FF4444;
            color: white;
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7); }
            50% { box-shadow: 0 0 0 10px rgba(255, 68, 68, 0); }
        }
        
        .kickclient-record-btn svg {
            width: 16px;
            height: 16px;
        }
        
        .kickclient-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            backdrop-filter: blur(5px);
        }
        
        .kickclient-modal {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 12px;
            padding: 24px;
            min-width: 320px;
            max-width: 450px;
        }
        
        .kickclient-modal h2 {
            color: #fff;
            margin: 0 0 20px 0;
            font-size: 18px;
            font-weight: 600;
        }
        
        .kickclient-quality-option {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            margin: 8px 0;
            background: #252525;
            border: 1px solid #333;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .kickclient-quality-option:hover {
            background: #2a2a2a;
            border-color: #53FC18;
        }
        
        .kickclient-quality-option.selected {
            background: rgba(83, 252, 24, 0.1);
            border-color: #53FC18;
        }
        
        .kickclient-quality-option input[type="radio"] {
            margin-right: 12px;
            accent-color: #53FC18;
        }
        
        .kickclient-quality-option label {
            color: white;
            cursor: pointer;
            flex: 1;
        }
        
        .kickclient-modal-buttons {
            display: flex;
            gap: 12px;
            margin-top: 20px;
        }
        
        .kickclient-modal-btn {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .kickclient-modal-btn.primary {
            background: #53FC18;
            color: #000;
        }
        
        .kickclient-modal-btn.secondary {
            background: #333;
            color: white;
        }
        
        .kickclient-modal-btn:hover {
            transform: scale(1.02);
        }
        
        .kickclient-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            color: white;
            z-index: 99998;
            animation: slideIn 0.3s ease;
            max-width: 350px;
        }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .kickclient-notification.error {
            border-color: #FF4444;
        }
        
        .kickclient-notification.success {
            border-color: #53FC18;
        }
        
        .kickclient-settings-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99990;
            transition: all 0.2s ease;
        }
        
        .kickclient-settings-btn:hover {
            background: #252525;
            border-color: #53FC18;
        }
        
        .kickclient-settings-btn svg {
            width: 24px;
            height: 24px;
            fill: #53FC18;
        }
        
        /* Discord RPC Toggle Styles */
        .kickclient-toggle-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin: 16px 0;
        }
        
        .kickclient-toggle-option {
            display: flex;
            align-items: center;
            padding: 12px;
            background: #252525;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        .kickclient-toggle-option:hover {
            background: #2a2a2a;
        }
        
        .kickclient-toggle-option.active {
            background: rgba(83, 252, 24, 0.1);
            border: 1px solid #53FC18;
        }
        
        .kickclient-toggle-option input[type="radio"] {
            margin-right: 12px;
            accent-color: #53FC18;
        }
        
        .kickclient-toggle-option label {
            color: #fff;
            cursor: pointer;
        }
        
        .kickclient-section-title {
            color: #888;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 20px 0 10px 0;
        }
        
        .kickclient-input {
            width: 100%;
            padding: 12px;
            border: 1px solid #333;
            border-radius: 8px;
            background: #252525;
            color: white;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        }
        
        .kickclient-input:focus {
            border-color: #53FC18;
        }
    `;
    document.head.appendChild(style);
});
