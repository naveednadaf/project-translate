// Detect language using character patterns (simple approach)
function detectLanguage(text) {
  // Check for non-Latin scripts
  const hasChinese = /[\u4E00-\u9FFF]/.test(text);
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
  const hasKorean = /[\uAC00-\uD7AF]/.test(text);
  const hasRussian = /[\u0400-\u04FF]/.test(text);
  const hasHindi = /[\u0900-\u097F]/.test(text);
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  const hasHebrew = /[\u0590-\u05FF]/.test(text);
  const hasThai = /[\u0E00-\u0E7F]/.test(text);

  // Check for specific European language diacritics
  const hasGerman = /[äÄöÖüÜß]/.test(text);
  const hasFrench = /[àâçéèêëïîôùûüÿœŒ]/.test(text);
  const hasSpanish = /[áéíóúñ¿¡]/.test(text);
  const hasPortuguese = /[ãõçáéíóú]/.test(text);
  const hasItalian = /[àèéìíòóùú]/.test(text);

  if (hasChinese) return 'Chinese';
  if (hasJapanese) return 'Japanese';
  if (hasKorean) return 'Korean';
  if (hasRussian) return 'Russian';
  if (hasHindi) return 'Hindi';
  if (hasArabic) return 'Arabic';
  if (hasHebrew) return 'Hebrew';
  if (hasThai) return 'Thai';
  if (hasGerman) return 'German';
  if (hasFrench) return 'French';
  if (hasSpanish) return 'Spanish';
  if (hasPortuguese) return 'Portuguese';
  if (hasItalian) return 'Italian';

  // Default to English for basic Latin script
  return 'English';
}

// Create floating circle button
const floatingButton = document.createElement('div');
floatingButton.id = 'project-translate-float';
floatingButton.innerHTML = '<span>🌐</span>';
floatingButton.title = 'Project Translate';

// Create close button attached to floating button
const closeButton = document.createElement('button');
closeButton.id = 'project-translate-close';
closeButton.innerHTML = '×';
closeButton.title = 'Close floating button';
closeButton.addEventListener('click', (e) => {
  e.stopPropagation();
  floatingButton.style.display = 'none';
  closeButton.style.display = 'none';
});

// Append close button to floating button (not container)
floatingButton.appendChild(closeButton);

// Drag functionality for floating button
let isDragging = false;
let startX, startY, initialRight, initialBottom;

floatingButton.addEventListener('mousedown', (e) => {
  if (e.target === closeButton) return; // Don't drag when clicking close button

  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;

  const rect = floatingButton.getBoundingClientRect();
  initialRight = window.innerWidth - rect.right;
  initialBottom = window.innerHeight - rect.bottom;

  floatingButton.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;

  const deltaX = e.clientX - startX;
  const deltaY = e.clientY - startY;

  const buttonSize = 35;
  const padding = 10;

  let newRight = initialRight - deltaX;
  let newBottom = initialBottom - deltaY;

  // Constrain to window bounds
  const maxRight = window.innerWidth - buttonSize - padding;
  const maxBottom = window.innerHeight - buttonSize - padding;

  newRight = Math.max(padding, Math.min(maxRight, newRight));
  newBottom = Math.max(padding, Math.min(maxBottom, newBottom));

  floatingButton.style.right = `${newRight}px`;
  floatingButton.style.bottom = `${newBottom}px`;
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    floatingButton.style.cursor = 'pointer';
  }
});

// Track pending batch requests
const pendingBatches = new Map();
let currentBatchId = null; // Track current active batch
let isTranslationActive = false; // Track if translations are currently shown
let completedTranslations = []; // Store completed translation results

// Set button state
function setButtonState(state) {
  floatingButton.classList.remove('loading', 'success');
  if (state) {
    floatingButton.classList.add(state);
  }
}

// Map to track which text nodes belong to which text
const textToNodesMap = new Map();

