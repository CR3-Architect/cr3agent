<p align="center">
  <img src="build/icon_squircle_1024.png" width="128" height="128" alt="CR3-Agentic AI Logo" style="border-radius: 26px; box-shadow: 0 12px 32px rgba(0,0,0,0.35);" />
</p>

<h1 align="center">CR3-Agentic AI</h1>

<p align="center">
  <strong>Next-Gen Autonomous Desktop Agent Workspace for macOS</strong><br />
  Multi-step reasoning, native tool execution, interactive diff review & human-in-the-loop control.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.3.0-blue.svg?style=flat-square" alt="Version 0.3.0" />
  <img src="https://img.shields.io/badge/platform-macOS%2012+-orange.svg?style=flat-square" alt="macOS Supported" />
  <img src="https://img.shields.io/badge/electron-45.3.4-47848F.svg?style=flat-square" alt="Electron 45.3" />
  <img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/tests-61%2F61%20passing-success.svg?style=flat-square" alt="Tests Passing" />
</p>

---

## 🌟 Overview

**CR3-Agentic AI** is a professional desktop engineering workspace designed specifically for macOS. It bridges autonomous AI capabilities with safe developer environments, allowing LLMs to explore repositories, edit files with live syntax-highlighted diffs, execute terminal commands with real-time streaming, and manage complex multi-session workflows across projects.

Built on local-first principles, keys never leave your Mac, and operations run safely inside the workspace folders you explicitly open.

---

## ✨ Key Features

- 🧠 **Autonomous Agent Reasoning**: Multi-step plan generation, file read/write/edit tools, recursive search, and web-fetching capabilities.
- 🗂 **Persistent Workspace Hierarchy**: Organized sidebar tree grouping projects and conversations. Workspaces remain locked in place, with automatic session restoration on app restart.
- 📊 **VS Code-Style 50/50 Split & Unified Diffs**: Side-by-side split view with independent left/right horizontal scrolling and vivid syntax highlighting across TypeScript, JavaScript, Python, Rust, Go, HTML, CSS, and Shell.
- 💻 **Integrated Developer Terminal**: Bottom pane terminal for running builds, testing commands, and package installations.
- 🛡 **Human-in-the-Loop Approval & Rules**: Granular control over file writes and shell execution. Approve once, deny, or save *"Always Allow"* rules for trusted commands.
- ⚡ **Local & Cloud Model Support**:
  - **Local (Offline & Free)**: Ollama, LM Studio, vLLM.
  - **Cloud APIs**: Google Gemini, OpenRouter, Groq, Cerebras, Mistral, OpenAI, Anthropic.
  - **Auto-Fallback & Auto-Continue**: Automatically switches models if quota or rate limits hit, and seamlessly stitches responses that reach output limits.
- 📦 **Native macOS Experience**: Continuous Apple squircle icon curvature, hidden-inset traffic lights, native Keychain secret storage (`safeStorage`), and standard keyboard shortcuts (`⌘B`, `⌥⌘B`, `⌥⌘T`).

---

## 🚀 Getting Started

### Prerequisites
- macOS 12 Monterey or later (Apple Silicon & Intel)
- [Node.js](https://nodejs.org/) v20+ and npm

### Installation & Development Run

```bash
# Clone the repository
git clone https://github.com/CR3-Architect/cr3agent.git
cd cr3agent

# Install dependencies
npm install

# Build TypeScript and launch CR3-Agentic AI
npm start

# Run test suite (61 unit tests)
npm test
```

### Packaging macOS Release (.dmg & .zip)

To generate signed or local macOS distribution bundles:

```bash
npm run dist
```
Installers will be generated in `release/`:
- `release/CR3-Agentic AI-0.3.0.dmg`
- `release/CR3-Agentic AI-0.3.0-mac.zip`

---

## ⚙️ Model Provider Configuration

### 1. Local Models (100% Offline & Free)
Install and run [Ollama](https://ollama.ai):
```bash
brew install ollama
ollama pull qwen2.5-coder:7b    # Recommended for 16GB+ Macs (use 3b on 8GB Macs)
```
In the app: **Preferences** (`⌘,`) → **Providers & Models** → **Add Provider** → Select **Ollama** → Click **Save & Fetch Models**.

### 2. Cloud APIs (Gemini, OpenRouter, Groq, etc.)
1. Navigate to **Preferences** → **Providers & Models**.
2. Select your provider, paste your API key, and select your preferred model.
3. Keys are encrypted securely inside the native macOS Keychain.

---

## 📂 Project Architecture

```
Cr3agent/
├── src/                    # Electron Main Process (TypeScript)
│   ├── main.ts             # Window lifecycle, native menus, dock icon & IPC router
│   ├── workspace.ts        # Folder sandboxing and file boundary enforcement
│   ├── settings.ts         # Settings persistence, providers, and auto-fallback
│   ├── chatStore.ts        # Chat persistence, metadata & history storage
│   ├── agent/              # Autonomous agent core
│   │   ├── agent.ts        # ReAct loop, context budget management & streaming
│   │   ├── tools.ts        # Safe file read, write, edit, search & shell tools
│   │   └── rules.ts        # Always-allow permission engine
│   └── test/               # Comprehensive unit test suite (61 tests)
├── renderer/               # Desktop UI (HTML5, Modern CSS, Vanilla JS)
│   ├── index.html          # Main application structure & dialogs
│   ├── styles.css          # Design system, syntax tokens & animations
│   ├── renderer.js         # UI controller, tree rendering & session state
│   ├── diffview.js         # Unified & 50/50 split diff engine with syntax tokenization
│   └── md.js               # Fast Markdown & code block parser
├── build/                  # Native iconset, ICNS & installer configuration
└── package.json            # Electron-builder scripts & dependency specs
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
