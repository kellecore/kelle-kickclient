const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('kickClient', {
    // Recording controls
    startRecording: (options) => ipcRenderer.invoke('start-recording', options),
    stopRecording: (options) => ipcRenderer.invoke('stop-recording', options),
    getActiveRecordings: () => ipcRenderer.invoke('get-active-recordings'),

    // VOD download
    downloadVod: (options) => ipcRenderer.invoke('download-vod', options),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

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
            background: linear-gradient(135deg, #53FC18 0%, #9147FF 100%);
            border: none;
            border-radius: 6px;
            color: white;
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            gap: 6px;
        }
        
        .kickclient-record-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 0 20px rgba(83, 252, 24, 0.4);
        }
        
        .kickclient-record-btn.recording {
            background: linear-gradient(135deg, #FF4444 0%, #CC0000 100%);
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
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            backdrop-filter: blur(5px);
        }
        
        .kickclient-modal {
            background: linear-gradient(145deg, #1a1a2e, #16213e);
            border: 1px solid #53FC18;
            border-radius: 16px;
            padding: 24px;
            min-width: 320px;
            max-width: 450px;
            box-shadow: 0 0 40px rgba(83, 252, 24, 0.2);
        }
        
        .kickclient-modal h2 {
            color: #53FC18;
            margin: 0 0 20px 0;
            font-size: 20px;
            text-align: center;
        }
        
        .kickclient-quality-option {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            margin: 8px 0;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(83, 252, 24, 0.3);
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .kickclient-quality-option:hover {
            background: rgba(83, 252, 24, 0.1);
            border-color: #53FC18;
        }
        
        .kickclient-quality-option.selected {
            background: rgba(83, 252, 24, 0.2);
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
            background: linear-gradient(135deg, #53FC18 0%, #9147FF 100%);
            color: white;
        }
        
        .kickclient-modal-btn.secondary {
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .kickclient-modal-btn:hover {
            transform: scale(1.02);
        }
        
        .kickclient-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: linear-gradient(145deg, #1a1a2e, #16213e);
            border: 1px solid #53FC18;
            border-radius: 12px;
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
            background: linear-gradient(135deg, #53FC18 0%, #9147FF 100%);
            border: none;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99990;
            transition: all 0.2s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }
        
        .kickclient-settings-btn:hover {
            transform: scale(1.1);
        }
        
        .kickclient-settings-btn svg {
            width: 24px;
            height: 24px;
            fill: white;
        }
    `;
    document.head.appendChild(style);
});