function extractNonEnglishText() {
  const nonEnglishTexts = [];

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip script, style, and hidden elements
        const parent = node.parentElement;
        if (!parent || parent.closest('script, style, noscript, meta, link')) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip if already translated in this session
        if (parent.classList.contains('project-translate-done')) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip empty or whitespace-only nodes
        const text = node.textContent.trim();
        if (!text || text.length < 2) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip if element is not visible
        if (!isElementVisible(parent)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  // Collect all text nodes
  let currentNode;
  while ((currentNode = walker.nextNode())) {
    const text = currentNode.textContent.trim();

    // Check if text contains non-English characters
    if (containsNonEnglish(text)) {
      // Skip emojis, symbols, arrows, meaningless text using regex
      if (shouldSkipText(text)) {
        console.log('⏭️ Skipping (symbols/emojis/short):', text);
        continue;
      }

      // Extract only non-English parts from mixed text
      const parts = extractNonEnglishParts(text);
      const nonEnglishOnly = parts.filter(p => p.isNonEnglish).map(p => p.text);

      if (nonEnglishOnly.length > 0) {
        nonEnglishOnly.forEach(net => {
          // Final check on extracted parts
          if (!shouldSkipText(net)) {
            nonEnglishTexts.push(net);
            console.log('📝 Found non-English text:', net);

            // Map text to the actual node reference
            if (!textToNodesMap.has(net)) {
              textToNodesMap.set(net, new Set());
            }
            // Store the node reference directly (use Set to avoid duplicates)
            textToNodesMap.get(net).add(currentNode);
          } else {
            console.log('⏭️ Skipping extracted part:', net);
          }
        });
      }
    }
  }

  return [...new Set(nonEnglishTexts)]; // Unique texts only
}

// Extract text that is NOT in the target language
function extractNonTargetLanguageText(targetLanguage) {
  const nonTargetTexts = [];

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent || parent.closest('script, style, noscript, meta, link')) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip breadcrumb navigation only (not all links)
        if (parent.closest('[aria-label*="breadcrumb"], .breadcrumb, nav[aria-label*="Breadcrumb"]')) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip links that are clearly navigation/URL patterns (not content links)
        if (parent.tagName === 'A') {
          const href = parent.href || '';
          const text = parent.textContent.trim();
          // Skip if href is just a path like /store/apps/details
          if (href.match(/^\/[a-z\/]+$/i) || text.match(/^›.*›.*›$/)) {
            return NodeFilter.FILTER_REJECT;
          }
        }

        if (parent.classList.contains('project-translate-done')) {
          return NodeFilter.FILTER_REJECT;
        }

        const text = node.textContent.trim();
        if (!text || text.length < 2) {
          return NodeFilter.FILTER_REJECT;
        }

        if (!isElementVisible(parent)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let currentNode;
  while ((currentNode = walker.nextNode())) {
    const text = currentNode.textContent.trim();

    if (shouldSkipText(text)) {
      console.log('⏭️ Skipping (symbols/emojis/short/URL):', text);
      continue;
    }

    // Detect language using character patterns
    const detectedLang = detectLanguage(text);
    console.log(`🔍 Detected "${text.substring(0, 30)}..." as ${detectedLang}`);

    // Compare with target language
    // Skip if same as target
    if (detectedLang === targetLanguage) {
      console.log(`⏭️ Skipping (same as target): ${detectedLang}`);
      continue;
    }

    // Different language - add to translation queue
    nonTargetTexts.push(text);
    console.log(`📝 Found text to translate (${detectedLang} → ${targetLanguage}):`, text);

    if (!textToNodesMap.has(text)) {
      textToNodesMap.set(text, new Set());
    }
    textToNodesMap.get(text).add(currentNode);
  }

  return [...new Set(nonTargetTexts)];
}

// Debug: Log text node map
function logTextNodeMap() {
  console.log('📊 Text Node Map:');
  textToNodesMap.forEach((nodes, text) => {
    console.log(`  "${text}" → ${nodes.size} node(s)`);
  });
}

// Check if element is visible (including scrollable areas)
function isElementVisible(element) {
  if (!element || !document.body.contains(element)) {
    return false;
  }

  const style = window.getComputedStyle(element);

  // Check if hidden via CSS
  if (style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0') {
    return false;
  }

  // Check if inside a hidden parent
  let parent = element;
  while (parent && parent !== document.body) {
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
      return false;
    }
    parent = parent.parentElement;
  }

  // Check if element has actual dimensions
  const rect = element.getBoundingClientRect();

  // Allow elements that are in the document flow (have width/height or content)
  // This includes elements below the fold (scrollable area)
  if (rect.width > 0 || rect.height > 0 || element.childNodes.length > 0) {
    return true;
  }

  return false;
}

