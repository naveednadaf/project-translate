# Project Translate 🌐

A Open-source Chrome extension that translates webpages using AI (Ollama) or Argos Translate with a floating action button and real-time inline translations.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

- 🎯 **Floating Action Button** - Draggable button on any webpage
- 🤖 **AI-Powered** - Uses Ollama or Argos Translate for translations
- ⚡ **Real-time Translation** - Translations appear as they complete
- 🔄 **Toggle Slider** - Switch between original and translated text instantly
- 🛑 **Click to Cancel** - Click button during translation to stop and revert
- 🎨 **Smart Detection** - Automatically finds non-English text, skips emojis/symbols
- 🛑 **Abort on Refresh** - Cancels translations when page reloads
- ⚙️ **Customizable** - Configure model, concurrency, timeout, and more
- 🔒 **Privacy First** - All translations happen locally (Ollama or Argos)

## 📦 Installation

### From Source

1. **Clone or download** this repository
   ```bash
   git clone <repository-url>
   cd project-translate
   ```

2. **Open Chrome Extensions**
   - Go to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top-right)

3. **Load the extension**
   - Click **Load unpacked**
   - Select the `project-translate` folder

4. **Start using!**
   - Navigate to any webpage with non-English text
   - Click the floating 🌐 button to translate

## 🚀 Usage

### Basic Translation

1. **Click the floating button** (🌐) on any webpage
2. The extension scans for **non-English text**
3. Translations appear **in-place** as they complete
4. Button turns **green** when all translations are done
5. **Click again to cancel** while loading (shows ✖)

### Toggle Original/Translated

- Use the **slider below the button** to switch views
- **ON** (green) = Show translations
- **OFF** (gray) = Show original text
- No re-translation needed - instant toggle!

### Drag to Reposition

- **Click and drag** the floating button anywhere on the page
- The toggle slider moves with it

### Open Options

- **Right-click** the floating button
- Or **long-press** (1 second)
- Or go to `chrome://extensions/` → Project Translate → Options

## ⚙️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| **Translation Provider** | `ollama` | Choose between Ollama or Argos Translate |
| **Ollama Model** | `llama3.2` | Model to use (e.g., `llama3.2`, `qwen2.5:3b`) |
| **Argos Source Lang** | `auto` | Source language for Argos (or auto-detect) |
| **Argos URL** | `http://127.0.0.1:5000` | Argos Translate API endpoint |
| **Max Concurrent** | `3` | Parallel translation requests (1-10) |
| **Max Retries** | `2` | Retry attempts per failed translation (0-5) |
| **Timeout** | `30000` | Request timeout in milliseconds |
| **Ollama URL** | `http://localhost:11434` | Your Ollama API endpoint |

## 🔧 Requirements

### Option 1: Ollama Setup

