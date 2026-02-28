// Ollama API configuration - will be loaded from storage
let OLLAMA_API_URL = 'http://localhost:11434/api/generate';
let ARGOS_API_URL = 'http://192.168.107.2:5000/translate';
let ARGOS_SOURCE_LANG = 'auto';
let OLLAMA_MODEL = 'llama3.2';
let TARGET_LANGUAGE = 'English';
let MAX_CONCURRENT = 3;
let MAX_RETRIES = 2;
let TIMEOUT_MS = 30000;
let TRANSLATION_PROVIDER = 'ollama';

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

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(DEFAULTS);
    OLLAMA_MODEL = result.model || DEFAULTS.model;
    TARGET_LANGUAGE = result.targetLanguage || DEFAULTS.targetLanguage;
    MAX_CONCURRENT = result.maxConcurrent || DEFAULTS.maxConcurrent;
    MAX_RETRIES = result.maxRetries || DEFAULTS.maxRetries;
    TIMEOUT_MS = result.timeout || DEFAULTS.timeout;
    OLLAMA_API_URL = (result.ollamaUrl || DEFAULTS.ollamaUrl).replace(/\/$/, '') + '/api/generate';
    ARGOS_API_URL = (result.argosUrl || DEFAULTS.argosUrl).replace(/\/$/, '') + '/translate';
    TRANSLATION_PROVIDER = result.translationProvider || DEFAULTS.translationProvider;
    ARGOS_SOURCE_LANG = result.argosSourceLang || DEFAULTS.argosSourceLang;

    console.log('📊 Settings loaded from storage:', {
      provider: TRANSLATION_PROVIDER,
      model: OLLAMA_MODEL,
      targetLanguage: TARGET_LANGUAGE,
      maxConcurrent: MAX_CONCURRENT,
      maxRetries: MAX_RETRIES,
      timeout: TIMEOUT_MS,
      ollamaUrl: OLLAMA_API_URL,
      argosUrl: ARGOS_API_URL
    });
  } catch (error) {
    console.error('❌ Failed to load settings:', error);
  }
}

// Load settings on startup
loadSettings();

// Configure proxy bypass for Argos server (to work with VPN/proxy)
// Note: Chrome extensions can't directly bypass proxy, but we can use XMLHttpRequest
// which sometimes bypasses proxy when connecting to local addresses

// Pending responses tracker
const pendingResponses = new Map();
const tabBatches = new Map(); // Track batches per tab
const activeControllers = new Map(); // Track AbortControllers for in-progress requests

// Queue item structure
class QueueItem {
  constructor(text, targetLanguage, id, tabId) {
    this.text = text;
    this.targetLanguage = targetLanguage;
    this.retryCount = 0;
    this.id = id;
    this.tabId = tabId;
  }
}

// Listen for tab close/refresh
chrome.tabs.onRemoved.addListener((tabId) => {
  console.log(`🚫 Tab ${tabId} closed event`);
  cancelTabBatches(tabId);
});

// Also listen for tab update (handles page refresh)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only cancel on full page reload, not sub-frame loads
  if (changeInfo.status === 'loading' && tab.url && !tab.url.startsWith('about:')) {
    console.log(`🚫 Tab ${tabId} loading event (possible refresh)`);
    // Don't cancel immediately - wait for actual navigation
    setTimeout(() => {
      // Check if batches still exist for this tab
      const batches = tabBatches.get(tabId);
      if (batches && batches.length > 0) {
        console.log(`🚫 Confirmed refresh for tab ${tabId}, cancelling ${batches.length} batches`);
        cancelTabBatches(tabId);
      }
    }, 500);
  }
});

// Cancel all batches for a tab
function cancelTabBatches(tabId) {
  const batches = tabBatches.get(tabId) || [];
  console.log(`🗑️ Cancelling ${batches.length} batches for tab ${tabId}`);

  batches.forEach(batchId => {
    const pending = pendingResponses.get(batchId);
    if (pending) {
      console.log(`🗑️ Cancelled batch ${batchId}`);
      pendingResponses.delete(batchId);
    }
  });
  tabBatches.delete(tabId);

  // Abort all in-progress API requests for this tab
  let abortedCount = 0;
  activeControllers.forEach((item, requestId) => {
    // Check if this request belongs to any of the cancelled batches
    const belongsToCancelledBatch = batches.some(bid => requestId.startsWith(`${bid}_`));
    if (belongsToCancelledBatch) {
      console.log(`🚫 Aborting request: ${requestId}`);
      item.controller.abort();
      item.timeoutId && clearTimeout(item.timeoutId);
      activeControllers.delete(requestId);
      abortedCount++;
    }
  });

  console.log(`📊 Aborted ${abortedCount} in-progress API requests`);
  console.log('📊 Remaining batches:', pendingResponses.size);
}