// Check if text should be skipped (emojis, symbols, arrows, meaningless, URLs)
function shouldSkipText(text) {
  const trimmed = text.trim();

  // Skip if empty or too short (less than 2 meaningful chars)
  if (trimmed.length < 2) return true;

  // Skip URLs and URL-like patterns
  if (/^https?:\/\//.test(trimmed) || /^www\./.test(trimmed) || /^\/[a-z\/]+$/.test(trimmed)) {
    return true;
  }

  // Skip email addresses
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return true;
  }

  // Skip file paths
  if (/^[\/\\][a-zA-Z0-9_\/\\.-]+$/.test(trimmed)) {
    return true;
  }

  // Regex patterns for things to skip
  const skipPatterns = [
    // Only emojis
    /^[\p{Emoji}]+$/u,

    // Only arrows (various unicode arrow blocks)
    /^[\u2190-\u21FF\u27F0-\u27FF\u2900-\u29FF\u2B00-\u2BFF]+$/,

    // Only math/logical symbols
    /^[\u2200-\u22FF\u27C0-\u27EF]+$/,

    // Only box drawing / block elements
    /^[\u2500-\u259F\u2580-\u25FF]+$/,

    // Only misc symbols (stars, hearts, etc)
    /^[\u2600-\u26FF\u2700-\u27BF]+$/,

    // Only dingbats
    /^[\u2700-\u27BF]+$/,

    // Only geometric shapes
    /^[\u25A0-\u25FF]+$/,

    // Only currency symbols
    /^[\u20A0-\u20CF]+$/,

    // Only technical symbols
    /^[\u2300-\u23FF]+$/,

    // Only control characters / zero-width
    /^[\u0000-\u001F\u007F-\u009F]+$/,

    // Only numbers and Latin caps (likely codes)
    /^[A-Z0-9\s]+$/,

    // Only punctuation/symbols
    /^[\s\p{P}\p{S}]+$/u,
  ];

  // Check if text matches any skip pattern
  return skipPatterns.some(pattern => pattern.test(trimmed));
}

