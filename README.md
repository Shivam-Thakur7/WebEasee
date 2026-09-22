# 🌐 WebEase — AI-Powered Accessibility Browser Companion

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/Frontend-React_19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Bundler-Vite_8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Chrome Extension](https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Azure AI](https://img.shields.io/badge/AI-Azure_AI_Foundry-0078D4?logo=microsoftazure&logoColor=white)](https://ai.azure.com)
[![Azure Speech](https://img.shields.io/badge/Voice-Azure_Neural_Speech-0078D4?logo=microsoftazure&logoColor=white)](https://azure.microsoft.com/en-us/products/ai-services/ai-speech)

> **WebEase** empowers users with physical and motor disabilities to navigate the modern web, control browser actions, and create or read documents entirely using natural voice commands.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Core Features](#-core-features)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
  - [1. Backend Setup](#1-backend-setup)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Frontend Setup & Build](#3-frontend-setup--build)
  - [4. Load Extension in Chrome / Edge](#4-load-extension-in-chrome--edge)
- [Voice & Command Reference](#-voice--command-reference)
- [API Endpoints](#-api-endpoints)
- [Accessibility Features & Shortcuts](#-accessibility-features--shortcuts)
- [Troubleshooting & Diagnostics](#-troubleshooting--diagnostics)
- [License](#-license)

---

## 📖 Overview

Many standard web interfaces and productivity tools require complex fine-motor mouse and keyboard interactions. **WebEase** bridges this barrier by combining:
1. **Azure AI Speech Services** for neural speech-to-text (STT) and expressive text-to-speech (TTS).
2. **Azure AI Foundry (LLM / Agent)** for intelligent intent understanding, context extraction, and tool execution.
3. **Chrome Extension (Manifest V3)** for live DOM execution directly inside active web tabs.
4. **FastAPI Python Backend** for secure API key encapsulation, document generation (`.docx`), and command auditing.

---

## 🏗 Architecture

```text
                         USER
                          │
                          ▼
                  🎤 MICROPHONE
                          │
                          ▼
                 Azure AI Speech
                  Speech → Text
                          │
                          ▼
                 Azure AI Foundry
                    LLM / Agent
                          │
                     Tool Calling
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
      Browser Tools             Document Tools
             │                         │
             ▼                         ▼
    WebEase Extension          Python Backend
             │                         │
             ▼                         ▼
          Browser                  .docx files
             │
             ▼
          Result
             │
             ▼
                 Azure AI Speech
                    Text → Speech
                          │
                          ▼
                     🔊 USER
```

---

## ✨ Core Features

### 1. 🎙 Natural Voice Control & Hands-Free Interaction
- **"Hello Agent" Wake Word Activation:** Automatically turns on the microphone when you say *"Hello Agent"* and plays an activation chime.
- **Smart Silence Detection (VAD):** Automatically detects 2-3 seconds of silence after speech and submits the command for immediate processing.
- **Continuous Visualizer:** Live audio waveform equalizer while listening or speaking.
- **High-fidelity Audio Conversion:** In-browser conversion to 16-bit PCM WAV for Azure Speech SDK.
- **Live Spoken Feedback:** Spoken confirmations via Azure Neural TTS for every action.
- **Seamless Navigation Control:** Any playing TTS/document audio immediately stops if you switch tabs or views.

### 2. 🧭 Full Browser Automation
- **Smooth Navigation:** Scroll up/down by custom amounts, back, and forward.
- **Smart Clicking:** Click elements by CSS selector, visible label, or button text.
- **Voice Typing:** Focus and input text with automatic `Enter` key emulation.
- **Element Finder:** Locate UI elements via natural language description and highlight them on-screen.
- **Direct Search & Media:** Search Google, Bing, Wikipedia, or play YouTube videos directly.

### 3. 📄 AI Document Studio
- **Document Generation:** Voice or prompt-based generation of clean, formatted `.docx` files.
- **Document Reader & Summarizer:** Upload `.docx` documents to extract content, generate AI summaries, and read aloud with Azure Neural TTS.

### 4. ♿ Accessibility Cockpit
- **High-Contrast (AAA) Mode:** High visibility yellow-on-black color scheme.
- **Large Text Mode:** One-click font scaling across all interface components.
- **Dark & Light Themes:** Adaptive themes designed for reduced eye strain.
- **Full Keyboard Navigation:** Global hotkeys for hands-free or switch-access users.

### 5. 📜 Command History & Replay
- Persistent local SQLite history database.
- Search past commands, view parsed tool parameters, and re-execute actions with one click.

---

## 📂 Project Structure

```text
WebEasee/
├── backend/
│   ├── main.py                     # FastAPI application entry point
│   ├── config.py                   # Environment configuration & security allow-list
│   ├── requirements.txt            # Python dependencies
│   ├── routes/
│   │   ├── voice.py                # STT, TTS, and voice processing routes
│   │   ├── commands.py             # Direct text command processing route
│   │   ├── documents.py            # .docx generation, reading, and download routes
│   │   └── history.py              # SQLite command history routes
│   ├── services/
│   │   ├── browser_service.py      # Browser tool argument validation & preparation
│   │   ├── document_service.py     # python-docx file generator and extractor
│   │   ├── foundry_service.py      # Azure AI Foundry LLM tool-calling agent
│   │   ├── speech_service.py       # Azure Speech-to-Text service
│   │   └── tts_service.py          # Azure Neural Text-to-Speech service
│   ├── tools/
│   │   ├── browser_tools.py        # Function schemas for browser automation
│   │   └── document_tools.py       # Function schemas for document operations
│   └── utils/
│       └── helpers.py              # SQLite database persistence & sanitization
│
├── frontend/
│   ├── manifest.json               # Chrome Extension Manifest V3 configuration
│   ├── package.json                # Frontend dependencies and build scripts
│   ├── vite.config.js              # Vite bundler with @crxjs plugin
│   ├── index.html                  # Side panel entry HTML
│   └── src/
│       ├── main.jsx                # React root mount
│       ├── App.jsx                 # App shell, theme provider, and tab switcher
│       ├── index.css               # Accessibility styles & design tokens
│       ├── background.js           # Extension background service worker
│       ├── content.js              # In-page DOM execution content script
│       ├── utils/
│       │   └── audio.js            # WebM to 16-bit PCM WAV converter
│       └── components/views/
│           ├── Dashboard.jsx       # Main voice cockpit & prompt actions
│           ├── Documents.jsx       # Document generator, reader & TTS player
│           ├── History.jsx         # Searchable command log with audio replay
│           └── Settings.jsx        # Azure status, theme & accessibility toggles
│
├── .env.example                    # Environment template
├── .gitignore                      # Git ignore rules
└── instructions.md                 # Development & architecture specifications
```

---

## 💻 Prerequisites

Ensure you have the following installed on your machine:
- **Python:** `3.10` or higher
- **Node.js:** `v18.0.0` or higher
- **Package Manager:** `npm` or `yarn`
- **Browser:** Google Chrome, Microsoft Edge, or any Chromium-based browser supporting Manifest V3 Side Panel API.
- **Azure Account:**
  - Azure AI Speech resource (Key & Region)
  - Azure AI Foundry / OpenAI endpoint (Endpoint URL, Key, Model Deployment name)

---

## 🚀 Getting Started

### 1. Backend Setup

1. Open your terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   - **Windows (PowerShell):**
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

---

### 2. Environment Configuration

Create a `.env` file in the root of the project (or copy `.env.example`):

```bash
# In project root
cp .env.example .env
```

Open `.env` and fill in your Azure credentials:

```ini
# Azure AI Speech (STT + TTS)
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=eastus

# Azure AI Foundry / Azure OpenAI (LLM)
AZURE_AI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_AI_API_KEY=your_azure_openai_key_here
AZURE_AI_MODEL=gpt-4.1-mini

# Backend Server Settings
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
CORS_ORIGINS=chrome-extension://*,http://localhost:*,http://127.0.0.1:*
```

Start the backend server:
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
Verify the backend is running by opening: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

### 3. Frontend Setup & Build

1. In a new terminal tab, navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Build the Chrome extension:
   ```bash
   npm run build
   ```
   *This generates the compiled production extension inside the `frontend/dist` directory.*

   *(Optional: For live development, you can run `npm run dev`)*

---

### 4. Load Extension in Chrome / Edge

1. Open your Chromium browser (Chrome or Edge).
2. Navigate to the extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select the `frontend/dist` directory from the file dialog.
6. Click the WebEase extension icon to open the **Side Panel** cockpit!

> 💡 **Tip:** Click on the extension side panel or pin the extension for immediate access across all tabs.

---

## 🗣 Voice & Command Reference

WebEase interprets natural conversational language. You can speak naturally, or try these example voice commands:

| Action | Example Voice Command | Executed Tool |
| :--- | :--- | :--- |
| **Open Website** | *"Open YouTube"* / *"Go to Wikipedia"* | `open_url` |
| **Search the Web** | *"Search Google for web accessibility guidelines"* | `search` |
| **Play Media** | *"Play Bohemian Rhapsody on YouTube"* | `play_video` |
| **Scroll Page** | *"Scroll down 400 pixels"* / *"Scroll up"* | `scroll` |
| **Click Elements** | *"Click the login button"* / *"Click Subscribe"* | `click` |
| **Voice Typing** | *"Type Hello World into the search box"* | `type_text` |
| **Find Element** | *"Find search bar on the screen"* | `find_element` |
| **Read Page Aloud** | *"Read this page to me"* | `read_page` |
| **Read Selection** | *"Read the selected text"* | `read_selected_text` |
| **Navigation** | *"Go back"* / *"Go forward"* | `go_back` / `go_forward` |
| **Create Document** | *"Draft a document summarizing modern AI trends"* | `generate_document` |

---

## 🔌 API Endpoints

The FastAPI server provides the following REST endpoints:

### Voice & Speech
- `POST /voice/transcribe` — Accepts a `.wav` audio upload and returns transcribed text.
- `POST /voice/process` — Full pipeline: Audio $\to$ Azure STT $\to$ Azure AI Foundry LLM $\to$ Validated Browser Action + Spoken TTS response.
- `POST /voice/speak` — Accepts text and returns synthesized neural `.wav` speech.

### Commands
- `POST /commands/text` — Accepts pre-transcribed text and routes it to Azure AI Foundry for tool calling.

### Documents
- `POST /documents/generate` — Prompts the LLM and creates a styled `.docx` file.
- `POST /documents/read?summarize=true` — Extracts text from an uploaded `.docx` and generates an AI summary.
- `GET /documents/download/{filename}` — Serves generated `.docx` files for download.

### History & Health
- `GET /history/?limit=50` — Retrieves the latest command history.
- `GET /history/search?q={query}` — Searches the history log.
- `DELETE /history/` — Clears the command history log.
- `GET /health` — Diagnostics check reporting Azure connectivity status.

---

## ⌨️ Accessibility Features & Shortcuts

- <kbd>Alt</kbd> + <kbd>V</kbd> — **Toggle Microphone** (Start / Stop listening)
- <kbd>Alt</kbd> + <kbd>1</kbd> — Switch to **Dashboard** tab
- <kbd>Alt</kbd> + <kbd>2</kbd> — Switch to **AI Document Studio** tab
- <kbd>Alt</kbd> + <kbd>3</kbd> — Switch to **Command History** tab
- <kbd>Alt</kbd> + <kbd>4</kbd> — Switch to **Settings & Diagnostics** tab
- **Live ARIA Announcer:** Screen reader support for real-time status notifications.
- **WCAG 2.1 AAA Compliant Contrast Mode.**

---

## 🛠 Troubleshooting & Diagnostics

- **"Backend Offline" badge:** Make sure the FastAPI server is running (`uvicorn main:app --reload --host 127.0.0.1 --port 8000`).
- **"Azure AI Foundry is not configured" / "AZURE_SPEECH_KEY not set":** Check your `.env` file in the root directory to confirm all keys and region values are set.
- **Microphone permission blocked in side panel:** Due to Chrome security policies for side panels, click the **"Grant Mic Access in New Tab"** button once to permit microphone access for the extension origin.
- **Changes in extension not appearing:** Run `npm run build` in `frontend/`, then click the reload icon (🔄) on the `chrome://extensions` page.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
