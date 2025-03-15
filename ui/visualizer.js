/**
 * Tokenizer Visualization Module
 * 
 * This module visualizes the tokenization process by simulating it step by step,
 * using the original token patterns from the compiler module.
 */

/**
 * Since we're running in the browser and can't use require/import directly,
 * we'll access the tokenizer globals that are exposed through script tags.
 * The HTML file includes compiler/parse.js before this file, so TOKEN_PATTERNS,
 * WHITESPACE_REGEX, and tokenize are available as globals.
 */
// Reference the patterns from the compiler (exposed as globals in the browser)

/**
 * Runs a tokenizer simulation that records each step for visualization
 * 
 * @param {string} sourceCode - Source code to tokenize
 * @returns {Object} - Contains tokens and visualization steps
 */
function runTokenizerSimulation(sourceCode) {
  // Initialize state
  const state = {
    sourceCode,
    position: 0,
    tokens: [],
    steps: [
      // Add initial step with empty tokens
      {
        type: 'initial',
        position: 0,
        length: 0,
        currentTokens: []
      }
    ]
  };
  
  // Main tokenization loop - mirrors the logic in the original tokenizer
  while (state.position < state.sourceCode.length) {
    skipWhitespace(state);
    
    if (state.position >= state.sourceCode.length) {
      break;
    }
    
    let matched = false;
    
    for (const pattern of window.CompilerModule.TOKEN_PATTERNS) {
      const match = state.sourceCode.slice(state.position).match(pattern.regex);
      
      if (match) {
        const value = match[0];
        const startPosition = state.position;
        
        // Skip comments but still record the step
        if (pattern.type === "COMMENT") {
          // Record step BEFORE changing position
          state.steps.push({
            type: 'comment',
            position: startPosition,
            length: value.length,
            value,
            currentTokens: [...state.tokens]
          });
          
          // Update position AFTER recording the step
          state.position += value.length;
          matched = true;
          break;
        }
        
        // Create token object
        const token = {
          type: pattern.type,
          value,
          position: startPosition,
        };
        
        // Add token to the array
        state.tokens.push(token);
        
        // Record step BEFORE changing position
        state.steps.push({
          type: 'token',
          token: { ...token },
          position: startPosition,
          length: value.length,
          currentTokens: [...state.tokens]
        });
        
        // Update position AFTER recording the step
        state.position += value.length;
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      throw new Error(
        `Unexpected character at position ${state.position}: "${state.sourceCode.charAt(state.position)}"`,
      );
    }
  }
  
  // Add EOF token
  const eofToken = { type: "EOF", position: state.position };
  state.tokens.push(eofToken);
  
  state.steps.push({
    type: 'token',
    token: { ...eofToken },
    position: state.position,
    length: 0,
    currentTokens: [...state.tokens]
  });
  
  return {
    tokens: state.tokens,
    steps: state.steps
  };
}

/**
 * Skip whitespace characters and record the step
 * 
 * @param {Object} state - Current tokenization state
 */
function skipWhitespace(state) {
  const match = state.sourceCode.slice(state.position).match(window.CompilerModule.WHITESPACE_REGEX);
  if (match) {
    const startPosition = state.position;
    const length = match[0].length;
    
    // Record step BEFORE changing position
    state.steps.push({
      type: 'whitespace',
      position: startPosition,
      length: length,
      currentTokens: [...state.tokens]
    });
    
    // Update position AFTER recording the step
    state.position += length;
  }
}

/**
 * Get tokens from the original tokenizer
 * 
 * @param {string} sourceCode - The source code to tokenize
 * @returns {Array} - Array of tokens from the original tokenizer
 */
function getTokens(sourceCode) {
  return window.CompilerModule.tokenize(sourceCode);
}

/**
 * Helper function to create colored token display
 * 
 * @param {Object} token - Token object to display
 * @returns {HTMLElement} - DOM element for the token
 */
function createTokenDisplay(token) {
  const tokenElement = document.createElement('div');
  tokenElement.className = 'token';
  tokenElement.textContent = `${token.type}: "${token.value || ''}" (pos: ${token.position})`;
  tokenElement.dataset.position = token.position;
  return tokenElement;
}

/**
 * Helper function to highlight source code
 * 
 * @param {string} sourceCode - Original source code
 * @param {number} currentPosition - Position to highlight
 * @param {number} currentLength - Length of text to highlight
 * @param {string} highlightClass - CSS class for highlighting
 * @returns {string} - HTML with highlighting spans
 */
function highlightCode(sourceCode, currentPosition, currentLength, highlightClass = 'text-current') {
  // Convert source code to HTML with spans for highlighting
  const beforeCurrent = sourceCode.substring(0, currentPosition);
  const currentText = sourceCode.substring(currentPosition, currentPosition + currentLength);
  const afterCurrent = sourceCode.substring(currentPosition + currentLength);
  
  return [
    beforeCurrent.length > 0 ? `<span class="text-consumed">${escapeHtml(beforeCurrent)}</span>` : '',
    currentText.length > 0 ? `<span class="${highlightClass}">${escapeHtml(currentText)}</span>` : '',
    afterCurrent
  ].join('');
}

/**
 * Helper function to escape HTML
 * 
 * @param {string} text - Text to escape
 * @returns {string} - HTML-escaped text
 */
function escapeHtml(text) {
  const element = document.createElement("div");
  element.textContent = text;
  return element.innerHTML;
}

/**
 * Initialize the visualization with example code
 * 
 * @returns {Object} - Visualization state
 */
function initializeVisualization() {
  // Initialize state
  const state = {
    sourceCode: '',
    tokens: [],
    visualizationSteps: [],
    currentStepIndex: 0,
    
    // Example code snippets
    examples: {
      example1: `const greeting = "Hello";
const audience = true ? "world" : "nobody";`,
      
      example2: `const add = (a, b) => a + b;
const greet = () => {
  const name = "world";
  const greeting = "Hello";
  return greeting + " " + name;
};`,
      
      example3: `const getMessage = () => {
  const prefix = "Hello";
  const suffix = "World";
  return prefix + " " + suffix;
}

const emptyReturn = () => {
  return;
}`
    }
  };
  
  // UI elements
  state.ui = {
    sourceCodeElement: document.getElementById("source-code"),
    tokensListElement: document.getElementById("tokens-list"),
    scrubber: document.getElementById("scrubber"),
    progressInfo: document.getElementById("progress-info"),
    exampleSelect: document.getElementById("example-select"),
    customInputContainer: document.getElementById("custom-input-container"),
    customInput: document.getElementById("custom-input"),
    runCustomButton: document.getElementById("run-custom")
  };
  
  // Set up event handlers
  setupEventHandlers(state);
  
  // Load the first example
  loadExample(state, 'example1');
  
  return state;
}

/**
 * Set up event handlers for the UI
 * 
 * @param {Object} state - Visualization state
 */
function setupEventHandlers(state) {
  // Scrubber input handler
  state.ui.scrubber.addEventListener('input', () => {
    updateVisualization(state);
  });
  
  // Example selector handler
  state.ui.exampleSelect.addEventListener('change', () => {
    const selectedExample = state.ui.exampleSelect.value;
    
    if (selectedExample === 'custom') {
      state.ui.customInputContainer.classList.remove('hidden');
    } else {
      state.ui.customInputContainer.classList.add('hidden');
      loadExample(state, selectedExample);
    }
  });
  
  // Custom code run button handler
  state.ui.runCustomButton.addEventListener('click', () => {
    const customCode = state.ui.customInput.value.trim();
    if (!customCode) {
      alert('Please enter some code to tokenize');
      return;
    }
    
    state.sourceCode = customCode;
    runTokenization(state);
  });
}

/**
 * Load an example into the visualizer
 * 
 * @param {Object} state - Visualization state
 * @param {string} exampleKey - Key of the example to load
 */
function loadExample(state, exampleKey) {
  state.sourceCode = state.examples[exampleKey];
  runTokenization(state);
}

/**
 * Run tokenization on the current source code
 * 
 * @param {Object} state - Visualization state
 */
function runTokenization(state) {
  try {
    // Clear previous token display
    state.ui.tokensListElement.innerHTML = '';
    
    // Run the tokenizer simulation
    const result = runTokenizerSimulation(state.sourceCode);
    
    // Get the actual tokens from the original tokenizer
    state.tokens = getTokens(state.sourceCode);
    
    // Store visualization steps
    state.visualizationSteps = result.steps;
    
    // Reset UI
    state.currentStepIndex = 0;
    state.ui.scrubber.max = Math.max(0, state.visualizationSteps.length - 1);
    state.ui.scrubber.value = 0;
    
    // Reset scroll positions
    state.ui.tokensListElement.scrollTop = 0;
    state.ui.sourceCodeElement.scrollTop = 0;
    
    // Update the visualization
    updateVisualization(state);
    
    // Focus the scrubber
    state.ui.scrubber.focus();
  } catch (error) {
    alert(`Tokenization error: ${error.message}`);
    console.error(error);
  }
}

/**
 * Update the visualization based on current scrubber position
 * 
 * @param {Object} state - Visualization state
 */
function updateVisualization(state) {
  const scrubberValue = parseInt(state.ui.scrubber.value, 10);
  // Skip the initial step to avoid requiring two drags to see anything
  const progress = Math.min(scrubberValue, state.visualizationSteps.length - 1);
  state.currentStepIndex = progress + 1; // Add 1 to skip the initial step
  
  // Update progress info
  const percentage = Math.round((progress / (state.visualizationSteps.length - 1)) * 100);
  state.ui.progressInfo.textContent = `${percentage}%`;
  
  // Update tokens list first
  updateTokensDisplay(state);
  
  // Then update source code display with highlighting
  updateSourceCodeHighlighting(state);
}

/**
 * Update the source code highlighting based on current step
 * 
 * @param {Object} state - Visualization state
 */
function updateSourceCodeHighlighting(state) {
  // Start with the raw source code
  state.ui.sourceCodeElement.textContent = state.sourceCode;
  
  if (state.currentStepIndex > 0) {
    const currentStep = state.visualizationSteps[state.currentStepIndex - 1];
    
    // Current token position and length
    const currentPosition = currentStep.position;
    const currentLength = currentStep.length || 0;
    
    // Determine highlight class based on the step type
    // Use green highlight for token steps, gray for whitespace/comments
    const highlightClass = currentStep.type === 'token' ? 'text-current' : 'text-whitespace';
    
    // Apply highlighting - highlight the current token
    state.ui.sourceCodeElement.innerHTML = highlightCode(
      state.sourceCode, 
      currentPosition, 
      currentLength,
      highlightClass
    );
  }
}

/**
 * Update the tokens display based on current step
 * 
 * @param {Object} state - Visualization state
 */
function updateTokensDisplay(state) {
  // Clear tokens list
  state.ui.tokensListElement.innerHTML = '';
  
  if (state.currentStepIndex === 0) {
    return;
  }
  
  // Get tokens up to current step
  const step = state.visualizationSteps[state.currentStepIndex - 1];
  const tokens = step.currentTokens || [];
  
  // Add tokens to display
  tokens.forEach((token, index) => {
    const tokenElement = createTokenDisplay(token);
    
    if (index === tokens.length - 1 && step.type === 'token') {
      // Highlight the most recently added token
      tokenElement.classList.add('token-current');
    } else {
      // Normal highlighting for previous tokens
      tokenElement.classList.add('token-highlighted');
    }
    
    state.ui.tokensListElement.appendChild(tokenElement);
  });
  
  // Scroll to the bottom of the token container after a short delay to ensure DOM updates
  // This ensures the most recently added token is fully visible
  setTimeout(() => {
    state.ui.tokensListElement.scrollTop = state.ui.tokensListElement.scrollHeight;
  }, 0);
}

// Initialize the visualizer when the page loads
document.addEventListener('DOMContentLoaded', () => {
  initializeVisualization();
});