// Check if text contains non-English characters
function containsNonEnglish(text) {
  // Allow basic Latin (English), numbers, and common punctuation
  const englishPattern = /^[\x00-\x7F\s.,!?;:'"()\-]+$/;
  return !englishPattern.test(text);
}

// Extract only non-English parts from mixed text
function extractNonEnglishParts(text) {
  const parts = [];
  let currentPart = '';
  let isNonEnglish = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charCode = char.charCodeAt(0);
    const isEnglishChar = charCode <= 127 || /[\s.,!?;:'"()\-]/.test(char);

    if (isEnglishChar) {
      if (isNonEnglish && currentPart.trim()) {
        parts.push({ text: currentPart.trim(), isNonEnglish: true });
        currentPart = '';
      }
      isNonEnglish = false;
      currentPart += char;
    } else {
      if (!isNonEnglish && currentPart && !isEnglishPart(currentPart)) {
        parts.push({ text: currentPart.trim(), isNonEnglish: false });
      } else if (!isNonEnglish) {
        currentPart = '';
      }
      isNonEnglish = true;
      currentPart += char;
    }
  }

  // Handle last part
  if (currentPart.trim()) {
    if (isNonEnglish) {
      parts.push({ text: currentPart.trim(), isNonEnglish: true });
    } else if (!isEnglishPart(currentPart)) {
      parts.push({ text: currentPart.trim(), isNonEnglish: false });
    }
  }

  return parts;
}

// Check if a text part is mostly English
function isEnglishPart(text) {
  const englishChars = text.split('').filter(c => c.charCodeAt(0) <= 127).length;
  return englishChars / text.length > 0.8;
}

// Replace text in specific text nodes
function replaceTextNodes(originalText, translatedText, aiSuccess, silentMode = false) {
  const nodeSet = textToNodesMap.get(originalText);
  if (!nodeSet || nodeSet.size === 0) {
    console.warn('⚠️ No nodes found for:', originalText);
    return false;
  }

  // Check AI's success flag - if false, don't replace
  if (aiSuccess === false) {
    console.log(`⏭️ Skipping replacement - AI marked as unsuccessful: "${originalText}"`);
    return false;
  }

  let replacedCount = 0;
  // Convert Set to Array for iteration
  const nodes = Array.from(nodeSet);
  nodes.forEach(node => {
    try {
      if (!silentMode) {
        console.log(`📝 Replacing node: "${node.textContent.trim()}" → "${translatedText}"`);
      }
      // Replace the text node content directly
      node.textContent = translatedText;

      // Mark parent as translated (for skipping later)
      node.parentElement.classList.add('project-translate-done');

      // Highlight the translation (only in non-silent mode)
      if (!silentMode) {
        const parent = node.parentElement;
        parent.style.backgroundColor = '#fff3cd';
        parent.style.transition = 'background-color 0.3s';
        setTimeout(() => {
          parent.style.transition = 'background-color 1s';
          parent.style.backgroundColor = 'transparent';
        }, 500);
      }

      replacedCount++;
    } catch (e) {
      console.error('❌ Failed to replace node:', e);
    }
  });

  return replacedCount > 0;
}

// Listen for storage changes (results from background)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    Object.keys(changes).forEach(key => {
      if (key.startsWith('translation_')) {
        const result = changes[key].newValue;

        // Handle individual translation result
        if (result.data !== undefined) {
          const item = result.data;

          // Store completed translation
          if (item.success) {
            completedTranslations.push(item);
          }

          if (item.success) {
            console.log(`✅ Translated: "${item.text}" → ${item.data}`);
            // Replace in DOM immediately, checking AI's success flag
            const replaced = replaceTextNodes(item.text, item.data, item.aiSuccess);
            if (replaced) {
              console.log('✅ Replaced in DOM');
            } else {
              console.log('⏭️ Replacement skipped');
            }
          } else {
            console.log(`❌ Failed: "${item.text}" - ${item.error}`);
            // Store failed translation for retry
            completedTranslations.push(item);
          }
        }

        // Check if batch is complete
        if (result.isComplete) {
          console.log('📊 All translations complete!');
          setButtonState('success');
          isTranslationActive = true;
          // Keep button green permanently
        }

        // Clean up storage
        chrome.storage.local.remove(key);
      }
    });
  }
});

