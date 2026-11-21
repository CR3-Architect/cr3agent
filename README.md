# Cr3agent (macOS Local AI Agent)

A desktop AI coding agent designed for macOS with a modern Antigravity-style interface. It works safely inside the folder you pick, running on local AI models (Ollama, LM Studio) or free cloud APIs (OpenRouter, Google Gemini, Groq, Cerebras, etc.).

## Run it
Needs macOS and Node 20+.

    npm install
    npm start        # builds, then opens the app
    npm test         # builds, then runs all tests

## Local model (free)
    brew install ollama
    ollama pull qwen2.5-coder:7b     # on an 8GB Mac, 3b is safer
In the app: Settings → Providers → Add provider → Ollama → "Save & fetch models". The model must support tool calling.

## Cloud models
Settings → Providers → Add provider. Paste your key and click "Save & fetch models". You can add several providers/keys and switch from the model menu in the input bar. Keys are stored in the macOS Keychain (via Electron safeStorage).

## What is in it
- **Several chats at once.** Start a new chat in the same folder, or open another project, while others keep working. A dot in the sidebar shows which chats are running; click one to come back to it, including any question it is waiting on.
- **History** (sidebar): every project you opened, when, how often, how many chats, and which are working now.
- **Changes** panel: every file the agent changed, Before | After or Unified view, unchanged lines folded, Undo / Keep per file or all.
- **Approve once / Approve always / Deny.** "Always" saves a rule for that project (all file changes, one command such as `npm install`, or one website). Dangerous commands (`rm`, `sudo`, `curl`, `bash`, anything chained with `;` `&&` `|`) can never be made automatic. Rules are listed and removable in Settings → Agent.
- **Models**: add any number of providers and keys, switch model any time (even mid-chat). Free-plan presets: Ollama, LM Studio, OpenCode Zen, OpenRouter, Google Gemini, Groq, Cerebras, Mistral, NVIDIA NIM. If a model is rate-limited, out of credit or down, the app moves to the next provider's model by itself and keeps going. Replies that hit a model's output limit are continued automatically.
- **Git & GitHub** (header button): status, branches, commit, commit & push, pull, create a GitHub repository, push & open a pull request.
- **Accounts** (Settings → Accounts): GitHub (device sign-in or personal access token), Google (browser sign-in), Apple (explains what it needs).
- Terminal pane for installing CLIs and modules (non-interactive).
- Skills (SKILL.md folders): ~/.claude/skills, <project>/.agent/skills, app skills folder.
- Attachments: images, text files, links (paste, drag, or the paperclip).

## One-time setup for sign-in
- **GitHub**: github.com → Settings → Developer settings → OAuth Apps → New. Tick "Enable Device Flow". Paste its Client ID in Settings → Accounts → GitHub setup. Or skip this and paste a personal access token with the `repo` scope.
- **Google**: Google Cloud Console → Credentials → OAuth client ID → type "Desktop app". Paste the Client ID and secret.
- **Apple**: needs a paid Apple Developer account and an https address on your own domain. Not possible to ship inside a local app, so it is not active.
These are your own app registrations; I cannot create them for you.

## About "no limit"
Nothing is limited by this app except what you set in Settings → Agent (steps per message up to 300, memory per chat up to 2,000,000 characters). Real limits come from the model: its context window, its output length per reply, and the provider's free-tier rate limits. Auto-continue and auto-switch work around the output limit and rate limits, not around the context window.
For Ollama the default context is small (about 4k tokens) and silently cuts the conversation. Raise it: `OLLAMA_CONTEXT_LENGTH=16384 ollama serve` (or set `num_ctx` in a Modelfile).

## Honest limits
- Terminal is not an interactive PTY (no vim, no prompts).
- PDFs and Office files cannot be attached.
- Commands run as you and are not sandboxed; keep approval on "Ask first" until you trust the model.
- "Changes" compares with the folder as it was when opened (or last "Keep all"); it is not git.
- Chats working in the same folder at the same time can edit the same file; keep parallel chats on different tasks.
- Google/GitHub/Apple sign-in was tested against mock servers, not the real services.
- Not yet tested inside real Electron on macOS: expect a first-run bug or two.
# cr3agent
