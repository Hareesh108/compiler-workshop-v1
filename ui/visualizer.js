/**
 * Compiler Visualization Module
 *
 * This module visualizes both the tokenization and parsing processes step by step,
 * using the original patterns and functions from the compiler module.
 */

/**
 * Since we're running in the browser and can't use require/import directly,
 * we'll access the compiler globals that are exposed through script tags.
 * The HTML file includes compiler/parse.js before this file, so TOKEN_PATTERNS,
 * WHITESPACE_REGEX, tokenize, and parse are available as globals.
 */
// Reference the compiler functions and patterns (exposed as globals in the browser)

/**
 * Build a tokenization data structure that records token events for visualization
 *
 * @param {string} sourceCode - Source code to tokenize
 * @returns {Object} - Contains tokens, events, and mappings between source code and tokens
 */
function buildTokenizationData(sourceCode) {
  // Initialize data structure
  const tokenizationData = {
    sourceCode,
    tokens: [],
    events: [],
    // Mapping from source code positions to tokens
    sourceToToken: {},
    // Mapping from token index to source code range
    tokenToSource: {}
  };

  // Run the tokenizer with the onToken callback
  window.CompilerModule.tokenize(sourceCode, {
    onToken: (tokenEvent) => {
      // Add this event to our list
      tokenizationData.events.push(tokenEvent);

      // Only track actual tokens (not whitespace or comments)
      if (tokenEvent.type !== "WHITESPACE" && tokenEvent.type !== "COMMENT") {
        // Store the token
        const tokenIndex = tokenizationData.tokens.length;
        tokenizationData.tokens.push(tokenEvent);

        // Create mappings
        // Map each character position in source to this token
        for (let i = 0; i < tokenEvent.length; i++) {
          const pos = tokenEvent.position + i;
          tokenizationData.sourceToToken[pos] = tokenIndex;
        }

        // Map this token to its source range
        tokenizationData.tokenToSource[tokenIndex] = {
          start: tokenEvent.position,
          end: tokenEvent.position + tokenEvent.length,
          text: tokenEvent.consumedText
        };
      }
    }
  });

  return tokenizationData;
}

/**
 * Build an AST data structure that records AST node events for visualization
 *
 * @param {string} sourceCode - Source code to parse
 * @param {Array} tokens - Tokens from tokenization
 * @returns {Object} - Contains AST nodes and events
 */
function buildAstData(sourceCode, tokens) {
  // Initialize data structure
  const astData = {
    sourceCode,
    tokens,
    nodes: [],
    events: [],
    rootNode: null
  };

  // Node ID counter to assign unique IDs to each node
  let nodeIdCounter = 0;

  // Run the parser with the onNode callback
  window.CompilerModule.parse(tokens, {
    onNode: (nodeEvent) => {
      // Add node ID to track nodes
      nodeEvent.id = nodeIdCounter++;

      // Add this event to our list
      astData.events.push(nodeEvent);

      // If this is a completed node, store it
      if (nodeEvent.type.endsWith('Complete')) {
        // Store the node with its ID
        const nodeWithId = {
          ...nodeEvent.node,
          _id: nodeEvent.id,
          _type: nodeEvent.type
        };

        // Add to nodes list
        astData.nodes.push(nodeWithId);

        // If this is the program root, store it as rootNode
        if (nodeEvent.type === 'ProgramComplete') {
          astData.rootNode = nodeWithId;
        }
      }
    }
  });

  return astData;
}

/**
 * Skip whitespace in the source code - reimplemented to match original
 *
 * @param {Object} state - Tokenizer state
 */