// Queue manager
class TranslationQueue {
  constructor(maxConcurrent) {
    this.queue = [];
    this.activeCount = 0;
    this.maxConcurrent = maxConcurrent;
  }

  add(item) {
    console.log(`📥 Queued: "${item.text.substring(0, 20)}..." (position: ${this.queue.length + 1})`);
    this.queue.push(item);
    this.process();
  }

  async process() {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift();
      this.activeCount++;

      // Process without blocking
      this.execute(item).finally(() => {
        this.activeCount--;
        this.process(); // Check if more can run
      });
    }
  }

  async execute(item) {
    // Check if batch still exists in pendingResponses
    const pending = pendingResponses.get(item.id);
    if (!pending) {
      console.log(`🚫 Skipping batch ${item.id} - batch was cancelled`);
      return;
    }

    // Create unique request ID for this specific translation
    const requestId = `${item.id}_${Date.now()}_${Math.random()}`;

    try {
      console.log(`🟢 Starting: "${item.text.substring(0, 20)}..." (attempt ${item.retryCount + 1}/${MAX_RETRIES + 1}, batch: ${item.id}, tab: ${item.tabId})`);

      const result = await translateWithTimeout(item.text, item.targetLanguage, requestId);

      console.log(`✅ Success: "${item.text.substring(0, 20)}..." (batch: ${item.id})`);
      this.completeItem(item.id, {
        success: true,
        data: result.text,
        text: item.text,
        aiSuccess: result.success // Pass AI's success flag
      });

    } catch (error) {
      console.warn(`⚠️ Failed: "${item.text.substring(0, 20)}..." - ${error.message} (batch: ${item.id})`);

      // Check if this was an abort (tab closed/refreshed)
      if (error.message === 'Aborted (tab closed)') {
        console.log(`🚫 Request cancelled - not retrying`);
        return;
      }

      // Re-check if batch still exists
      const stillPending = pendingResponses.get(item.id);
      if (!stillPending) {
        console.log(`🚫 Aborting retry - batch was cancelled`);
        return;
      }

      // Retry if under limit
      if (item.retryCount < MAX_RETRIES) {
        item.retryCount++;
        console.log(`🔄 Retrying: "${item.text.substring(0, 20)}..." (attempt ${item.retryCount + 1}/${MAX_RETRIES + 1}, batch: ${item.id})`);

        // Add back to end of queue
        this.queue.push(item);
      } else {
        console.error(`❌ Max retries reached: "${item.text.substring(0, 20)}..." (batch: ${item.id})`);
        this.completeItem(item.id, { success: false, error: error.message, text: item.text, retries: item.retryCount });
      }
    }
  }

  completeItem(id, result) {
    const pending = pendingResponses.get(id);
    if (pending) {
      // Check if tab was closed
      const tabBatchesForTab = tabBatches.get(pending.tabId) || [];
      if (!tabBatchesForTab.includes(id)) {
        console.log(`🚫 Skipping result for batch ${id} - tab was closed`);
        pendingResponses.delete(id);
        return;
      }

      pending.results.push(result);
      pending.completed++;

      console.log(`📦 Batch ${id}: ${pending.completed}/${pending.total} complete`);

      // Save EACH result immediately for instant replacement
      const storageKey = `translation_${id}_${pending.completed}`;
      const storageData = {
        batchId: id,
        itemIndex: pending.completed,
        data: result,
        isComplete: pending.completed >= pending.total,
        timestamp: Date.now()
      };

      console.log('📤 Saving individual result to storage:', storageKey);

      chrome.storage.local.set({
        [storageKey]: storageData
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('❌ Storage save failed:', chrome.runtime.lastError.message);
        } else {
          console.log('✅ Individual result saved');
        }
      });

      // Check if all items in this batch are done
      if (pending.completed >= pending.total) {
        const info = this.getQueueInfo();
        console.log('📊 Queue status:', info);
        console.log('📊 Batch complete!');
        pendingResponses.delete(id);
      }
    } else {
      console.error(`❌ Batch ${id} not found in pendingResponses!`);
      console.log('Available batches:', Array.from(pendingResponses.keys()));
    }
  }

  getQueueInfo() {
    return {
      queued: this.queue.length,
      active: this.activeCount
    };
  }
}

// Create global queue
const translationQueue = new TranslationQueue(MAX_CONCURRENT);

