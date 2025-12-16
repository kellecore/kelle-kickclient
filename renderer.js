/**
 * KickClient - Renderer Script
 * Turkce arayuz ile canli yayin indirme ve Discord RPC
 */

(function () {
    'use strict';

    // State management
    let currentStreamUrl = null;
    let isRecording = false;
    let recordButton = null;
    let watermarkText = 'kelle';
    let discordRpcMode = 'off';
    let customDiscordStatus = 'Kick izliyor';

    // Icons
    const ICONS = {
        download: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 16l-6-6h4V4h4v6h4l-6 6zm-8 2h16v2H4v-2z"/></svg>`,
        stop: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`,
        settings: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z"/></svg>`,
        discord: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`
    };

    // Initialize when API is available
    function init() {
        console.log('KickClient: Initializing renderer');
        loadSettings();
        observePlayerControls();
        createSettingsButton();
        setupEventListeners();
    }

    // Load user settings
    async function loadSettings() {
        try {
            const settings = await window.kickClient.getSettings();
            watermarkText = settings.watermarkText || 'kelle';
            discordRpcMode = settings.discordRpcMode || 'off';
            customDiscordStatus = settings.customDiscordStatus || 'Kick izliyor';
        } catch (error) {
            console.error('KickClient: Error loading settings', error);
        }
    }

    // Observe DOM for player controls
    function observePlayerControls() {
        const observer = new MutationObserver((mutations) => {
            const playerControls = document.querySelector('[class*="player-controls"]') ||
                document.querySelector('[class*="vjs-control-bar"]') ||
                document.querySelector('.video-player__controls') ||
                document.querySelector('[data-testid="player-controls"]');

            if (playerControls && !playerControls.querySelector('.kickclient-record-btn')) {
                injectRecordButton(playerControls);
            }

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
        recordButton.innerHTML = `${ICONS.download} <span>Indir</span>`;
        recordButton.title = 'Canli Yayin Indir (KickClient)';

        recordButton.addEventListener('click', handleRecordClick);

        const fullscreenBtn = controlsContainer.querySelector('[class*="fullscreen"]') ||
            controlsContainer.querySelector('[aria-label*="fullscreen"]');
        if (fullscreenBtn) {
            fullscreenBtn.parentNode.insertBefore(recordButton, fullscreenBtn);
        } else {
            controlsContainer.appendChild(recordButton);
        }

        console.log('KickClient: Indir butonu eklendi');
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
        const isLive = detectLiveStream();
        const streamUrl = await getStreamUrl();

        if (!streamUrl) {
            showNotification('Yayin URL\'si bulunamadi', 'error');
            return;
        }

        const qualities = await fetchQualityOptions(streamUrl);

        const overlay = document.createElement('div');
        overlay.className = 'kickclient-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'kickclient-modal';

        const title = isLive ? 'Canli Yayin Indir' : 'Video Indir';
        const buttonText = 'Indirmeyi Baslat';

        modal.innerHTML = `
            <h2>${isLive ? '🔴' : '📥'} ${title}</h2>
            <div class="kickclient-quality-list">
                ${qualities.map((q, i) => `
                    <div class="kickclient-quality-option ${i === 0 ? 'selected' : ''}">
                        <input type="radio" name="quality" id="quality-${i}" value="${q.url}" ${i === 0 ? 'checked' : ''}>
                        <label for="quality-${i}">${q.label}</label>
                    </div>
                `).join('')}
            </div>
            <div class="kickclient-modal-buttons">
                <button class="kickclient-modal-btn secondary" id="cancel-btn">Iptal</button>
                <button class="kickclient-modal-btn primary" id="start-btn">${buttonText}</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

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

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    // Detect if current stream is live
    function detectLiveStream() {
        const liveIndicator = document.querySelector('[class*="live-badge"]') ||
            document.querySelector('[class*="is-live"]') ||
            document.querySelector('[data-live="true"]') ||
            document.querySelector('.live-indicator');

        const isVodUrl = window.location.href.includes('/video/') ||
            window.location.href.includes('/videos/');

        return !isVodUrl && (liveIndicator !== null || window.location.pathname.match(/^\/[^/]+$/));
    }

    // Get stream URL from page
    async function getStreamUrl() {
        const videos = document.querySelectorAll('video');
        for (const video of videos) {
            if (video.src && video.src.includes('.m3u8')) {
                return video.src;
            }
        }

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

        const channelMatch = window.location.pathname.match(/^\/([^/]+)$/);
        if (channelMatch) {
            return `https://fa723fc1b171.us-west-2.playback.live-video.net/api/video/v1/us-west-2.${channelMatch[1]}/main/playlist.m3u8`;
        }

        return null;
    }

    // Get stream name for filename
    function getStreamName() {
        const titleEl = document.querySelector('[class*="stream-title"]') ||
            document.querySelector('h1') ||
            document.querySelector('[data-testid="stream-title"]');

        if (titleEl) {
            return titleEl.textContent.trim().substring(0, 50);
        }

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

                    const resMatch = info.match(/RESOLUTION=(\d+x\d+)/);
                    const bandMatch = info.match(/BANDWIDTH=(\d+)/);

                    const resolution = resMatch ? resMatch[1] : 'Bilinmiyor';
                    const bandwidth = bandMatch ? Math.round(parseInt(bandMatch[1]) / 1000) : 0;

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

            qualities.sort((a, b) => b.bandwidth - a.bandwidth);

            if (qualities.length === 0) {
                qualities.push({
                    label: 'En Yuksek Kalite',
                    url: masterPlaylistUrl,
                    resolution: 'Otomatik',
                    bandwidth: 0
                });
            }

            return qualities;
        } catch (error) {
            console.error('KickClient: Kalite secenekleri alinamadi', error);
            return [{
                label: 'En Yuksek Kalite',
                url: masterPlaylistUrl,
                resolution: 'Otomatik',
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
                showNotification(`Indirme baslatildi: ${streamName}`, 'success');
            } else {
                showNotification(`Indirme basarisiz: ${result.error}`, 'error');
            }
        } catch (error) {
            showNotification(`Hata: ${error.message}`, 'error');
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
                showNotification('Indirme durduruldu', 'success');
            } else {
                showNotification(`Durdurma basarisiz: ${result.error}`, 'error');
            }
        } catch (error) {
            showNotification(`Hata: ${error.message}`, 'error');
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
                showNotification(`Indirme baslatildi: ${vodName}`, 'success');
            } else {
                showNotification(`Indirme basarisiz: ${result.error}`, 'error');
            }
        } catch (error) {
            showNotification(`Hata: ${error.message}`, 'error');
        }
    }

    // Update record button state
    function updateRecordButtonState() {
        if (recordButton) {
            if (isRecording) {
                recordButton.classList.add('recording');
                recordButton.innerHTML = `${ICONS.stop} <span>Durdur</span>`;
                recordButton.title = 'Indirmeyi Durdur';
            } else {
                recordButton.classList.remove('recording');
                recordButton.innerHTML = `${ICONS.download} <span>Indir</span>`;
                recordButton.title = 'Canli Yayin Indir';
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
        settingsBtn.title = 'KickClient Ayarlar';

        settingsBtn.addEventListener('click', showSettingsModal);

        document.body.appendChild(settingsBtn);
    }

    // Show settings modal
    async function showSettingsModal() {
        const discordStatus = await window.kickClient.discordGetStatus();

        const overlay = document.createElement('div');
        overlay.className = 'kickclient-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'kickclient-modal';
        modal.style.minWidth = '380px';

        modal.innerHTML = `
            <h2>⚙️ KickClient Ayarlar</h2>
            
            <div class="kickclient-section-title">${ICONS.discord} Discord Durumu</div>
            <div class="kickclient-toggle-container">
                <div class="kickclient-toggle-option ${discordStatus.mode === 'off' ? 'active' : ''}" data-mode="off">
                    <input type="radio" name="discord-mode" value="off" ${discordStatus.mode === 'off' ? 'checked' : ''}>
                    <label>Kapali</label>
                </div>
                <div class="kickclient-toggle-option ${discordStatus.mode === 'streamer' ? 'active' : ''}" data-mode="streamer">
                    <input type="radio" name="discord-mode" value="streamer" ${discordStatus.mode === 'streamer' ? 'checked' : ''}>
                    <label>{yayinci-adi} izliyor</label>
                </div>
                <div class="kickclient-toggle-option ${discordStatus.mode === 'kick' ? 'active' : ''}" data-mode="kick">
                    <input type="radio" name="discord-mode" value="kick" ${discordStatus.mode === 'kick' ? 'checked' : ''}>
                    <label>Kick izliyor</label>
                </div>
                <div class="kickclient-toggle-option ${discordStatus.mode === 'custom' ? 'active' : ''}" data-mode="custom">
                    <input type="radio" name="discord-mode" value="custom" ${discordStatus.mode === 'custom' ? 'checked' : ''}>
                    <label>Ozel Durum</label>
                </div>
            </div>
            
            <div id="custom-status-container" style="display: ${discordStatus.mode === 'custom' ? 'block' : 'none'}; margin-top: 12px;">
                <input type="text" class="kickclient-input" id="custom-status-input" 
                    value="${discordStatus.customStatus || customDiscordStatus}" placeholder="Ozel durum yazin...">
            </div>
            
            <div class="kickclient-modal-buttons">
                <button class="kickclient-modal-btn secondary" id="settings-cancel">Iptal</button>
                <button class="kickclient-modal-btn primary" id="settings-save">Kaydet</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Handle toggle options
        modal.querySelectorAll('.kickclient-toggle-option').forEach(option => {
            option.addEventListener('click', () => {
                modal.querySelectorAll('.kickclient-toggle-option').forEach(o => o.classList.remove('active'));
                option.classList.add('active');
                option.querySelector('input').checked = true;

                const customContainer = modal.querySelector('#custom-status-container');
                if (option.dataset.mode === 'custom') {
                    customContainer.style.display = 'block';
                } else {
                    customContainer.style.display = 'none';
                }
            });
        });

        modal.querySelector('#settings-cancel').addEventListener('click', () => {
            overlay.remove();
        });

        modal.querySelector('#settings-save').addEventListener('click', async () => {
            const selectedMode = modal.querySelector('input[name="discord-mode"]:checked').value;
            const customText = modal.querySelector('#custom-status-input').value;

            discordRpcMode = selectedMode;
            customDiscordStatus = customText;

            await window.kickClient.saveSettings({
                watermarkText,
                discordRpcMode: selectedMode,
                customDiscordStatus: customText
            });

            await window.kickClient.discordSetMode({
                mode: selectedMode,
                customText: customText
            });

            overlay.remove();
            showNotification('Ayarlar kaydedildi', 'success');
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    // Set up event listeners for IPC events
    function setupEventListeners() {
        window.kickClient.onRecordingProgress((data) => {
            console.log('Indirme suresi:', data.timemark);
        });

        window.kickClient.onRecordingComplete((data) => {
            isRecording = false;
            updateRecordButtonState();
            showNotification(`Indirme tamamlandi: ${data.filename}`, 'success');
        });

        window.kickClient.onRecordingError((error) => {
            showNotification(`Indirme hatasi: ${error}`, 'error');
        });

        window.kickClient.onDownloadProgress((data) => {
            console.log('Indirme ilerlemesi:', data.percent + '%');
        });

        window.kickClient.onDownloadComplete((data) => {
            showNotification(`Indirme tamamlandi: ${data.filename}`, 'success');
        });

        window.kickClient.onDownloadError((error) => {
            showNotification(`Indirme hatasi: ${error}`, 'error');
        });
    }

    // Initialize when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
