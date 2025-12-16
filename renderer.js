/**
 * KickClient - Renderer Script
 * Handles UI injection, quality selection, and dynamic theming
 */

(function () {
    'use strict';

    // State management
    let currentStreamUrl = null;
    let isRecording = false;
    let recordButton = null;
    let watermarkText = 'kelle';

    // Icons
    const ICONS = {
        record: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>`,
        stop: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`,
        download: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 16l-6-6h4V4h4v6h4l-6 6zm-8 2h16v2H4v-2z"/></svg>`,
        settings: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z"/></svg>`
    };

    // Initialize when API is available
    function init() {
        console.log('KickClient: Initializing renderer');

        // Load settings
        loadSettings();

        // Set up mutation observer for player controls
        observePlayerControls();

        // Apply dynamic watermark
        applyWatermark();

        // Create settings button
        createSettingsButton();

        // Set up event listeners
        setupEventListeners();
    }

    // Load user settings
    async function loadSettings() {
        try {
            const settings = await window.kickClient.getSettings();
            watermarkText = settings.watermarkText || 'kelle';
            applyWatermark();
        } catch (error) {
            console.error('KickClient: Error loading settings', error);
        }
    }

    // Observe DOM for player controls
    function observePlayerControls() {
        const observer = new MutationObserver((mutations) => {
            // Look for video player controls
            const playerControls = document.querySelector('[class*="player-controls"]') ||
                document.querySelector('[class*="vjs-control-bar"]') ||
                document.querySelector('.video-player__controls') ||
                document.querySelector('[data-testid="player-controls"]');

            if (playerControls && !playerControls.querySelector('.kickclient-record-btn')) {
                injectRecordButton(playerControls);
            }

            // Also check for Kick-specific player structure
            const kickPlayer = document.querySelector('#player-container') ||
                document.querySelector('[class*="bmpui-ui-container"]');
            if (kickPlayer) {
                const controlBar = kickPlayer.querySelector('[class*="controlbar"]') ||
                    kickPlayer.querySelector('[class*="control-bar"]');
                if (controlBar && !controlBar.querySelector('.kickclient-record-btn')) {
                    injectRecordButton(controlBar);
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Also check immediately
        setTimeout(() => {
            const existingControls = document.querySelector('[class*="bmpui-controlbar"]') ||
                document.querySelector('[class*="player-controls"]');
            if (existingControls && !existingControls.querySelector('.kickclient-record-btn')) {
                injectRecordButton(existingControls);
            }
        }, 2000);
    }

    // Inject record button into player controls
    function injectRecordButton(controlsContainer) {
        recordButton = document.createElement('button');
        recordButton.className = 'kickclient-record-btn';
        recordButton.innerHTML = `${ICONS.record} <span>Record</span>`;
        recordButton.title = 'Record Live Stream (KickClient)';

        recordButton.addEventListener('click', handleRecordClick);

        // Try to insert before fullscreen button or at the end
        const fullscreenBtn = controlsContainer.querySelector('[class*="fullscreen"]') ||
            controlsContainer.querySelector('[aria-label*="fullscreen"]');
        if (fullscreenBtn) {
            fullscreenBtn.parentNode.insertBefore(recordButton, fullscreenBtn);
        } else {
            controlsContainer.appendChild(recordButton);
        }

        console.log('KickClient: Record button injected');
    }

    // Handle record button click
    async function handleRecordClick() {
        if (isRecording) {
            await stopRecording();
        } else {
            await showQualityModal();
        }
    }

    // Show quality selection modal
    async function showQualityModal() {
        // Detect if this is a live stream or VOD
        const isLive = detectLiveStream();
        const streamUrl = await getStreamUrl();

        if (!streamUrl) {
            showNotification('Could not detect stream URL', 'error');
            return;
        }

        // Fetch master playlist to get available qualities
        const qualities = await fetchQualityOptions(streamUrl);

        // Create modal
        const overlay = document.createElement('div');
        overlay.className = 'kickclient-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'kickclient-modal';

        modal.innerHTML = `
            <h2>${isLive ? '🔴 Record Live Stream' : '📥 Download VOD'}</h2>
            <div class="kickclient-quality-list">
                ${qualities.map((q, i) => `
                    <div class="kickclient-quality-option ${i === 0 ? 'selected' : ''}">
                        <input type="radio" name="quality" id="quality-${i}" value="${q.url}" ${i === 0 ? 'checked' : ''}>
                        <label for="quality-${i}">${q.label}</label>
                    </div>
                `).join('')}
            </div>
            <div class="kickclient-modal-buttons">
                <button class="kickclient-modal-btn secondary" id="cancel-btn">Cancel</button>
                <button class="kickclient-modal-btn primary" id="start-btn">${isLive ? 'Start Recording' : 'Download'}</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Event listeners
        modal.querySelectorAll('.kickclient-quality-option').forEach(option => {
            option.addEventListener('click', () => {
                modal.querySelectorAll('.kickclient-quality-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                option.querySelector('input').checked = true;
            });
        });

        modal.querySelector('#cancel-btn').addEventListener('click', () => {
            overlay.remove();
        });

        modal.querySelector('#start-btn').addEventListener('click', async () => {
            const selectedQuality = modal.querySelector('input[name="quality"]:checked');
            if (selectedQuality) {
                overlay.remove();
                currentStreamUrl = selectedQuality.value;

                if (isLive) {
                    await startRecording(selectedQuality.value, getStreamName());
                } else {
                    await downloadVod(selectedQuality.value, getStreamName());
                }
            }
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    // Detect if current stream is live
    function detectLiveStream() {
        // Check for live indicators on Kick
        const liveIndicator = document.querySelector('[class*="live-badge"]') ||
            document.querySelector('[class*="is-live"]') ||
            document.querySelector('[data-live="true"]') ||
            document.querySelector('.live-indicator');

        // Also check URL
        const isVodUrl = window.location.href.includes('/video/') ||
            window.location.href.includes('/videos/');

        return !isVodUrl && (liveIndicator !== null || window.location.pathname.match(/^\/[^/]+$/));
    }

    // Get stream URL from page
    async function getStreamUrl() {
        // Try multiple methods to get the stream URL

        // Method 1: Check for HLS sources in video elements
        const videos = document.querySelectorAll('video');
        for (const video of videos) {
            if (video.src && video.src.includes('.m3u8')) {
                return video.src;
            }
        }

        // Method 2: Check network requests (if available)
        // This would require intercepting fetch/XHR requests

        // Method 3: Parse from Kick's player config
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            const content = script.textContent;
            if (content && content.includes('.m3u8')) {
                const match = content.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/g);
                if (match) {
                    return match[0];
                }
            }
        }

        // Method 4: Build URL from channel name
        const channelMatch = window.location.pathname.match(/^\/([^/]+)$/);
        if (channelMatch) {
            // Try common Kick stream URL patterns
            return `https://fa723fc1b171.us-west-2.playback.live-video.net/api/video/v1/us-west-2.${channelMatch[1]}/main/playlist.m3u8`;
        }

        return null;
    }

    // Get stream name for filename
    function getStreamName() {
        // Try to get channel/video name
        const titleEl = document.querySelector('[class*="stream-title"]') ||
            document.querySelector('h1') ||
            document.querySelector('[data-testid="stream-title"]');

        if (titleEl) {
            return titleEl.textContent.trim().substring(0, 50);
        }

        // Fallback to URL path
        const pathMatch = window.location.pathname.match(/^\/([^/]+)/);
        return pathMatch ? pathMatch[1] : 'stream';
    }

    // Fetch available quality options from m3u8 playlist
    async function fetchQualityOptions(masterPlaylistUrl) {
        try {
            const response = await fetch(masterPlaylistUrl);
            const text = await response.text();

            const qualities = [];
            const lines = text.split('\n');

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
                    const info = lines[i];
                    const url = lines[i + 1];

                    // Parse resolution and bandwidth
                    const resMatch = info.match(/RESOLUTION=(\d+x\d+)/);
                    const bandMatch = info.match(/BANDWIDTH=(\d+)/);

                    const resolution = resMatch ? resMatch[1] : 'Unknown';
                    const bandwidth = bandMatch ? Math.round(parseInt(bandMatch[1]) / 1000) : 0;

                    // Build absolute URL
                    let fullUrl = url.trim();
                    if (!fullUrl.startsWith('http')) {
                        const baseUrl = masterPlaylistUrl.substring(0, masterPlaylistUrl.lastIndexOf('/') + 1);
                        fullUrl = baseUrl + fullUrl;
                    }

                    qualities.push({
                        label: `${resolution} (${bandwidth} kbps)`,
                        url: fullUrl,
                        resolution,
                        bandwidth
                    });
                }
            }

            // Sort by bandwidth (highest first)
            qualities.sort((a, b) => b.bandwidth - a.bandwidth);

            // If no qualities found, return the master playlist itself
            if (qualities.length === 0) {
                qualities.push({
                    label: 'Source Quality',
                    url: masterPlaylistUrl,
                    resolution: 'Auto',
                    bandwidth: 0
                });
            }

            return qualities;
        } catch (error) {
            console.error('KickClient: Error fetching qualities', error);
            return [{
                label: 'Source Quality',
                url: masterPlaylistUrl,
                resolution: 'Auto',
                bandwidth: 0
            }];
        }
    }

    // Start recording
    async function startRecording(streamUrl, streamName) {
        try {
            const result = await window.kickClient.startRecording({
                streamUrl,
                quality: 'source',
                streamName
            });

            if (result.success) {
                isRecording = true;
                updateRecordButtonState();
                showNotification(`Recording started: ${streamName}`, 'success');
            } else {
                showNotification(`Recording failed: ${result.error}`, 'error');
            }
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
        }
    }

    // Stop recording
    async function stopRecording() {
        try {
            const result = await window.kickClient.stopRecording({
                streamUrl: currentStreamUrl
            });

            if (result.success) {
                isRecording = false;
                updateRecordButtonState();
                showNotification('Recording stopped', 'success');
            } else {
                showNotification(`Stop failed: ${result.error}`, 'error');
            }
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
        }
    }

    // Download VOD
    async function downloadVod(vodUrl, vodName) {
        try {
            const result = await window.kickClient.downloadVod({
                vodUrl,
                vodName
            });

            if (result.success) {
                showNotification(`Download started: ${vodName}`, 'success');
            } else {
                showNotification(`Download failed: ${result.error}`, 'error');
            }
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
        }
    }

    // Update record button state
    function updateRecordButtonState() {
        if (recordButton) {
            if (isRecording) {
                recordButton.classList.add('recording');
                recordButton.innerHTML = `${ICONS.stop} <span>Stop</span>`;
                recordButton.title = 'Stop Recording';
            } else {
                recordButton.classList.remove('recording');
                recordButton.innerHTML = `${ICONS.record} <span>Record</span>`;
                recordButton.title = 'Record Live Stream';
            }
        }
    }

    // Show notification
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `kickclient-notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    // Create settings button
    function createSettingsButton() {
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'kickclient-settings-btn';
        settingsBtn.innerHTML = ICONS.settings;
        settingsBtn.title = 'KickClient Settings';

        settingsBtn.addEventListener('click', showSettingsModal);

        document.body.appendChild(settingsBtn);
    }

    // Show settings modal
    function showSettingsModal() {
        const overlay = document.createElement('div');
        overlay.className = 'kickclient-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'kickclient-modal';

        modal.innerHTML = `
            <h2>⚙️ KickClient Settings</h2>
            <div style="margin: 20px 0;">
                <label style="color: #aaa; display: block; margin-bottom: 8px;">Watermark Text</label>
                <input type="text" id="watermark-input" value="${watermarkText}" 
                    style="width: 100%; padding: 12px; border: 1px solid #53FC18; border-radius: 8px; 
                    background: rgba(255,255,255,0.05); color: white; font-size: 16px;">
                <p style="color: #666; font-size: 12px; margin-top: 8px;">
                    This text will be displayed as a diagonal watermark pattern across the page.
                </p>
            </div>
            <div class="kickclient-modal-buttons">
                <button class="kickclient-modal-btn secondary" id="settings-cancel">Cancel</button>
                <button class="kickclient-modal-btn primary" id="settings-save">Save</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        modal.querySelector('#settings-cancel').addEventListener('click', () => {
            overlay.remove();
        });

        modal.querySelector('#settings-save').addEventListener('click', async () => {
            const newWatermark = modal.querySelector('#watermark-input').value;
            watermarkText = newWatermark;

            await window.kickClient.saveSettings({ watermarkText: newWatermark });
            applyWatermark();
            overlay.remove();
            showNotification('Settings saved', 'success');
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    // Apply dynamic text watermark using SVG
    function applyWatermark() {
        // Remove existing watermark
        const existing = document.getElementById('kickclient-watermark-style');
        if (existing) existing.remove();

        // Generate SVG watermark pattern
        const svg = generateWatermarkSVG(watermarkText);
        const encodedSVG = encodeURIComponent(svg);

        const style = document.createElement('style');
        style.id = 'kickclient-watermark-style';
        style.textContent = `
            body::before {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-image: url("data:image/svg+xml,${encodedSVG}");
                background-repeat: repeat;
                opacity: 0.03;
                pointer-events: none;
                z-index: 99980;
            }
        `;

        document.head.appendChild(style);
        console.log('KickClient: Watermark applied');
    }

    // Generate SVG watermark pattern
    function generateWatermarkSVG(text) {
        const fontSize = 24;
        const width = text.length * fontSize * 0.8;
        const height = 120;

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width * 2} ${height * 2}">
            <defs>
                <pattern id="watermark" x="0" y="0" width="${width}" height="${height}" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                    <text x="0" y="${fontSize}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="#53FC18" opacity="0.5">${text}</text>
                    <text x="${width / 2}" y="${height / 2 + fontSize / 2}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="#9147FF" opacity="0.5">${text}</text>
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#watermark)"/>
        </svg>`;
    }

    // Set up event listeners for IPC events
    function setupEventListeners() {
        window.kickClient.onRecordingProgress((data) => {
            console.log('Recording progress:', data.timemark);
        });

        window.kickClient.onRecordingComplete((data) => {
            isRecording = false;
            updateRecordButtonState();
            showNotification(`Recording saved: ${data.filename}`, 'success');
        });

        window.kickClient.onRecordingError((error) => {
            showNotification(`Recording error: ${error}`, 'error');
        });

        window.kickClient.onDownloadProgress((data) => {
            console.log('Download progress:', data.percent + '%');
        });

        window.kickClient.onDownloadComplete((data) => {
            showNotification(`Download complete: ${data.filename}`, 'success');
        });

        window.kickClient.onDownloadError((error) => {
            showNotification(`Download error: ${error}`, 'error');
        });
    }

    // Initialize when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
