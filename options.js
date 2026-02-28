// Default settings
const DEFAULTS = {
  model: 'llama3.2',
  targetLanguage: 'English',
  maxConcurrent: 3,
  maxRetries: 2,
  timeout: 30000,
  ollamaUrl: 'http://localhost:11434',
  argosUrl: 'http://192.168.107.2:5000',
  argosSourceLang: 'auto',
  translationProvider: 'ollama'
};

// Toggle settings sections based on provider
function toggleSettings() {
  const providerSelect = document.getElementById('translationProvider');
  const ollamaSettings = document.getElementById('ollama-settings');
  const argosSettings = document.getElementById('argos-settings');

  if (!providerSelect || !ollamaSettings || !argosSettings) return;

  const provider = providerSelect.value;
  if (provider === 'ollama') {
    ollamaSettings.style.display = 'block';
    argosSettings.style.display = 'none';
  } else if (provider === 'argos') {
    ollamaSettings.style.display = 'none';
    argosSettings.style.display = 'block';
  }
}

// Load settings on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Load from storage
  const result = await chrome.storage.sync.get(DEFAULTS);

  // Populate form
  document.getElementById('translationProvider').value = result.translationProvider;
  document.getElementById('model').value = result.model;
  document.getElementById('targetLanguage').value = result.targetLanguage;
  document.getElementById('maxConcurrent').value = result.maxConcurrent;
  document.getElementById('maxRetries').value = result.maxRetries;
  document.getElementById('timeout').value = result.timeout;
  document.getElementById('ollamaUrl').value = result.ollamaUrl;
  document.getElementById('argosUrl').value = result.argosUrl;
  document.getElementById('argosSourceLang').value = result.argosSourceLang;

  // Toggle visibility based on selected provider
  toggleSettings();

  // Save button
  document.getElementById('save').addEventListener('click', saveSettings);

  // Reset button
  document.getElementById('reset').addEventListener('click', resetSettings);

  // Provider change listener
  document.getElementById('translationProvider').addEventListener('change', toggleSettings);

  // Test connection button
  document.getElementById('testConnection').addEventListener('click', testConnection);

  // Install package button
  document.getElementById('installPackage').addEventListener('click', installPackage);
});

async function saveSettings() {
  const translationProvider = document.getElementById('translationProvider').value || DEFAULTS.translationProvider;
  const model = document.getElementById('model').value.trim() || DEFAULTS.model;
  const targetLanguage = document.getElementById('targetLanguage').value || DEFAULTS.targetLanguage;
  const maxConcurrent = parseInt(document.getElementById('maxConcurrent').value) || DEFAULTS.maxConcurrent;
  const maxRetries = parseInt(document.getElementById('maxRetries').value) || DEFAULTS.maxRetries;
  const timeout = parseInt(document.getElementById('timeout').value) || DEFAULTS.timeout;
  const ollamaUrl = document.getElementById('ollamaUrl').value.trim() || DEFAULTS.ollamaUrl;
  const argosUrl = document.getElementById('argosUrl').value.trim() || DEFAULTS.argosUrl;
  const argosSourceLang = document.getElementById('argosSourceLang').value || DEFAULTS.argosSourceLang;

  console.log('💾 Saving settings:', {
    translationProvider,
    model,
    targetLanguage,
    ollamaUrl,
    argosUrl,
    argosSourceLang
  });

  // Validate
  const errors = [];
  if (maxConcurrent < 1 || maxConcurrent > 10) {
    errors.push('Max Concurrent must be between 1 and 10');
  }
  if (maxRetries < 0 || maxRetries > 5) {
    errors.push('Max Retries must be between 0 and 5');
  }
  if (timeout < 5000 || timeout > 120000) {
    errors.push('Timeout must be between 5000 and 120000');
  }

  if (errors.length > 0) {
    showStatus(errors.join('\n'), 'error');
    return;
  }

  // Save to storage
  await chrome.storage.sync.set({
    translationProvider,
    model,
    targetLanguage,
    maxConcurrent,
    maxRetries,
    timeout,
    ollamaUrl,
    argosUrl,
    argosSourceLang
  });

  console.log('✅ Settings saved to storage');

  // Notify background script to reload settings
  chrome.runtime.sendMessage({ action: 'reloadSettings' }, (response) => {
    console.log('📬 Background script response:', response);
  });

  showStatus('Settings saved successfully!', 'success');
}

async function resetSettings() {
  await chrome.storage.sync.set(DEFAULTS);

  // Populate form with defaults
  document.getElementById('translationProvider').value = DEFAULTS.translationProvider;
  document.getElementById('model').value = DEFAULTS.model;
  document.getElementById('targetLanguage').value = DEFAULTS.targetLanguage;
  document.getElementById('maxConcurrent').value = DEFAULTS.maxConcurrent;
  document.getElementById('maxRetries').value = DEFAULTS.maxRetries;
  document.getElementById('timeout').value = DEFAULTS.timeout;
  document.getElementById('ollamaUrl').value = DEFAULTS.ollamaUrl;
  document.getElementById('argosUrl').value = DEFAULTS.argosUrl;
  document.getElementById('argosSourceLang').value = DEFAULTS.argosSourceLang;

  // Notify background script
  chrome.runtime.sendMessage({ action: 'reloadSettings' });

  showStatus('Settings reset to defaults', 'success');
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = type;

  setTimeout(() => {
    status.className = '';
  }, 3000);
}

