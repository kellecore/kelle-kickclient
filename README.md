# 🎮 Kelle KickClient

<div align="center">

![KickClient Logo](assets/icon.png)

**A powerful desktop client for Kick.com with live DVR recording & dynamic theming**

[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Mac%20%7C%20Linux-blueviolet.svg)](#)
[![Electron](https://img.shields.io/badge/electron-v39-47848F.svg?logo=electron)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933.svg?logo=node.js)](https://nodejs.org/)

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Building](#-building) • [Contributing](#-contributing)

</div>

---

## ⚡ Features

<table>
<tr>
<td width="50%">

### 🔴 Live DVR Recording
Record live streams in real-time with quality selection. Never miss a moment!

### 📥 VOD Downloading  
Download past broadcasts and clips directly to your device.

</td>
<td width="50%">

### 🎨 Dynamic Theming
Customizable text watermark overlay with SVG-based pattern generation.

### 🔄 Auto-Reconnect
Automatic reconnection on stream drops - seamless recording experience.

</td>
</tr>
</table>

---

## 🚀 Installation

### Prerequisites

| Requirement | Version |
|-------------|---------|
| [Node.js](https://nodejs.org/) | v18+ |
| [FFmpeg](https://ffmpeg.org/) | Latest |

### Quick Start

```bash
# Clone the repository
git clone https://github.com/kellecore/kelle-kickclient.git
cd kelle-kickclient

# Install dependencies
npm install

# Launch the app
npm start
```

---

## 🎮 Usage

<table>
<tr>
<td>

**1️⃣** Launch the application

**2️⃣** Navigate to any Kick.com channel

**3️⃣** Click the **Record** button in player controls

**4️⃣** Select your desired quality

**5️⃣** Recording saves to Downloads folder

</td>
<td>

### ⚙️ Settings

Click the gear icon (⚙️) in the bottom-right corner to customize:

- 📝 Watermark text overlay
- 🎨 Theme customization

</td>
</tr>
</table>

---

## 🏗️ Building

Build portable executables for distribution:

```bash
# Windows (Portable + Installer)
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

> 📁 Built files will be in the `dist/` folder

---

## 📂 Project Structure

```
kelle-kickclient/
├── 🎯 main.js          # Electron main process
├── 🔌 preload.js       # IPC bridge & UI injection  
├── 🎨 renderer.js      # UI logic & theming
├── 💅 styles.css       # Custom styles
├── 📁 assets/
│   └── 🖼️ icon.png     # Application icon
└── 📦 package.json     # Project configuration
```

---

## 🛠️ Technologies

<div align="center">

| Technology | Purpose |
|:----------:|:--------|
| ![Electron](https://img.shields.io/badge/-Electron-47848F?style=flat-square&logo=electron&logoColor=white) | Desktop application framework |
| ![Node.js](https://img.shields.io/badge/-Node.js-339933?style=flat-square&logo=node.js&logoColor=white) | Runtime environment |
| ![FFmpeg](https://img.shields.io/badge/-FFmpeg-007808?style=flat-square&logo=ffmpeg&logoColor=white) | Video processing |

</div>

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. 🍴 Fork the repository
2. 🌿 Create a feature branch (`git checkout -b feature/amazing`)
3. 💾 Commit changes (`git commit -m 'Add amazing feature'`)
4. 📤 Push to branch (`git push origin feature/amazing`)
5. 🎉 Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with 💚 by [kelle](https://github.com/kellecore)**

⭐ Star this repo if you find it useful!

</div>
