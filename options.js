// Default settings
const DEFAULTS = {
  model: 'llama3.2',
  targetLanguage: 'English',
  maxConcurrent: 3,
  maxRetries: 2,
  timeout: 30000,
  ollamaUrl: 'http://localhost:11434'
};

// Load settings on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Load from storage
  const result = await chrome.storage.sync.get(DEFAULTS);

  // Populate form
  document.getElementById('model').value = result.model;
  document.getElementById('targetLanguage').value = result.targetLanguage;
  document.getElementById('maxConcurrent').value = result.maxConcurrent;
  document.getElementById('maxRetries').value = result.maxRetries;
  document.getElementById('timeout').value = result.timeout;
  document.getElementById('ollamaUrl').value = result.ollamaUrl;

  // Save button
  document.getElementById('save').addEventListener('click', saveSettings);

  // Reset button
  document.getElementById('reset').addEventListener('click', resetSettings);
});

async function saveSettings() {
  const model = document.getElementById('model').value.trim() || DEFAULTS.model;
  const targetLanguage = document.getElementById('targetLanguage').value || DEFAULTS.targetLanguage;
  const maxConcurrent = parseInt(document.getElementById('maxConcurrent').value) || DEFAULTS.maxConcurrent;
  const maxRetries = parseInt(document.getElementById('maxRetries').value) || DEFAULTS.maxRetries;
  const timeout = parseInt(document.getElementById('timeout').value) || DEFAULTS.timeout;
  const ollamaUrl = document.getElementById('ollamaUrl').value.trim() || DEFAULTS.ollamaUrl;
  
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
    model,
    targetLanguage,
    maxConcurrent,
    maxRetries,
    timeout,
    ollamaUrl
  });
  
  // Notify background script to reload settings
  chrome.runtime.sendMessage({ action: 'reloadSettings' });
  
  showStatus('Settings saved successfully!', 'success');
}

async function resetSettings() {
  await chrome.storage.sync.set(DEFAULTS);

  // Populate form with defaults
  document.getElementById('model').value = DEFAULTS.model;
  document.getElementById('targetLanguage').value = DEFAULTS.targetLanguage;
  document.getElementById('maxConcurrent').value = DEFAULTS.maxConcurrent;
  document.getElementById('maxRetries').value = DEFAULTS.maxRetries;
  document.getElementById('timeout').value = DEFAULTS.timeout;
  document.getElementById('ollamaUrl').value = DEFAULTS.ollamaUrl;
  
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