function skipWhitespace(state) {
  const match = state.sourceCode
    .slice(state.position)
    .match(window.CompilerModule.WHITESPACE_REGEX);
  if (match) {
    state.position += match[0].length;
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
 * @param {Function} onTokenClick - Callback for when a token is clicked
 * @returns {HTMLElement} - DOM element for the token
 */
function createTokenDisplay(token, onTokenClick) {
  const tokenElement = document.createElement("div");
  tokenElement.className = "token";
  tokenElement.textContent = `${token.type}: "${token.value || ""}" (pos: ${token.position})`;
  tokenElement.dataset.position = token.position;
  tokenElement.dataset.tokenIndex = token.tokenIndex;

  // Add click handler
  tokenElement.addEventListener("click", () => {
    if (onTokenClick) {
      onTokenClick(token);
    }
  });

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
function highlightCode(
  sourceCode,
  currentPosition,
  currentLength,
  highlightClass = "text-current",
) {
  // Convert source code to HTML with spans for highlighting
  const beforeCurrent = sourceCode.substring(0, currentPosition);
  const currentText = sourceCode.substring(
    currentPosition,
    currentPosition + currentLength,
  );
  const afterCurrent = sourceCode.substring(currentPosition + currentLength);

  return [
    beforeCurrent.length > 0
      ? `<span class="text-consumed">${escapeHtml(beforeCurrent)}</span>`
      : "",
    currentText.length > 0
      ? `<span class="${highlightClass}" data-position="${currentPosition}" data-length="${currentLength}">${escapeHtml(currentText)}</span>`
      : "",
    afterCurrent,
  ].join("");
}

/**
 * Helper function to escape HTML special characters
 *
 * @param {string} text - Text to escape
 * @returns {string} - Escaped HTML
 */
function escapeHtml(text) {
  const element = document.createElement("div");
  element.textContent = text;
  return element.innerHTML;
}

/**
 * Build a name resolution data structure that records events
 *
 * @param {string} sourceCode - Source code for name resolution
 * @param {Array} tokens - Tokens for parsing
 * @param {Object} astData - AST data from parsing
 * @returns {Object} - Contains name resolution events
 */
function buildNameResolutionData(sourceCode, tokens, astData) {
  // Initialize data structure
  const nameResolutionData = {
    sourceCode,
    tokens,
    events: [],
  };

  // Run the analyzer with onNameResolution callback
  if (window.CompilerModule.analyze) {
    window.CompilerModule.analyze(astData.rootNode, {
      onNameResolution: (event) => {
        // Add this event to our list
        nameResolutionData.events.push(event);
      }
    });
  }

  return nameResolutionData;
}

/**
 * Initialize the visualization with example code
 *
 * @returns {Object} - Visualization state
 */
function initializeVisualization() {
  // Initialize state
  const state = {
    sourceCode: "",
    tokens: [],
    visualizationSteps: [],
    currentStepIndex: 0,

    // AST visualization state
    ast: null,
    astData: null,
    astSteps: [],

    // Name resolution state
    nameResolutionData: null,
    nameResolutionEvents: [],

    totalSteps: 0, // Total steps across tokenization, parsing, and name resolution

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
}`,
    },
  };

  // UI elements
  state.ui = {
    sourceCodeElement: document.getElementById("source-code"),
    tokensListElement: document.getElementById("tokens-list"),
    astTreeElement: document.getElementById("ast-tree"),
    nameResolutionListElement: document.getElementById("name-resolution-list"),
    scrubber: document.getElementById("scrubber"),
    exampleSelect: document.getElementById("example-select"),
    customInputContainer: document.getElementById("custom-input-container"),
    customInput: document.getElementById("custom-input"),
    runCustomButton: document.getElementById("run-custom"),
  };

  // Set up event handlers
  setupEventHandlers(state);

  // Load the first example
  loadExample(state, "example1");

  return state;
}

/**
 * Set up event handlers for the UI
 *
 * @param {Object} state - Visualization state
 */
function setupEventHandlers(state) {
  // Scrubber input handler
  state.ui.scrubber.addEventListener("input", () => {
    updateVisualization(state);
  });

  // Example selector handler
  state.ui.exampleSelect.addEventListener("change", () => {
    const selectedExample = state.ui.exampleSelect.value;

    if (selectedExample === "custom") {
      state.ui.customInputContainer.classList.remove("hidden");
    } else {
      state.ui.customInputContainer.classList.add("hidden");
      loadExample(state, selectedExample);
    }
  });

  // Custom code run button handler
  state.ui.runCustomButton.addEventListener("click", () => {
    const customCode = state.ui.customInput.value.trim();
    if (!customCode) {
      showToast("Please enter some code to tokenize");
      return;
    }

    state.sourceCode = customCode;
    runCompilation(state);
  });
}

/**
 * Load an example from the predefined examples
 *
 * @param {Object} state - Visualization state
 * @param {string} exampleKey - Key of the example to load
 */
function loadExample(state, exampleKey) {
  // Set the source code from the example
  state.sourceCode = state.examples[exampleKey];

  // Run tokenization and parsing
  runCompilation(state);
}

/**
 * Run the full compilation pipeline (tokenization and parsing)
 *
 * @param {Object} state - Visualization state
 */
function runCompilation(state) {
  // Clear previous visualization data
  state.tokens = [];
  state.visualizationSteps = [];
  state.astData = null;
  state.astSteps = [];
  state.nameResolutionData = null;
  state.nameResolutionEvents = [];

  // Add initial step (empty state)
  state.visualizationSteps.push({
    position: 0,
    currentTokens: []
  });

  try {
    // 1. Build tokenization visualization data
    const tokenizationData = buildTokenizationData(state.sourceCode);
    state.tokens = tokenizationData.tokens;
    state.tokenizationData = tokenizationData; // Store tokenization data for reference

    // Initialize the source code display with character spans
    initializeSourceCodeDisplay(state);

    // For each token event, create a visualization step
    tokenizationData.events.forEach(event => {
      if (event.type !== "WHITESPACE" && event.type !== "COMMENT") {
        state.visualizationSteps.push({
          position: event.position + event.length,
          currentTokens: [...state.tokens.slice(0, state.tokens.indexOf(event) + 1)]
        });
      }
    });

    // 2. Build AST visualization data
    state.astData = buildAstData(state.sourceCode, state.tokens);
    state.astSteps = state.astData.events;

    // 3. Build name resolution data
    if (window.CompilerModule.analyze) {
      state.nameResolutionData = buildNameResolutionData(
        state.sourceCode,
        state.tokens,
        state.astData
      );
      state.nameResolutionEvents = state.nameResolutionData.events;
    }

    // Calculate total steps
    state.totalSteps = state.visualizationSteps.length +
                       state.astSteps.length +
                       state.nameResolutionEvents.length;

    // Update scrubber range
    state.ui.scrubber.max = state.totalSteps - 1;
    state.ui.scrubber.value = 0;

    // Update visualization
    updateVisualization(state);
  } catch (error) {
    console.error("Compilation error:", error);
    showToast(`Error: ${error.message || "Unknown error"}`);
  }
}

/**
 * Update the visualization based on current scrubber position
 *
 * @param {Object} state - Visualization state
 */
function updateVisualization(state) {
  const scrubberValue = parseInt(state.ui.scrubber.value, 10);
  const totalTokenizationSteps = state.visualizationSteps.length;
  const totalAstSteps = state.astSteps.length;

  // Show the step number in container titles for debugging
  const astTitle = document.querySelector('.ast-container h2');
  const nameResolutionTitle = document.querySelector('.name-resolution-container h2');

  // Reset titles
  if (astTitle) {
    astTitle.textContent = "Abstract Syntax Tree";
  }

  if (nameResolutionTitle) {
    nameResolutionTitle.textContent = "Name Resolution";
  }

  // Determine which phase we're in based on scrubber value
  if (scrubberValue < totalTokenizationSteps) {
    // Tokenization phase
    state.currentStepIndex = scrubberValue;

    // Update tokens list
    updateTokensDisplay(state);

    // Update source code highlighting
    updateSourceCodeHighlighting(state);

    // Clear AST display
    state.ui.astTreeElement.innerHTML = "";

    // Clear name resolution display
    state.ui.nameResolutionListElement.innerHTML = "";

    if (nameResolutionTitle) {
      nameResolutionTitle.textContent = "Name Resolution";
    }
  }
  else if (scrubberValue < totalTokenizationSteps + totalAstSteps) {
    // AST phase
    const astStepIndex = scrubberValue - totalTokenizationSteps;

    // Show all tokens
    updateTokensDisplay(state, true);

    // Show all source code
    updateSourceCodeHighlighting(state, true);

    // Update AST tree with the current step
    updateAstDisplay(state, astStepIndex);

    // Clear name resolution display
    state.ui.nameResolutionListElement.innerHTML = "";

    if (astTitle) {
      astTitle.textContent = `Abstract Syntax Tree (Step ${astStepIndex + 1}/${state.astSteps.length})`;
    }
  }
  else {
    // Name resolution phase
    const nameResolutionStepIndex = scrubberValue - totalTokenizationSteps - totalAstSteps;

    // Show all tokens
    updateTokensDisplay(state, true);

    // Show all source code
    updateSourceCodeHighlighting(state, true);

    // Show full AST
    updateAstDisplay(state, state.astSteps.length - 1);

    // Update name resolution with the current step
    updateNameResolutionDisplay(state, nameResolutionStepIndex);

    if (nameResolutionTitle) {
      nameResolutionTitle.textContent = `Name Resolution (Step ${nameResolutionStepIndex + 1}/${state.nameResolutionEvents.length})`;
    }
  }
}

/**
 * Update the tokens display based on current step
 *
 * @param {Object} state - Visualization state
 * @param {boolean} [showAll=false] - Whether to show all tokens
 */
function updateTokensDisplay(state, showAll = false) {
  // Clear tokens list
  state.ui.tokensListElement.innerHTML = "";

  if (state.currentStepIndex === 0 && !showAll) {
    return;
  }

  // Determine which tokens to show
  let tokens = [];
  let currentTokenIndex = -1;

  if (showAll) {
    // Show all tokens
    tokens = state.tokens;
  } else {
  // In tokenization mode, show tokens up to current step
    const step = state.visualizationSteps[state.currentStepIndex];
    tokens = step.currentTokens || [];
    currentTokenIndex = tokens.length - 1;
  }

  // Variable to keep track of the current token element
  let currentTokenElement = null;

  // Add tokens to display
  tokens.forEach((token, index) => {
    // Add index to token for easy retrieval
    token.tokenIndex = index;

    const tokenElement = createTokenDisplay(token, (token) => {
      // When a token is clicked, highlight both the token and its source code
      highlightToken(state, token.tokenIndex);
      highlightSourceRange(state, token.tokenIndex);
    });

    if (index === currentTokenIndex && !showAll) {
      // Highlight the most recently added token
      tokenElement.classList.add("token-current");
      currentTokenElement = tokenElement;
    } else {
      // Normal highlighting for previous tokens
      tokenElement.classList.add("token-highlighted");
    }

    state.ui.tokensListElement.appendChild(tokenElement);
  });

  // Scroll the current token into view if it's not already visible
  setTimeout(() => {
    if (currentTokenElement) {
      scrollIntoViewIfNeeded(currentTokenElement, state.ui.tokensListElement);
    }
  }, 0);
}

/**
 * Update the source code highlighting based on current step
 *
 * @param {Object} state - Visualization state
 * @param {boolean} [showAll=false] - Whether to show all source code
 */
function updateSourceCodeHighlighting(state, showAll = false) {
  if (state.currentStepIndex === 0 && !showAll) {
    // Reset all source code highlighting
    const allChars = state.ui.sourceCodeElement.querySelectorAll('.source-char');
    allChars.forEach(char => {
      char.classList.remove('text-consumed', 'text-current');
    });
    return;
  }

  // If showing all, mark everything as consumed
  if (showAll) {
    const allChars = state.ui.sourceCodeElement.querySelectorAll('.source-char');
    allChars.forEach(char => {
      char.classList.remove('text-current', 'text-whitespace', 'text-clicked');
      char.classList.add('text-consumed');
    });
    return;
  }

  const currentStep = state.visualizationSteps[state.currentStepIndex];
  const currentPosition = currentStep.position;
  const currentLength = currentStep.length || 0;

  // Find the end position of the current token
  const currentEndPosition = currentPosition + currentLength;

  // Determine highlight class based on the step type (always "token" now)
  const highlightClass = "text-current";

  // Clear previous highlighting
  const allChars = state.ui.sourceCodeElement.querySelectorAll('.source-char');
  allChars.forEach(char => {
    char.classList.remove('text-consumed', 'text-current', 'text-whitespace', 'text-clicked');

    // Mark all characters before the current position as consumed
    const charPos = parseInt(char.dataset.pos, 10);
    if (charPos < currentEndPosition) {
      // The current token being processed is highlighted differently
      if (charPos >= currentPosition && charPos < currentEndPosition) {
        char.classList.add(highlightClass);
      } else {
        char.classList.add('text-consumed');
      }
    }
  });

  // Scroll to the current highlighted section if not in view
  const firstHighlightedChar = state.ui.sourceCodeElement.querySelector(`.${highlightClass}`);
  if (firstHighlightedChar) {
    setTimeout(() => {
      scrollIntoViewIfNeeded(firstHighlightedChar, state.ui.sourceCodeElement);
    }, 0);
  }
}

/**
 * Highlight a specific token
 *
 * @param {Object} state - Visualization state
 * @param {number} tokenIndex - Index of the token to highlight
 */
function highlightToken(state, tokenIndex) {
  // Clear any existing token highlighting
  const allTokens = state.ui.tokensListElement.querySelectorAll('.token');
  allTokens.forEach(el => {
    el.classList.remove('token-clicked');
  });

  // Find and highlight the specified token
  const tokenElement = state.ui.tokensListElement.querySelector(`[data-token-index="${tokenIndex}"]`);
  if (tokenElement) {
    tokenElement.classList.add('token-clicked');
    scrollIntoViewIfNeeded(tokenElement, state.ui.tokensListElement);
    return true;
  }
  return false;
}

/**
 * Highlight a specific range in the source code
 *
 * @param {Object} state - Visualization state
 * @param {number} tokenIndex - Index of the token to highlight in source
 */
function highlightSourceRange(state, tokenIndex) {
  // Get the range of source code for this token
  const sourceRange = state.tokenizationData.tokenToSource[tokenIndex];
  if (!sourceRange) return false;

  // Get the current scrubber position to determine what should be marked as consumed
  const currentStep = state.visualizationSteps[state.currentStepIndex - 1] || { position: 0, length: 0 };
  const currentTokenEndPos = currentStep.position + currentStep.length;

  // Clear highlighting for clicked state
  const allChars = state.ui.sourceCodeElement.querySelectorAll('.source-char');
  allChars.forEach(char => {
    char.classList.remove('text-clicked');

    // Ensure consumed text is still marked as consumed
    const charPos = parseInt(char.dataset.pos, 10);

    // We want to preserve the consumed/current highlighting from the scrubber
    if (state.currentStepIndex > 0) {
      if (charPos < currentTokenEndPos) {
        // Only remove current highlighting, keep consumed
        char.classList.remove('text-current');

        // The characters of the current token are highlighted with text-current
        if (charPos >= currentStep.position && charPos < currentTokenEndPos) {
          // Do nothing, we're removing this class
        } else {
          // Make sure consumed text stays consumed
          char.classList.add('text-consumed');
        }
      }
    }
  });

  // Add the clicked highlighting to the selected token's characters
  for (let i = sourceRange.start; i < sourceRange.end; i++) {
    const charSpan = state.ui.sourceCodeElement.querySelector(`[data-pos="${i}"]`);
    if (charSpan) {
      charSpan.classList.add('text-clicked');
    }
  }

  // Scroll to the highlighted source if not in view
  const firstHighlightedChar = state.ui.sourceCodeElement.querySelector('.text-clicked');
  if (firstHighlightedChar) {
    setTimeout(() => {
      scrollIntoViewIfNeeded(firstHighlightedChar, state.ui.sourceCodeElement);
    }, 0);
    return true;
  }
  return false;
}

/**
 * Update the AST display based on the current AST step
 *
 * @param {Object} state - Visualization state
 * @param {number} astStepIndex - Index into the AST steps array
 */
function updateAstDisplay(state, astStepIndex) {
  // Clear the AST tree
  state.ui.astTreeElement.innerHTML = "";

  if (astStepIndex < 0 || astStepIndex >= state.astSteps.length) {
    return;
  }

  // Get the current step
  const currentStep = state.astSteps[astStepIndex];
  if (!currentStep) {
    return;
  }

  // Display the current step information in a more concise way
  const currentStepInfo = document.createElement('div');
  currentStepInfo.className = 'ast-current-step-info';

  // Simplify the event type for display
  const eventType = currentStep.type || 'Unknown';
  const cleanEventType = eventType
    .replace('Start', '')
    .replace('Complete', '');

  currentStepInfo.innerHTML = `<strong>Current:</strong> ${cleanEventType}`;

  currentStepInfo.style.padding = '5px';
  currentStepInfo.style.marginBottom = '10px';
  currentStepInfo.style.backgroundColor = '#f0f0f0';
  currentStepInfo.style.borderRadius = '4px';
  state.ui.astTreeElement.appendChild(currentStepInfo);

  // SIMPLER APPROACH: Create a map of nodes by their location in the source code
  // for const declarations, we'll use variable name as the key
  const nodesByIdentifier = new Map();

  // A map to track all nodes by their ID
  const nodesById = new Map();

  // Track the current node for highlighting
  let currentNodeId = currentStep.id;

  // First pass: Process all steps up to the current one
  for (let i = 0; i <= astStepIndex; i++) {
    const step = state.astSteps[i];
    if (!step || !step.node) continue;

    // Create node data with metadata
    const nodeData = {
      ...step.node,
      _id: step.id,
      _type: step.type,
      _step: i,
      _isCurrentStep: (i === astStepIndex),
      _inProgress: !step.type.endsWith('Complete'),
      type: step.type.replace('Start', '').replace('Complete', '')
    };

    // Always store latest state of nodes by their ID
    nodesById.set(step.id, nodeData);

    // For ConstDeclaration, use the variable name as a key if available
    if (nodeData.type === 'ConstDeclaration' && nodeData.id && nodeData.id.name) {
      const key = `const-${nodeData.id.name}`;

      // If we don't have this node yet, or if this is a more recent version, store it
      if (!nodesByIdentifier.has(key) ||
          nodesByIdentifier.get(key)._step < nodeData._step) {
        nodesByIdentifier.set(key, nodeData);
      }
    }
  }

  // Find the root program node if it exists
  const programNodes = [...nodesById.values()].filter(node =>
    node._type === 'ProgramComplete' || node._type === 'ProgramStart'
  );

  // Sort by step to get the latest program node
  programNodes.sort((a, b) => b._step - a._step);
  const rootNode = programNodes.length > 0 ? programNodes[0] : null;

  // Determine which nodes to render
  let nodesToRender = [];

  if (rootNode && rootNode.body && rootNode.body.length > 0) {
    // Use the program body
    nodesToRender = rootNode.body.slice();

    // Match each node with our tracked WIP or complete nodes when possible
    for (let i = 0; i < nodesToRender.length; i++) {
      const node = nodesToRender[i];

      // For ConstDeclaration, try to find a matching WIP node by variable name
      if (node.type === 'ConstDeclaration' && node.id && node.id.name) {
        const key = `const-${node.id.name}`;
        if (nodesByIdentifier.has(key)) {
          // Replace with our tracked version that has additional metadata
          nodesToRender[i] = nodesByIdentifier.get(key);
        }
      }
    }
  } else {
    // No program node yet - show all nodes we've processed so far
    // This includes WIP and complete nodes, sorted by step number
    nodesToRender = [...nodesById.values()]
      .filter(node =>
        node.type === 'ConstDeclaration' ||
        node.type === 'ReturnStatement' ||
        node.type === 'ArrowFunctionExpression' ||
        node.type.includes('ConstDeclaration') ||
        node.type.includes('ReturnStatement') ||
        node.type.includes('ArrowFunction')
      )
      .sort((a, b) => a._step - b._step);
  }

  // IMPORTANT: Make sure the current node is always rendered
  // If it's not in our nodesToRender list already, add it
  const currentNodeInList = nodesToRender.some(node => node._id === currentNodeId);

  if (!currentNodeInList && currentStep.node) {
    // Create current node object
    const currentNode = {
      ...currentStep.node,
      _id: currentStep.id,
      _type: currentStep.type,
      _step: astStepIndex,
      _isCurrentStep: true,
      _inProgress: !currentStep.type.endsWith('Complete'),
      type: cleanEventType
    };

    // Add it to the beginning of our render list
    nodesToRender.unshift(currentNode);
  }

  // Render all nodes
  nodesToRender.forEach(node => {
    if (!node) return;

    // Is this the current step's node?
    const isCurrentNode = node._id === currentNodeId || node._isCurrentStep;

    // Create node element
    const nodeElement = createAstNodeElement(node, isCurrentNode, node._step);

    // Add special styling based on node state
    if (isCurrentNode) {
      nodeElement.classList.add("ast-node-current");
      nodeElement.style.borderLeft = '3px solid #3498db';

      // Special styling for current ConstDeclaration
      if (node.type === 'ConstDeclaration') {
        nodeElement.style.border = '2px solid #e74c3c';
        nodeElement.style.padding = '5px';
      }
    } else if (node._inProgress) {
      nodeElement.classList.add("ast-node-partial");
      nodeElement.style.borderLeft = '3px solid #f39c12';
    }

    // Add to the tree display
    state.ui.astTreeElement.appendChild(nodeElement);
  });
}

/**
 * Create an AST node element for visualization with expand/collapse functionality
 *
 * @param {Object} node - AST node
 * @param {boolean} isCurrentStep - Whether this node is part of the current step
 * @param {number} step - The step number this node was created in (for debugging)
 * @returns {HTMLElement} - DOM element representing the node
 */
function createAstNodeElement(node, isCurrentStep = false, step = -1) {
  const nodeElement = document.createElement("div");
  nodeElement.className = "ast-node";

  // Add node type as title attribute for hover tooltip
  const nodeType = node.type || node._type?.replace('Start', '').replace('Complete', '');
  nodeElement.setAttribute('title', nodeType);

  // Add expandable/collapsible functionality
  const hasChildren = hasAstNodeChildren(node);
  if (hasChildren) {
    nodeElement.classList.add("ast-node-expanded");
  }

  // Add appropriate class based on node state
  if (isCurrentStep) {
    nodeElement.classList.add("ast-node-current");
  } else if (node._inProgress) {
    nodeElement.classList.add("ast-node-partial");
  } else {
    nodeElement.classList.add("ast-node-highlighted");
  }

  // Create expander if there are children
  if (hasChildren) {
    const expander = document.createElement("span");
    expander.className = "ast-expander";
    expander.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent node click event
      toggleAstNodeExpansion(nodeElement);
    });
    nodeElement.appendChild(expander);
  }

  // Create a container for the syntax-like representation
  const syntaxContainer = document.createElement("span");
  syntaxContainer.className = "ast-syntax";

  // Render based on node type - more concise and syntax-like
  switch (nodeType) {
    case "ConstDeclaration":
      // Show "Const" with placeholders for missing parts
      const constKeyword = document.createElement("span");
      constKeyword.className = "ast-keyword";
      constKeyword.textContent = "const";
      syntaxContainer.appendChild(constKeyword);

      // Add variable name if we have it, otherwise a placeholder
      if (node.id && node.id.name) {
        syntaxContainer.appendChild(document.createTextNode(" "));
        const nameSpan = document.createElement("span");
        nameSpan.className = "ast-identifier";
        nameSpan.textContent = node.id.name;
        syntaxContainer.appendChild(nameSpan);
      } else {
        syntaxContainer.appendChild(document.createTextNode(" "));
        const placeholder = document.createElement("span");
        placeholder.className = "ast-placeholder";
        placeholder.textContent = "_____";
        syntaxContainer.appendChild(placeholder);
      }

      // Show equals sign
      syntaxContainer.appendChild(document.createTextNode(" = "));

      // Show value or placeholder
      if (node.init) {
        // We have an initializer but will show it as a child node
        const valueType = node.init.type || "expression";
        const typePlaceholder = document.createElement("span");
        typePlaceholder.className = "ast-node-type";
        typePlaceholder.textContent = valueType;
        syntaxContainer.appendChild(typePlaceholder);
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = "ast-placeholder";
        placeholder.textContent = "_____";
        syntaxContainer.appendChild(placeholder);
      }
      break;

    case "Identifier":
      const idSpan = document.createElement("span");
      idSpan.className = "ast-identifier";
      idSpan.textContent = node.name || "_____";
      syntaxContainer.appendChild(idSpan);
      break;

    case "StringLiteral":
      const strSpan = document.createElement("span");
      strSpan.className = "ast-string";
      strSpan.textContent = node.value !== undefined ? `"${node.value}"` : `"_____"`;
      syntaxContainer.appendChild(strSpan);
      break;

    case "NumericLiteral":
      const numSpan = document.createElement("span");
      numSpan.className = "ast-number";
      numSpan.textContent = node.value !== undefined ? node.value : "_____";
      syntaxContainer.appendChild(numSpan);
      break;

    case "BooleanLiteral":
      const boolSpan = document.createElement("span");
      boolSpan.className = "ast-boolean";
      boolSpan.textContent = node.value !== undefined ? (node.value ? "true" : "false") : "_____";
      syntaxContainer.appendChild(boolSpan);
      break;

    case "BinaryExpression":
      // Show left operand placeholder if missing
      if (!node.left) {
        const placeholder = document.createElement("span");
        placeholder.className = "ast-placeholder";
        placeholder.textContent = "_____";
        syntaxContainer.appendChild(placeholder);
        syntaxContainer.appendChild(document.createTextNode(" "));
      }

      // Show operator
      const opSpan = document.createElement("span");
      opSpan.className = "ast-operator";
      opSpan.textContent = node.operator || "?";
      syntaxContainer.appendChild(opSpan);

      // Show right operand placeholder if missing
      if (!node.right) {
        syntaxContainer.appendChild(document.createTextNode(" "));
        const placeholder = document.createElement("span");
        placeholder.className = "ast-placeholder";
        placeholder.textContent = "_____";
        syntaxContainer.appendChild(placeholder);
      }
      break;

    case "ConditionalExpression":
      // Display ternary with placeholders for missing parts
      if (!node.test) {
        const placeholder = document.createElement("span");
        placeholder.className = "ast-placeholder";
        placeholder.textContent = "_____";
        syntaxContainer.appendChild(placeholder);
      }

      syntaxContainer.appendChild(document.createTextNode(" ? "));

      if (!node.consequent) {
        const placeholder = document.createElement("span");
        placeholder.className = "ast-placeholder";
        placeholder.textContent = "_____";
        syntaxContainer.appendChild(placeholder);
      }

      syntaxContainer.appendChild(document.createTextNode(" : "));

      if (!node.alternate) {
        const placeholder = document.createElement("span");
        placeholder.className = "ast-placeholder";
        placeholder.textContent = "_____";
        syntaxContainer.appendChild(placeholder);
      }
      break;

    case "ReturnStatement":
      // Add the 'return' keyword with syntax highlighting
      const returnKeyword = document.createElement("span");
      returnKeyword.className = "ast-keyword";
      returnKeyword.textContent = "return";
      syntaxContainer.appendChild(returnKeyword);

      // If there's a return value or placeholder
      syntaxContainer.appendChild(document.createTextNode(" "));
      if (!node.argument) {
        const placeholder = document.createElement("span");
        placeholder.className = "ast-placeholder";
        placeholder.textContent = "_____";
        syntaxContainer.appendChild(placeholder);
      }
      break;

    case "ArrowFunctionExpression":
      // Render as (params) => ...

      // Opening parenthesis
      const openParenSpan = document.createElement("span");
      openParenSpan.className = "ast-punctuation";
      openParenSpan.textContent = "(";
      syntaxContainer.appendChild(openParenSpan);

      // Parameters or placeholder
      if (node.params && node.params.length > 0) {
        // Join parameter names with commas
        node.params.forEach((param, index) => {
          const paramSpan = document.createElement("span");
          paramSpan.className = "ast-identifier";
          paramSpan.textContent = param.name || "_____";
          syntaxContainer.appendChild(paramSpan);

          // Add comma if not the last parameter
          if (index < node.params.length - 1) {
            const commaSpan = document.createElement("span");
            commaSpan.className = "ast-punctuation";
            commaSpan.textContent = ", ";
            syntaxContainer.appendChild(commaSpan);
          }
        });
      } else {
        // Show placeholder for missing params
        const placeholder = document.createElement("span");
        placeholder.className = "ast-placeholder";
        placeholder.textContent = "_____";
        syntaxContainer.appendChild(placeholder);
      }

      // Closing parenthesis
      const closeParenSpan = document.createElement("span");
      closeParenSpan.className = "ast-punctuation";
      closeParenSpan.textContent = ")";
      syntaxContainer.appendChild(closeParenSpan);

      // Arrow
      const arrowSpan = document.createElement("span");
      arrowSpan.className = "ast-operator";
      arrowSpan.textContent = " => ";
      syntaxContainer.appendChild(arrowSpan);

      // Body placeholder if missing
      if (!node.body) {
        const placeholder = document.createElement("span");
        placeholder.className = "ast-placeholder";
        placeholder.textContent = "_____";
        syntaxContainer.appendChild(placeholder);
      } else if (node.body.type === "BlockStatement") {
        const braceSpan = document.createElement("span");
        braceSpan.className = "ast-punctuation";
        braceSpan.textContent = "{...}";
        syntaxContainer.appendChild(braceSpan);
      }
      break;

    case "BlockStatement":
      const braceSpan = document.createElement("span");
      braceSpan.className = "ast-punctuation";
      braceSpan.textContent = node.body?.length > 0
        ? `{ ${node.body.length} statements }`
        : "{ _____ }";
      syntaxContainer.appendChild(braceSpan);
      break;

    case "CallExpression":
      // Function name or placeholder
      if (node.callee?.name) {
        const calleeSpan = document.createElement("span");
        calleeSpan.className = "ast-identifier";
        calleeSpan.textContent = node.callee.name;
        syntaxContainer.appendChild(calleeSpan);
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = "ast-placeholder";
        placeholder.textContent = "_____";
        syntaxContainer.appendChild(placeholder);
      }

      // Opening parenthesis
      const openCallParen = document.createElement("span");
      openCallParen.className = "ast-punctuation";
      openCallParen.textContent = "(";
      syntaxContainer.appendChild(openCallParen);

      // Arguments
      if (node.arguments && node.arguments.length > 0) {
        syntaxContainer.appendChild(document.createTextNode(`${node.arguments.length} args`));
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = "ast-placeholder";
        placeholder.textContent = "_____";
        syntaxContainer.appendChild(placeholder);
      }

      // Closing parenthesis
      const closeCallParen = document.createElement("span");
      closeCallParen.className = "ast-punctuation";
      closeCallParen.textContent = ")";
      syntaxContainer.appendChild(closeCallParen);
      break;

    default:
      // For in-progress nodes or other types
      if (node._inProgress) {
        // Show node type with placeholder
        const typeSpan = document.createElement("span");
        typeSpan.className = "ast-node-type";
        // Make sure we display the clean node type
        typeSpan.textContent = nodeType || 'node';
        syntaxContainer.appendChild(typeSpan);

        syntaxContainer.appendChild(document.createTextNode(" "));
        const placeholder = document.createElement("span");
        placeholder.className = "ast-placeholder";
        placeholder.textContent = "_____";
        syntaxContainer.appendChild(placeholder);
      } else {
        // Show the node type for unknown node types
        const typeSpan = document.createElement("span");
        typeSpan.className = "ast-node-type";
        typeSpan.textContent = nodeType || 'Unknown';
        syntaxContainer.appendChild(typeSpan);
      }
  }

  // Add the syntax container to the node element
  nodeElement.appendChild(syntaxContainer);

  // Add children if there are any
  if (hasChildren) {
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "ast-node-children";

    // Add appropriate children based on node type
    if (node.type === "Program" && node.body) {
      // Add program statements
      node.body.forEach(statement => {
        const statementElement = createAstNodeElement(statement, false, step);
        childrenContainer.appendChild(statementElement);
      });
    } else if (node.type === "ConstDeclaration") {
      // Add initializer value as a separate child
      if (node.init) {
        const initElement = createAstNodeElement(node.init, false, step);
        childrenContainer.appendChild(initElement);
      }
    } else if (node.type === "ReturnStatement") {
      // Add return value as a child - without a label
      if (node.argument) {
        const argElement = createAstNodeElement(node.argument, false, step);
        childrenContainer.appendChild(argElement);
      }
    } else if (node.type === "BinaryExpression") {
      // Add left operand
      if (node.left) {
        const leftLabel = document.createElement("div");
        leftLabel.className = "ast-node-child-label";
        leftLabel.textContent = "left";
        childrenContainer.appendChild(leftLabel);

        const leftElement = createAstNodeElement(node.left, false, step);
        childrenContainer.appendChild(leftElement);
      }

      // Add right operand
      if (node.right) {
        const rightLabel = document.createElement("div");
        rightLabel.className = "ast-node-child-label";
        rightLabel.textContent = "right";
        childrenContainer.appendChild(rightLabel);

        const rightElement = createAstNodeElement(node.right, false, step);
        childrenContainer.appendChild(rightElement);
      }
    } else if (node.type === "ConditionalExpression") {
      // Add condition without a label
      if (node.test) {
        // No label for condition
        const testElement = createAstNodeElement(node.test, false, step);
        childrenContainer.appendChild(testElement);
      }

      // Add true branch with "?" label
      if (node.consequent) {
        const consLabel = document.createElement("div");
        consLabel.className = "ast-node-child-label";
        consLabel.textContent = "?";
        childrenContainer.appendChild(consLabel);

        const consElement = createAstNodeElement(node.consequent, false, step);
        childrenContainer.appendChild(consElement);
      }

      // Add false branch with ":" label
      if (node.alternate) {
        const altLabel = document.createElement("div");
        altLabel.className = "ast-node-child-label";
        altLabel.textContent = ":";
        childrenContainer.appendChild(altLabel);

        const altElement = createAstNodeElement(node.alternate, false, step);
        childrenContainer.appendChild(altElement);
      }
    } else if (node.type === "ArrowFunctionExpression") {
      // Add function body
      if (node.body) {
        // No label needed for the body
        const bodyElement = createAstNodeElement(node.body, false, step);
        childrenContainer.appendChild(bodyElement);
      }
    } else if (node.type === "BlockStatement") {
      // Add block statements without labels
      if (node.body && node.body.length > 0) {
        node.body.forEach(statement => {
          const statementElement = createAstNodeElement(statement, false, step);
          childrenContainer.appendChild(statementElement);
        });
      }
    } else if (node.type === "CallExpression") {
      // Add callee if it's complex (not just an identifier)
      if (node.callee && node.callee.type !== "Identifier") {
        const calleeLabel = document.createElement("div");
        calleeLabel.className = "ast-node-child-label";
        calleeLabel.textContent = "callee";
        childrenContainer.appendChild(calleeLabel);

        const calleeElement = createAstNodeElement(node.callee, false, step);
        childrenContainer.appendChild(calleeElement);
      }

      // Add arguments without labels
      if (node.arguments && node.arguments.length > 0) {
        node.arguments.forEach(arg => {
          const argElement = createAstNodeElement(arg, false, step);
          childrenContainer.appendChild(argElement);
        });
      }
    }

    nodeElement.appendChild(childrenContainer);
  }

  // Add click handler to toggle expansion
  nodeElement.addEventListener("click", (e) => {
    if (hasChildren) {
      toggleAstNodeExpansion(nodeElement);
    }
    e.stopPropagation();
  });

  return nodeElement;
}

/**
 * Toggle the expansion state of an AST node
 *
 * @param {HTMLElement} nodeElement - DOM element for the AST node
 */
function toggleAstNodeExpansion(nodeElement) {
  if (nodeElement.classList.contains("ast-node-expanded")) {
    nodeElement.classList.remove("ast-node-expanded");
    nodeElement.classList.add("ast-node-collapsed");
  } else {
    nodeElement.classList.remove("ast-node-collapsed");
    nodeElement.classList.add("ast-node-expanded");
  }
}

/**
 * Check if an AST node has children that should be rendered
 *
 * @param {Object} node - AST node
 * @returns {boolean} - True if the node has children
 */
function hasAstNodeChildren(node) {
  if (!node || !node.type) return false;

  return (
    (node.type === "Program" && node.body && node.body.length > 0) ||
    (node.type === "ConstDeclaration" && node.init) ||
    (node.type === "ReturnStatement" && node.argument) ||
    (node.type === "BinaryExpression" && (node.left || node.right)) ||
    (node.type === "ConditionalExpression" && (node.test || node.consequent || node.alternate)) ||
    (node.type === "ArrowFunctionExpression" && ((node.params && node.params.length > 0) || node.body)) ||
    (node.type === "BlockStatement" && node.body && node.body.length > 0) ||
    (node.type === "CallExpression" && ((node.arguments && node.arguments.length > 0) || node.callee))
  );
}

/**
 * Display a toast notification
 *
 * @param {string} message - Message to display
 */
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Show the toast
  setTimeout(() => toast.classList.add('show'), 10);

  // Hide and remove the toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 3000);
}

/**
 * Update the source code display with original source and prepare for interactive highlighting
 *
 * @param {Object} state - Visualization state
 */
function initializeSourceCodeDisplay(state) {
  // Clear the source code display
  state.ui.sourceCodeElement.innerHTML = '';

  // Create a document fragment to batch DOM operations
  const fragment = document.createDocumentFragment();

  // Process each character with special handling for newlines
  for (let i = 0; i < state.sourceCode.length; i++) {
    const char = state.sourceCode[i];

    if (char === '\n') {
      // For newlines, add a line break element
      fragment.appendChild(document.createElement('br'));

      // Also add a hidden span to track the newline character's position
      const newlineMarker = document.createElement('span');
      newlineMarker.style.display = 'none';
      newlineMarker.dataset.pos = i;
      newlineMarker.className = 'source-char newline-char';

      // Find which token this newline belongs to (if any)
      const tokenIndex = state.tokenizationData.sourceToToken[i];
      if (tokenIndex !== undefined) {
        newlineMarker.dataset.tokenIndex = tokenIndex;
      }

      fragment.appendChild(newlineMarker);
    } else {
      // For regular characters, create a visible span
      const charSpan = document.createElement('span');
      charSpan.textContent = char;
      charSpan.dataset.pos = i;
      charSpan.className = 'source-char';

      // Find which token this character belongs to
      const tokenIndex = state.tokenizationData.sourceToToken[i];
      if (tokenIndex !== undefined) {
        charSpan.dataset.tokenIndex = tokenIndex;
      }

      fragment.appendChild(charSpan);
    }
  }

  // Add all spans at once
  state.ui.sourceCodeElement.appendChild(fragment);

  // Add click handler to the source code container
  state.ui.sourceCodeElement.addEventListener('click', (event) => {
    // Find the closest character span that was clicked
    const charSpan = event.target.closest('.source-char');
    if (!charSpan) return;

    const position = parseInt(charSpan.dataset.pos, 10);
    const tokenIndex = state.tokenizationData.sourceToToken[position];

    if (tokenIndex !== undefined) {
      // Highlight both the source code and the token
      highlightSourceRange(state, tokenIndex);
      highlightToken(state, tokenIndex);
    }
  });
}

/**
 * Helper function to scroll an element into view if not already visible
 *
 * @param {HTMLElement} element - Element to scroll into view
 * @param {HTMLElement} container - The scrollable container
 */
function scrollIntoViewIfNeeded(element, container) {
  // Get the element's position relative to the container
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  // Check if the element is not fully visible
  const isNotFullyVisible =
    elementRect.bottom > containerRect.bottom || // Element extends below container
    elementRect.top < containerRect.top || // Element extends above container
    elementRect.right > containerRect.right || // Element extends to the right of container
    elementRect.left < containerRect.left; // Element extends to the left of container

  // Only scroll if the element is not fully visible
  if (isNotFullyVisible) {
    element.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "nearest"
    });
  }
}

/**
 * Update the name resolution display based on the current step
 *
 * @param {Object} state - Visualization state
 * @param {number} stepIndex - Current step index in name resolution
 */
function updateNameResolutionDisplay(state, stepIndex) {
  // Clear the name resolution list
  state.ui.nameResolutionListElement.innerHTML = "";

  // If no events or invalid step, return early
  if (!state.nameResolutionEvents ||
      !state.nameResolutionEvents.length ||
      stepIndex < 0) {
    return;
  }

  // Show events up to the current step
  for (let i = 0; i <= stepIndex && i < state.nameResolutionEvents.length; i++) {
    const event = state.nameResolutionEvents[i];
    const eventElement = document.createElement('div');
    eventElement.className = 'name-resolution-event';

    // Mark the current event
    if (i === stepIndex) {
      eventElement.classList.add('name-resolution-event-current');
    }

    // Format event information based on event type
    let eventDetails = '';

    // Add appropriate styling based on event type
    switch (event.type) {
      case 'declare':
        eventElement.classList.add('name-resolution-declare');
        eventDetails = `Declared: ${event.name}`;
        break;

      case 'declareParam':
        eventElement.classList.add('name-resolution-declare-param');
        eventDetails = `Parameter: ${event.name}`;
        break;

      case 'lookup':
        eventElement.classList.add('name-resolution-lookup');
        eventDetails = `Lookup: ${event.name} (${event.found ? 'found' : 'not found'})`;
        break;

      case 'enterScope':
        eventElement.classList.add('name-resolution-scope');
        eventDetails = `Enter ${event.nodeType} scope`;
        break;

      case 'leaveScope':
        eventElement.classList.add('name-resolution-scope');
        eventDetails = `Leave ${event.nodeType} scope`;
        break;

      case 'enterProgram':
        eventElement.classList.add('name-resolution-scope');
        eventDetails = `Enter global scope`;
        break;

      case 'leaveProgram':
        eventElement.classList.add('name-resolution-scope');
        eventDetails = `Leave global scope`;
        break;

      default:
        eventDetails = `Event: ${event.type}`;
    }

    eventElement.textContent = eventDetails;
    state.ui.nameResolutionListElement.appendChild(eventElement);
  }

  // Scroll to the current event
  if (stepIndex >= 0 && stepIndex < state.nameResolutionEvents.length) {
    const currentElement = state.ui.nameResolutionListElement.querySelector('.name-resolution-event-current');
    if (currentElement) {
      scrollIntoViewIfNeeded(currentElement, state.ui.nameResolutionListElement);
    }
  }
}

// Initialize the visualizer when the page loads
document.addEventListener("DOMContentLoaded", () => {
  initializeVisualization();
});

// Update CSS rule for placeholders
const style = document.createElement('style');
style.textContent = `
  .ast-placeholder {
    color: #999;
    font-style: italic;
    text-decoration: none;
    letter-spacing: 1px;
  }

  .ast-node-type {
    color: #666;
    font-style: italic;
    font-size: 0.9em;
  }
`;
document.head.appendChild(style);
