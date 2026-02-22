// Create floating circle button
const floatingButton = document.createElement('div');
floatingButton.id = 'project-translate-float';
floatingButton.innerHTML = '<span>🌐</span>';
floatingButton.title = 'Project Translate';

// Create toggle slider below the button
const toggleContainer = document.createElement('div');
toggleContainer.id = 'project-translate-toggle-container';

const toggleSlider = document.createElement('label');
toggleSlider.className = 'toggle-slider';
toggleSlider.title = 'Toggle translation on/off';

const toggleCheckbox = document.createElement('input');
toggleCheckbox.type = 'checkbox';
toggleCheckbox.id = 'project-translate-toggle';
toggleCheckbox.checked = false; // Off by default

const toggleTrack = document.createElement('span');
toggleTrack.className = 'toggle-track';

const toggleThumb = document.createElement('span');
toggleThumb.className = 'toggle-thumb';

toggleSlider.appendChild(toggleCheckbox);
toggleSlider.appendChild(toggleTrack);
toggleTrack.appendChild(toggleThumb);
toggleContainer.appendChild(toggleSlider);

// Track original and translated text for toggle
const translationCache = new Map(); // node -> { original, translated }

// Toggle change handler
toggleCheckbox.addEventListener('change', () => {
  const isChecked = toggleCheckbox.checked;
  console.log('🔘 Toggle:', isChecked ? 'ON (show translation)' : 'OFF (show original)');

  // Apply toggle state to all translated nodes
  translationCache.forEach((cache, node) => {
    try {
      if (isChecked) {
        // Show translation
        node.textContent = cache.translated;
      } else {
        // Show original
        node.textContent = cache.original;
      }
    } catch (e) {
      console.error('❌ Toggle failed:', e);
    }
  });
});

// Drag functionality for both button and toggle
let isDragging = false;
let startX, startY, initialRight, initialBottom;

function startDrag(e) {
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;

  const rect = floatingButton.getBoundingClientRect();
  initialRight = window.innerWidth - rect.right;
  initialBottom = window.innerHeight - rect.bottom;

  floatingButton.style.cursor = 'grabbing';
}

function handleDrag(e) {
  if (!isDragging) return;

  const deltaX = e.clientX - startX;
  const deltaY = e.clientY - startY;

  const buttonSize = 35;
  const padding = 10;
  const toggleHeight = 30; // Extra space for toggle

  let newRight = initialRight - deltaX;
  let newBottom = initialBottom - deltaY;

  // Constrain to window bounds
  const maxRight = window.innerWidth - buttonSize - padding;
  const maxBottom = window.innerHeight - buttonSize - toggleHeight - padding;

  newRight = Math.max(padding, Math.min(maxRight, newRight));
  newBottom = Math.max(padding, Math.min(maxBottom, newBottom));

  floatingButton.style.right = `${newRight}px`;
  floatingButton.style.bottom = `${newBottom}px`;

  // Move toggle with button
  toggleContainer.style.right = `${newRight}px`;
  toggleContainer.style.bottom = `${newBottom + 40}px`; // 40px below button (button is 35px)
}

function endDrag() {
  if (isDragging) {
    isDragging = false;
    floatingButton.style.cursor = 'pointer';
  }
}

floatingButton.addEventListener('mousedown', startDrag);
document.addEventListener('mousemove', handleDrag);
document.addEventListener('mouseup', endDrag);

// Also make toggle draggable
toggleContainer.addEventListener('mousedown', startDrag);

// Track pending batch requests
const pendingBatches = new Map();
let currentBatchId = null; // Track current active batch

// Set button state
function setButtonState(state) {
  floatingButton.classList.remove('loading', 'success');
  if (state) {
    floatingButton.classList.add(state);
  }
}

// Map to track which text nodes belong to which text
const textToNodesMap = new Map();

// Extract non-English text nodes using TreeWalker
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

// Check if text should be skipped (emojis, symbols, arrows, meaningless)
function shouldSkipText(text) {
  const trimmed = text.trim();

  // Skip if empty or too short (less than 2 meaningful chars)
  if (trimmed.length < 2) return true;

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
function replaceTextNodes(originalText, translatedText, aiSuccess) {
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
      console.log(`📝 Replacing node: "${node.textContent.trim()}" → "${translatedText}"`);

      // Cache original and translated text for toggle
      const original = node.textContent;
      translationCache.set(node, { original, translated: translatedText });

      // Replace the text node content directly
      node.textContent = translatedText;

      // Mark parent as translated (for skipping later)
      node.parentElement.classList.add('project-translate-done');

      // Highlight the translation
      const parent = node.parentElement;
      parent.style.backgroundColor = '#fff3cd';
      parent.style.transition = 'background-color 0.3s';
      setTimeout(() => {
        parent.style.transition = 'background-color 1s';
        parent.style.backgroundColor = 'transparent';
      }, 500);

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
            // Do NOT replace - leave original text
          }
        }

        // Check if batch is complete
        if (result.isComplete) {
          console.log('📊 All translations complete!');
          setButtonState('success');

          // Auto-enable toggle to show translations
          toggleCheckbox.checked = true;

          // Keep button green permanently (no timeout to revert)
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
      translationCache.forEach((cache, node) => {
        try {
          node.textContent = cache.original;
        } catch (e) {
          console.error('❌ Revert failed:', e);
        }
      });
      // Clear cache and reset UI
      translationCache.clear();
      setButtonState(null);
      toggleCheckbox.checked = false;
      currentBatchId = null;
    });
    return;
  }

  console.log('🔵 Floating button clicked!');
  console.log('🔍 Scanning page for non-English text...');

  // Extract non-English text from page
  const nonEnglishTexts = extractNonEnglishText();

  if (nonEnglishTexts.length === 0) {
    console.log('ℹ️ No non-English text found on this page');
    return;
  }

  console.log(`📦 Found ${nonEnglishTexts.length} non-English texts to translate:`);
  nonEnglishTexts.forEach((text, i) => {
    console.log(`  [${i + 1}] ${text}`);
  });

  // Set loading state
  setButtonState('loading');

  // Debug: Log what nodes we found
  logTextNodeMap();

  // Send to background for translation to English
  chrome.runtime.sendMessage({
    action: 'translateBatch',
    texts: nonEnglishTexts,
    targetLanguage: 'English'
  }, (response) => {
    console.log('🔵 Queue acknowledged:', response);
    if (response && response.batchId) {
      currentBatchId = response.batchId;
      pendingBatches.set(response.batchId, {
        status: 'processing',
        count: nonEnglishTexts.length
      });
    }
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
document.body.appendChild(toggleContainer);
