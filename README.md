# Project Translate 🌐

A Chrome extension that translates non-English text on webpages using AI (Ollama) with a floating action button and real-time inline translations.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

- 🎯 **Floating Action Button** - Draggable button on any webpage
- 🤖 **AI-Powered** - Uses Ollama for translations (runs locally!)
- ⚡ **Real-time Translation** - Translations appear as they complete
- 🔄 **Toggle Slider** - Switch between original and translated text instantly
- 🛑 **Click to Cancel** - Click button during translation to stop and revert
- 🎨 **Smart Detection** - Automatically finds non-English text, skips emojis/symbols
- 🛑 **Abort on Refresh** - Cancels translations when page reloads
- ⚙️ **Customizable** - Configure model, concurrency, timeout, and more
- 🔒 **Privacy First** - All translations happen locally via Ollama

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
| **Ollama Model** | `llama3.2` | Model to use (e.g., `llama3.2`, `qwen2.5:3b`) |
| **Max Concurrent** | `3` | Parallel translation requests (1-10) |
| **Max Retries** | `2` | Retry attempts per failed translation (0-5) |
| **Timeout** | `30000` | Request timeout in milliseconds |
| **Ollama URL** | `http://localhost:11434` | Your Ollama API endpoint |

## 🔧 Requirements

### Ollama Setup

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
3. **Queue System** - Sends texts to Ollama (3 at a time by default)
4. **JSON Parsing** - AI responds with `{translation, success}` format
5. **Inline Replacement** - Replaces text nodes directly in the DOM
6. **Caching** - Stores original + translated for instant toggle

## 🛠️ Development

### Debugging

- **Content Script**: Open DevTools (F12) on any webpage
- **Background Script**: `chrome://extensions/` → Project Translate → Service Worker
- **Options Page**: Right-click → Inspect

### Common Issues

| Issue | Solution |
|-------|----------|
| No translations appear | Check if Ollama is running (`ollama serve`) |
| Button not visible | Refresh the page after loading extension |
| API errors | Verify Ollama URL in options |
| Slow translations | Reduce "Max Concurrent" in options |

### Modify AI Prompt

Edit `background.js` → `translateWithTimeout()` function to customize the translation prompt.

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
- [Chrome Extensions](https://developer.chrome.com/docs/extensions/) - Extension platform

## 📧 Support

- **Issues**: Open an issue on GitHub
- **Discussions**: Start a discussion for questions or ideas

---

**Enjoy translating the web! 🌐**