1. **Install Ollama** from [ollama.ai](https://ollama.ai)

2. **Pull a model** (if not already installed)
   ```bash
   ollama pull llama3.2
   ```

3. **Start Ollama** (usually runs automatically)
   ```bash
   ollama serve
   ```

4. **Verify it's running**
   ```bash
   curl http://localhost:11434/api/tags
   ```

### Option 2: Argos Translate Setup (Recommended for VPN users)

Argos Translate is a lightweight, open-source translation engine that runs locally.

#### Quick Setup with Docker

```bash
# Stop and remove current container (if any)
docker stop argos-translate-api && docker rm argos-translate-api

# Run new container with localhost port binding
docker run -d --name argos-translate \
  -p 127.0.0.1:5000:5000 \
  --mount source=argos-translate-packages,target=/root/.local/share/argos-translate \
  argos-translate-argos-translate
```

#### Install Language Packages

Access the Argos web interface at `http://127.0.0.1:5000/docs` or use curl:

```bash
# Install Chinese to English package
curl -X POST "http://127.0.0.1:5000/install-package?from_code=zh&to_code=en"

# Install English to Spanish package
curl -X POST "http://127.0.0.1:5000/install-package?from_code=en&to_code=es"

# List installed packages
curl http://127.0.0.1:5000/installed-packages
```

#### Test the API

```bash
# Test translation
curl -X POST "http://127.0.0.1:5000/translate" \
  -H "Content-Type: application/json" \
  -d '{"q": "你好", "source": "zh", "target": "en"}'

# Expected output: {"translatedText":"Hello.","source":"zh","target":"en"}
```

#### Configure in Extension

1. Open extension Options page
2. Select **Translation Provider**: `Argos Translate (Local Server)`
3. Set **Argos URL**: `http://127.0.0.1:5000`
4. Click **Test Connection** to verify
5. Click **Install Package** to install required language pair
6. Click **Save Settings**

## ⚠️ Troubleshooting

### Connection Errors (403, 502, 503)

If you get connection errors when using Argos Translate:

#### 1. Check Proxy/VPN Settings

Your VPN or proxy software (Clash, Surge, etc.) may be intercepting local connections.

**Solution A: Add bypass rules to your proxy**

For **Clash**, add to `config.yaml`:
```yaml
rules:
  - IP-CIDR,127.0.0.0/8,DIRECT,no-resolve
  - IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
  - IP-CIDR,172.16.0.0/12,DIRECT,no-resolve
```

For **Surge**, add to `[Rule]` section:
```
IP-CIDR,127.0.0.0/8,DIRECT
IP-CIDR,192.168.0.0/16,DIRECT
IP-CIDR,172.16.0.0/12,DIRECT
```

**Solution B: Launch Chrome with proxy bypass**

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --proxy-bypass-list="192.168.*.*;172.16.0.0/12;10.0.0.0/8;localhost;127.0.0.1"
```

**Solution C: Use reverse proxy**

```bash
# Install socat
brew install socat

# Create reverse proxy on non-standard port
socat TCP-LISTEN:5001,fork TCP:192.168.107.2:5000

# Then use http://127.0.0.1:5001 in extension
```

#### 2. Verify Argos is Running

```bash
# Test with explicit IPv4
curl http://127.0.0.1:5000/

# Expected: {"service":"Argos Translate API","status":"running","docs":"/docs"}
```

#### 3. Check Docker Container

```bash
# Verify container is running
docker ps --filter "name=argos-translate"

# Check logs for errors
docker logs argos-translate
```

#### 4. Port Already in Use (AirTunes on macOS)

macOS uses port 5000 for AirTunes. Use a different port:

```bash
# Run Argos on port 5001 instead
docker run -d --name argos-translate -p 127.0.0.1:5001:5000 argos-translate-argos-translate
```

Then use `http://127.0.0.1:5001` in the extension.

### Common Issues

| Issue | Solution |
|-------|----------|
| No translations appear | Check if Ollama/Argos is running |
| Button not visible | Refresh the page after loading extension |
| API errors | Verify URL in options, check proxy settings |
| Slow translations | Reduce "Max Concurrent" in options |
| 403 Forbidden | Proxy/VPN intercepting - add bypass rules |
| 502 Bad Gateway | Server unreachable - check Docker container |
| Connection timeout | Firewall blocking - allow port 5000 |

## 📁 Project Structure

```
project-translate/
├── manifest.json       # Extension configuration
├── background.js       # Service worker (API calls, queue management)
├── content.js          # Content script (DOM manipulation, UI)
├── styles.css          # Button and toggle styles
├── options.html        # Settings page
├── options.js          # Settings logic
├── README.md           # This file
└── TODO.md             # Planned features
```

## 🎯 How It Works

1. **Text Detection** - TreeWalker scans page for non-English text nodes
2. **Filtering** - Skips emojis, symbols, arrows, and meaningless text
3. **Queue System** - Sends texts to API (3 at a time by default)
4. **Response Parsing** - Parses translation response
5. **Inline Replacement** - Replaces text nodes directly in the DOM
6. **Caching** - Stores original + translated for instant toggle

## 🛠️ Development

### Debugging

- **Content Script**: Open DevTools (F12) on any webpage
- **Background Script**: `chrome://extensions/` → Project Translate → Service Worker
- **Options Page**: Right-click → Inspect

### Modify AI Prompt

Edit `background.js` → `translateWithOllama()` function to customize the translation prompt.

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📋 Roadmap

See [TODO.md](TODO.md) for planned features and improvements.

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai) - Local AI runtime
- [Argos Translate](https://github.com/argosopentech/argos-translate) - Open-source translation engine
- [Chrome Extensions](https://developer.chrome.com/docs/extensions/) - Extension platform

## 📧 Support

- **Issues**: Open an issue on GitHub
- **Discussions**: Start a discussion for questions or ideas

---

**Enjoy translating the web! 🌐**
