# Project Translate - TODO

## Planned Features

### 🎨 Loading Button Customization
- [ ] Custom icon selection (emoji, SVG, or image upload)
- [ ] Custom color picker for button gradient
- [ ] Save preferences to `chrome.storage.sync`
- [ ] Add customization panel in options page
- [ ] Preset themes (Purple, Blue, Green, Red, etc.)

### 🌐 External Translation Services
- [ ] Add Google Translate API option
- [ ] Add Microsoft Bing Translate API option
- [ ] Add DeepL API option
- [ ] Add LibreTranslate (open-source) option
- [ ] Allow users to select preferred translation service in options
- [ ] Store API keys securely in `chrome.storage.sync`
- [ ] Fallback chain (try Ollama first, then fallback to others)

### 🔧 Additional Improvements
- [ ] Add keyboard shortcut to toggle translations (e.g., Ctrl+Shift+T)
- [ ] Add context menu option to translate selected text only
- [ ] Add language detection (auto-detect source language)
- [ ] Add target language selector in options
- [ ] Add translation history log
- [ ] Add export translations feature
- [ ] Add dark mode for options page
- [ ] Add statistics (words translated, time saved, etc.)

### 🐛 Bug Fixes & Optimization
- [ ] Optimize TreeWalker for large pages
- [ ] Add debouncing for rapid clicks
- [ ] Handle dynamic content (SPA navigation)
- [ ] Add error recovery for failed API calls
- [ ] Add rate limiting warnings
- [ ] Improve memory management for large translations

---

## Version History

### v1.0.0 (Current)
- ✅ Floating button with drag support
- ✅ Ollama API integration
- ✅ Queue system with retry logic
- ✅ Real-time translation replacement
- ✅ Toggle slider to switch original/translated
- ✅ Non-English text detection
- ✅ Emoji/symbol filtering
- ✅ JSON response parsing
- ✅ Abort on tab close/refresh
- ✅ Customizable settings (model, concurrency, timeout)
- ✅ Session-only translations (clears on reload)

---

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

For major changes, please open an issue first to discuss.