// Translate with timeout
async function translateWithTimeout(text, targetLanguage, requestId) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Store controller for cancellation
  activeControllers.set(requestId, { controller, timeoutId });

  try {
    // Use the targetLanguage parameter if provided, otherwise use global setting
    const lang = targetLanguage || TARGET_LANGUAGE;

    console.log(`🔧 Using provider: ${TRANSLATION_PROVIDER}, lang: ${lang}`);

    // Use selected provider
    if (TRANSLATION_PROVIDER === 'argos') {
      console.log(`🌐 Calling Argos API: ${ARGOS_API_URL}`);
      return await translateWithArgos(text, lang, controller, timeoutId, requestId);
    } else {
      console.log(`🤖 Calling Ollama API: ${OLLAMA_API_URL}`);
      return await translateWithOllama(text, lang, controller, timeoutId, requestId);
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || error.message === 'Aborted') {
      console.log(`🚫 Request aborted: "${text.substring(0, 20)}..."`);
      throw new Error('Aborted (tab closed)');
    }
    throw error;
  } finally {
    activeControllers.delete(requestId);
  }
}

// Translate using Argos Translate API
async function translateWithArgos(text, targetLanguage, controller, timeoutId, requestId) {
  const langMap = {
    'English': 'en',
    'Spanish': 'es',
    'French': 'fr',
    'German': 'de',
    'Chinese': 'zh',
    'Japanese': 'ja',
    'Korean': 'ko',
    'Portuguese': 'pt',
    'Russian': 'ru',
    'Italian': 'it',
    'Dutch': 'nl',
    'Hindi': 'hi'
  };

  const targetCode = langMap[targetLanguage] || 'en';

  // Use configured source language or auto-detect
  let sourceCode = ARGOS_SOURCE_LANG;
  if (sourceCode === 'auto') {
    sourceCode = detectSourceLanguageCode(text);
  }

  try {
    console.log(`📡 Argos request: text="${text.substring(0, 30)}...", source=${sourceCode}, target=${targetCode}`);

    const response = await fetch(ARGOS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({
        q: text,
        source: sourceCode,
        target: targetCode
      }),
      signal: controller.signal,
      cache: 'no-store'
    });

    console.log(`📡 Argos response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Argos API error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`📡 Argos response data:`, data);

    const translatedText = data.translatedText || text;

    console.log(`🌐 Argos translation: "${text.substring(0, 20)}..." → "${translatedText.substring(0, 20)}..."`);

    return {
      text: translatedText,
      success: true
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || error.message === 'Aborted') {
      throw new Error('Aborted (tab closed)');
    }
    throw error;
  }
}

// Detect source language code from text
function detectSourceLanguageCode(text) {
  // Check for Chinese characters
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  // Check for Japanese (hiragana/katakana)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja';
  // Check for Korean
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
  // Check for Russian/Cyrillic
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  // Check for Hindi/Devanagari
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  // Check for Arabic
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  // Check for Thai
  if (/[\u0E00-\u0E7F]/.test(text)) return 'th';
  // Check for Hebrew
  if (/[\u0590-\u05FF]/.test(text)) return 'he';

  // Default to English for Latin script
  return 'en';
}

// Translate using Ollama API
async function translateWithOllama(text, targetLanguage, controller, timeoutId, requestId) {
  const prompt = `Translate the following text to ${targetLanguage}.
Respond ONLY with a valid JSON object in this exact format:
{"translation": "your translation here", "success": true}

RULES:
- Return ONLY the JSON, no other text
- If you CANNOT translate, return the ORIGINAL text with success: false
  Example: {"translation": "original text here", "success": false}
- If you CAN translate, return the translation with success: true
  Example: {"translation": "translated text", "success": true}
- Do NOT explain grammar or particles
- If a word has no direct equivalent, use the closest equivalent

Text to translate: ${text}`;

  try {
    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawResponse = data.response.trim();

    // Parse JSON response
    try {
      // Try to extract JSON from response (in case there's extra text)
      const jsonMatch = rawResponse.match(/\{[^}]*\}/s);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Return both translation and success flag
        return {
          text: parsed.translation || rawResponse,
          success: parsed.success !== false // default to true if not specified
        };
      }
      // Fallback to raw response
      return { text: rawResponse, success: true };
    } catch (parseError) {
      console.warn('⚠️ Failed to parse JSON, using raw response:', parseError);
      return { text: rawResponse, success: true };
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || error.message === 'Aborted') {
      throw new Error('Aborted (tab closed)');
    }
    throw error;
  }
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🟢 Background received:', message);

  // Handle settings reload
  if (message.action === 'reloadSettings') {
    loadSettings().then(() => {
      sendResponse({ success: true, message: 'Settings reloaded' });
    });
    return true;
  }

  // Handle test Argos connection
  if (message.action === 'testArgosConnection') {
    testArgosConnection(message.argosUrl, message.targetCode, message.targetLang)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Handle install Argos package
  if (message.action === 'installArgosPackage') {
    installArgosPackage(message.argosUrl, message.fromCode, message.toCode, message.targetLang)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Handle cancel translation
  if (message.action === 'cancelTranslation') {
    console.log('🛑 Cancelling batch:', message.batchId);

    const pending = pendingResponses.get(message.batchId);
    if (pending) {
      // Remove from tracking
      pendingResponses.delete(message.batchId);

      // Remove from tab batches
      const tabBatchesForTab = tabBatches.get(pending.tabId) || [];
      const index = tabBatchesForTab.indexOf(message.batchId);
      if (index > -1) {
        tabBatchesForTab.splice(index, 1);
        tabBatches.set(pending.tabId, tabBatchesForTab);
      }

      // Abort all in-progress requests for this batch
      let abortedCount = 0;
      activeControllers.forEach((item, requestId) => {
        if (requestId.startsWith(`${message.batchId}_`)) {
          console.log('🚫 Aborting request:', requestId);
          item.controller.abort();
          item.timeoutId && clearTimeout(item.timeoutId);
          activeControllers.delete(requestId);
          abortedCount++;
        }
      });

      console.log(`🛑 Cancelled ${abortedCount} in-progress requests`);
      sendResponse({ success: true, cancelled: true, abortedCount });
    } else {
      sendResponse({ success: false, message: 'Batch not found' });
    }
    return true;
  }

  if (message.action === 'translateBatch') {
    console.log('🟢 Batch request: ' + message.texts.length + ' items');

    const batchId = Date.now();
    const tabId = sender.tab?.id;

    console.log('🆔 Created batch ID:', batchId);
    console.log('📋 Tab ID:', tabId);

    // Track this batch per tab
    if (!tabBatches.has(tabId)) {
      tabBatches.set(tabId, []);
    }
    tabBatches.get(tabId).push(batchId);

    // Track this batch
    pendingResponses.set(batchId, {
      results: [],
      completed: 0,
      total: message.texts.length,
      tabId: tabId
    });
    console.log('📋 Tracking batch, tab ID:', tabId);

    // Add all items to queue
    message.texts.forEach(text => {
      translationQueue.add(new QueueItem(text, message.targetLanguage, batchId, tabId));
    });

    sendResponse({ success: true, batchId, message: 'Processing in queue' });
    return true;
  }

  if (message.action === 'translate') {
    const batchId = Date.now();
    const tabId = sender.tab?.id;

    // Track this batch per tab
    if (!tabBatches.has(tabId)) {
      tabBatches.set(tabId, []);
    }
    tabBatches.get(tabId).push(batchId);

    pendingResponses.set(batchId, {
      results: [],
      completed: 0,
      total: 1,
      tabId: tabId
    });

    translationQueue.add(new QueueItem(message.text, message.targetLanguage, batchId, tabId));

    sendResponse({ success: true, batchId, message: 'Processing in queue' });
    return true;
  }
});

// Test Argos connection (called from options page)
async function testArgosConnection(argosUrl, targetCode, targetLang) {
  try {
    // Remove trailing slash
    const baseUrl = argosUrl.replace(/\/$/, '');

    console.log('🔍 Testing Argos connection to:', baseUrl);

    // Test base URL - use fetch with cache: 'no-store' to bypass some proxy caching
    const response = await fetch(baseUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    console.log('📊 Base response status:', response.status);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    console.log('📊 Base response data:', data);

    // Check installed packages
    const packagesResponse = await fetch(`${baseUrl}/installed-packages`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    console.log('📊 Packages response status:', packagesResponse.status);

    if (!packagesResponse.ok) {
      return { success: false, error: `HTTP ${packagesResponse.status}` };
    }

    const packages = await packagesResponse.json();
    console.log('📊 Packages data:', packages);

    // Check if package is installed
    const installedPackages = packages.packages || [];
    const hasPackage = installedPackages.some(p =>
      (p.from_code === 'zh' && p.to_code === targetCode) ||
      (p.includes && p.includes(`${targetCode}`))
    );

    console.log('📊 Package check result:', hasPackage);

    return { success: true, packageInstalled: hasPackage };

  } catch (error) {
    console.error('❌ Test connection error:', error);
    return { success: false, error: error.message };
  }
}

// Install Argos package (called from options page)
async function installArgosPackage(argosUrl, fromCode, toCode, targetLang) {
  try {
    // Remove trailing slash
    const baseUrl = argosUrl.replace(/\/$/, '');

    const installResponse = await fetch(`${baseUrl}/install-package?from_code=${fromCode}&to_code=${toCode}`, {
      method: 'POST',
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    if (!installResponse.ok) {
      const errorData = await installResponse.json();
      return { success: false, error: errorData.detail || `HTTP ${installResponse.status}` };
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}