// Test Argos connection
async function testConnection() {
  const argosUrl = document.getElementById('argosUrl').value.trim() || DEFAULTS.argosUrl;
  const statusEl = document.getElementById('packageStatus');

  statusEl.style.display = 'block';
  statusEl.style.background = '#fff3cd';
  statusEl.textContent = '⏳ Testing connection...';

  const targetLang = document.getElementById('targetLanguage').value;
  const langCodeMap = {
    'English': 'en', 'Spanish': 'es', 'French': 'fr', 'German': 'de',
    'Chinese': 'zh', 'Japanese': 'ja', 'Korean': 'ko', 'Portuguese': 'pt',
    'Russian': 'ru', 'Italian': 'it', 'Dutch': 'nl', 'Hindi': 'hi'
  };
  const targetCode = langCodeMap[targetLang] || 'en';

  try {
    // Send message to background script to test connection
    chrome.runtime.sendMessage({
      action: 'testArgosConnection',
      argosUrl: argosUrl,
      targetCode: targetCode,
      targetLang: targetLang
    }, (response) => {
      if (!response) {
        statusEl.style.background = '#f8d7da';
        statusEl.innerHTML = `❌ <strong>Connection failed!</strong><br>No response from background script.<br><br>Try reloading the extension.`;
        return;
      }

      if (response.success) {
        if (response.packageInstalled) {
          statusEl.style.background = '#d4edda';
          statusEl.innerHTML = `✅ <strong>Connected!</strong><br>Server: ${argosUrl}<br>Language package for ${targetLang} is installed.`;
        } else {
          statusEl.style.background = '#fff3cd';
          statusEl.innerHTML = `⚠️ <strong>Connected!</strong><br>Server: ${argosUrl}<br>⚠️ Language package for <strong>${targetLang}</strong> is NOT installed. Click "Install Package" to install it.`;
        }
      } else {
        statusEl.style.background = '#f8d7da';
        statusEl.innerHTML = `❌ <strong>Connection failed!</strong><br>URL: ${argosUrl}<br>Error: ${response.error}<br><br>Make sure:<br>1. Argos Translate server is running<br>2. The URL is correct (check IP address)<br>3. Your computer can reach the server`;
      }
    });

  } catch (error) {
    statusEl.style.background = '#f8d7da';
    statusEl.innerHTML = `❌ <strong>Connection failed!</strong><br>URL: ${argosUrl}<br>Error: ${error.message}<br><br>Make sure:<br>1. Argos Translate server is running<br>2. The URL is correct (check IP address)<br>3. Your computer can reach the server`;
  }
}

// Install language package
async function installPackage() {
  const argosUrl = document.getElementById('argosUrl').value.trim() || DEFAULTS.argosUrl;
  const statusEl = document.getElementById('packageStatus');

  const targetLang = document.getElementById('targetLanguage').value;
  const langCodeMap = {
    'English': 'en', 'Spanish': 'es', 'French': 'fr', 'German': 'de',
    'Chinese': 'zh', 'Japanese': 'ja', 'Korean': 'ko', 'Portuguese': 'pt',
    'Russian': 'ru', 'Italian': 'it', 'Dutch': 'nl', 'Hindi': 'hi'
  };
  const targetCode = langCodeMap[targetLang] || 'en';

  statusEl.style.display = 'block';
  statusEl.style.background = '#fff3cd';
  statusEl.innerHTML = `⏳ Installing language package for ${targetLang}...`;

  try {
    // Send message to background script to install package
    chrome.runtime.sendMessage({
      action: 'installArgosPackage',
      argosUrl: argosUrl,
      fromCode: 'zh',
      toCode: targetCode,
      targetLang: targetLang
    }, (response) => {
      if (!response) {
        statusEl.style.background = '#f8d7da';
        statusEl.innerHTML = `❌ <strong>Installation failed!</strong><br>No response from background script.`;
        return;
      }

      if (response.success) {
        statusEl.style.background = '#d4edda';
        statusEl.innerHTML = `✅ Language package installed successfully!<br>You can now translate from Chinese to ${targetLang}.`;
        setTimeout(() => testConnection(), 1000);
      } else {
        statusEl.style.background = '#f8d7da';
        statusEl.innerHTML = `❌ <strong>Installation failed!</strong><br>Error: ${response.error}<br><br>The package might already be installed, or there's a network issue.`;
      }
    });

  } catch (error) {
    statusEl.style.background = '#f8d7da';
    statusEl.innerHTML = `❌ <strong>Installation failed!</strong><br>Error: ${error.message}<br><br>The package might already be installed, or there's a network issue.`;
  }
}