// Add click event
floatingButton.addEventListener('click', () => {
  // If currently translating, cancel all
  if (currentBatchId) {
    console.log('🛑 Cancelling translation...');
    chrome.runtime.sendMessage({
      action: 'cancelTranslation',
      batchId: currentBatchId
    }, (response) => {
      console.log('🛑 Translation cancelled:', response);
      // Revert all translated text back to original
      textToNodesMap.forEach((nodeSet, originalText) => {
        nodeSet.forEach(node => {
          try {
            node.textContent = originalText;
          } catch (e) {
            console.error('❌ Revert failed:', e);
          }
        });
      });
      // Clear map and reset UI
      textToNodesMap.clear();
      setButtonState(null);
      currentBatchId = null;
      isTranslationActive = false;
      completedTranslations = [];
    });
    return;
  }

  // If translations are active, toggle OFF (revert to original)
  if (isTranslationActive) {
    console.log('🔴 Turning translations OFF');
    textToNodesMap.forEach((nodeSet, originalText) => {
      nodeSet.forEach(node => {
        try {
          node.textContent = originalText;
        } catch (e) {
          console.error('❌ Revert failed:', e);
        }
      });
    });
    setButtonState(null);
    isTranslationActive = false;
    return;
  }

  // If translations exist but are inactive, toggle ON (show cached translations)
  if (completedTranslations.length > 0 && textToNodesMap.size > 0) {
    console.log('🟢 Turning translations ON (showing cached)');
    // Re-apply successful translations
    completedTranslations.forEach(item => {
      if (item.success && item.aiSuccess !== false) {
        replaceTextNodes(item.text, item.data, item.aiSuccess, true); // silent mode
      }
    });
    setButtonState('success');
    isTranslationActive = true;
    return;
  }

  // Start new translation
  console.log('🔵 Floating button clicked!');
  console.log('🔍 Scanning page for text to translate...');

  // Get target language from settings
  chrome.storage.sync.get({ targetLanguage: 'English' }, (settings) => {
    const targetLanguage = settings.targetLanguage || 'English';

    // Check if we have failed translations to retry
    const failedTranslations = completedTranslations.filter(item => !item.success || item.aiSuccess === false);

    if (failedTranslations.length > 0) {
      console.log(`🔄 Found ${failedTranslations.length} failed translations to retry`);
      // Clear previous data and retry failed ones
      textToNodesMap.clear();
      completedTranslations = [];
      setButtonState('loading');

      // Send failed translations for retry
      chrome.runtime.sendMessage({
        action: 'translateBatch',
        texts: failedTranslations.map(item => item.text),
        targetLanguage: targetLanguage
      }, (response) => {
        console.log('🔵 Retry queue acknowledged:', response);
        if (response && response.batchId) {
          currentBatchId = response.batchId;
          pendingBatches.set(response.batchId, {
            status: 'processing',
            count: failedTranslations.length
          });
        }
      });
      return;
    }

    // Extract text that is NOT in target language
    const nonTargetTexts = extractNonTargetLanguageText(targetLanguage);

    if (nonTargetTexts.length === 0) {
      console.log(`ℹ️ No text found that needs translation to ${targetLanguage}`);
      return;
    }

    console.log(`📦 Found ${nonTargetTexts.length} texts to translate to ${targetLanguage}:`);
    nonTargetTexts.forEach((text, i) => {
      console.log(`  [${i + 1}] ${text}`);
    });

    // Set loading state
    setButtonState('loading');

    // Debug: Log what nodes we found
    logTextNodeMap();

    // Send to background for translation
    chrome.runtime.sendMessage({
      action: 'translateBatch',
      texts: nonTargetTexts,
      targetLanguage: targetLanguage
    }, (response) => {
      console.log('🔵 Queue acknowledged:', response);
      if (response && response.batchId) {
        currentBatchId = response.batchId;
        pendingBatches.set(response.batchId, {
          status: 'processing',
          count: nonTargetTexts.length
        });
      }
    });
  });
});

// Right-click to open options
floatingButton.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  // Open options page
  chrome.runtime.openOptionsPage();
});

// Long press to open options (mobile support)
let pressTimer;
floatingButton.addEventListener('mousedown', () => {
  pressTimer = setTimeout(() => {
    chrome.runtime.openOptionsPage();
  }, 1000);
});
floatingButton.addEventListener('mouseup', () => {
  clearTimeout(pressTimer);
});
floatingButton.addEventListener('mouseleave', () => {
  clearTimeout(pressTimer);
});

// Add to page
document.body.appendChild(floatingButton);

// Hide button when video is fullscreen
function checkFullscreen() {
  const isFullscreen = document.fullscreenElement ||
                       document.webkitFullscreenElement ||
                       document.mozFullScreenElement ||
                       document.msFullscreenElement;

  if (isFullscreen) {
    floatingButton.style.display = 'none';
  } else {
    floatingButton.style.display = 'block';
  }
}

// Listen for fullscreen changes
document.addEventListener('fullscreenchange', checkFullscreen);
document.addEventListener('webkitfullscreenchange', checkFullscreen);
document.addEventListener('mozfullscreenchange', checkFullscreen);
document.addEventListener('MSFullscreenChange', checkFullscreen);

// Initial check
checkFullscreen();
