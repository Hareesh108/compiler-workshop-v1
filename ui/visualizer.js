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
    totalSteps: 0, // Total steps across both tokenization and parsing

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
  try {
    // Clear previous displays
    state.ui.tokensListElement.innerHTML = "";
    state.ui.astTreeElement.innerHTML = "";

    // Build tokenization data using events
    const tokenizationData = buildTokenizationData(state.sourceCode);

    // Store tokens and data
    state.tokens = tokenizationData.tokens;
    state.tokenizationData = tokenizationData;

    // Initialize the source code display with character spans
    initializeSourceCodeDisplay(state);

    // Build AST data using the tokens
    const astData = buildAstData(state.sourceCode, state.tokens);
    state.astData = astData;
    state.ast = astData.rootNode;

    // Filter the tokenization events to only include token events
    const tokenEvents = tokenizationData.events.filter(event =>
      event.type !== "WHITESPACE" && event.type !== "COMMENT"
    );

    // Convert tokenization events to visualization steps
    state.visualizationSteps = tokenEvents.map((event, index) => {
      // Find all tokens up to and including this token
      const tokensUpToHere = tokenizationData.tokens.slice(0, index + 1);

      return {
        type: "token",
        token: event,
        position: event.position,
        length: event.length,
        currentTokens: tokensUpToHere,
        eventIndex: index
      };
    });

    // Add an initial step
    state.visualizationSteps.unshift({
      type: "initial",
      position: 0,
      length: 0,
      currentTokens: [],
      eventIndex: -1
    });

    // Convert AST events to visualization steps
    state.astSteps = astData.events.map((event, index) => {
      // Clone the event to avoid modifying the original
      return {
        ...event,
        stepIndex: index,
        isComplete: event.type.endsWith("Complete")
      };
    });

    // Calculate total steps (tokenization + parsing)
    state.totalSteps = state.visualizationSteps.length + state.astSteps.length;

    // Reset UI
    state.currentStepIndex = 0;
    // Set max to the number of steps
    state.ui.scrubber.max = Math.max(0, state.totalSteps - 1);
    state.ui.scrubber.value = 0;

    // Reset scroll positions
    state.ui.tokensListElement.scrollTop = 0;
    state.ui.sourceCodeElement.scrollTop = 0;
    state.ui.astTreeElement.scrollTop = 0;

    // Update the visualization
    updateVisualization(state);

    // Focus the scrubber
    state.ui.scrubber.focus();
  } catch (error) {
    showToast(`Compilation error: ${error.message}`);
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
  const totalTokenizationSteps = state.visualizationSteps.length;
  const totalSteps = state.totalSteps;

  // Determine if we're in tokenization or parsing phase
  if (scrubberValue < totalTokenizationSteps) {
    // We're in the tokenization phase
    state.currentStepIndex = scrubberValue;

    // Update tokens list
    updateTokensDisplay(state);

    // Update source code highlighting
    updateSourceCodeHighlighting(state);

    // Clear AST display
    state.ui.astTreeElement.innerHTML = "";
  } else {
    // We're in the parsing phase
    const astStepIndex = scrubberValue - totalTokenizationSteps;

    // Show all tokens
    updateTokensDisplay(state, true);

    // Show all source code
    updateSourceCodeHighlighting(state, true);

    // Skip insignificant steps and find the next significant step
    if (astStepIndex > 0 && !isSignificantAstStep(state.astSteps, astStepIndex)) {
      const nextIndex = findNextSignificantStep(state.astSteps, astStepIndex);
      if (nextIndex !== -1 && nextIndex < state.astSteps.length) {
        // If found, jump to that step
        state.ui.scrubber.value = (totalTokenizationSteps + nextIndex).toString();
        updateVisualization(state);
        return;
      }
    }

    // Update AST tree with the current step
    updateAstDisplay(state, astStepIndex);
  }
}

/**
 * Check if an AST step is significant (shows something new)
 *
 * @param {Array} astSteps - Array of AST steps
 * @param {number} currentIndex - Current step index
 * @returns {boolean} - Whether this step shows something new
 */
function isSignificantAstStep(astSteps, currentIndex) {
  if (currentIndex <= 0) return true;
  if (currentIndex >= astSteps.length) return false;

  const currentStep = astSteps[currentIndex];
  const previousStep = astSteps[currentIndex - 1];

  // A step is significant if:
  // 1. It completes a node (shows the finished node)
  // 2. It starts a new node type we haven't seen before
  // 3. It has different node properties than the previous step

  // If it's a completion step, it's significant
  if (currentStep.type && currentStep.type.endsWith('Complete')) {
    return true;
  }

  // If it's a different node type than the previous step, it's significant
  if (currentStep.type !== previousStep.type) {
    return true;
  }

  // If no node, or same node as previous step with no changes, it's not significant
  if (!currentStep.node || currentStep.id === previousStep.id) {
    return false;
  }

  return true;
}

/**
 * Find the next significant step in the AST visualization
 *
 * @param {Array} astSteps - Array of AST steps
 * @param {number} currentIndex - Current step index
 * @returns {number} - Index of the next significant step or -1 if none found
 */
function findNextSignificantStep(astSteps, currentIndex) {
  for (let i = currentIndex + 1; i < astSteps.length; i++) {
    if (isSignificantAstStep(astSteps, i)) {
      return i;
    }
  }
  return -1;
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

  // Create a completely new mapping of nodes to avoid duplicates
  const nodeMap = new Map();  // Map of node IDs to their data
  const topLevelIds = new Set(); // Set of IDs for top-level nodes
  const currentStepIds = new Set(); // Set of IDs for nodes in the current step

  // First pass: collect nodes up to this step
  for (let i = 0; i <= astStepIndex; i++) {
    const step = state.astSteps[i];
    if (!step || !step.node) continue;

    const isCurrentStep = i === astStepIndex;
    if (isCurrentStep && step.id) {
      currentStepIds.add(step.id);
    }

    // Process based on node type
    if (step.type) {
      const nodeId = step.id;

      // Create or update the node data
      const existingNode = nodeMap.get(nodeId);

      // If this node completes or replaces a previous version, update it
      if (step.type.endsWith('Complete') || !step.type.endsWith('Start')) {
        // This is a completed or partial node
        nodeMap.set(nodeId, {
          ...step.node,
          _id: nodeId,
          _type: step.type,
          _isCurrentStep: isCurrentStep
        });
      } else if (step.type.endsWith('Start') && !existingNode) {
        // This is a node in progress (only add if we don't have a complete version)
        nodeMap.set(nodeId, {
          _id: nodeId,
          _type: step.type,
          _isCurrentStep: isCurrentStep,
          _inProgress: true,
          type: step.type.replace('Start', '')
        });
      }

      // Track top-level nodes
      if (step.type === 'ProgramComplete' ||
          step.type === 'ConstDeclarationComplete' ||
          step.type === 'ConstDeclarationStart' ||
          step.type === 'ReturnStatementComplete' ||
          step.type === 'ReturnStatementStart' ||
          step.type === 'ArrowFunctionExpressionComplete' ||
          step.type === 'ArrowFunctionExpressionStart') {
        topLevelIds.add(nodeId);
      }
    }
  }

  // Find program node (if any)
  let programNode = null;
  for (const node of nodeMap.values()) {
    if (node.type === 'Program') {
      programNode = node;
      break;
    }
  }

  // Determine top-level nodes to display
  let nodesToRender = [];

  if (programNode && programNode.body && programNode.body.length > 0) {
    // Use program statements as top-level nodes
    nodesToRender = programNode.body;
  } else {
    // Filter out top-level nodes from our map
    nodesToRender = Array.from(nodeMap.values()).filter(node => {
      return node && (
        node.type === 'ConstDeclaration' ||
        node.type === 'ReturnStatement' ||
        node.type === 'ArrowFunctionExpression' ||
        (node._type && (
          node._type === 'ConstDeclarationStart' ||
          node._type === 'ReturnStatementStart' ||
          node._type === 'ArrowFunctionStart'
        ))
      );
    });

    // Sort by position or ID
    nodesToRender.sort((a, b) => {
      const posA = a.position || (a._id || 0);
      const posB = b.position || (b._id || 0);
      return posA - posB;
    });

    // Remove duplicates (prefer completed nodes over in-progress)
    const uniqueNodes = [];
    const seenKeys = new Set();

    for (const node of nodesToRender) {
      // Generate a key based on type and position/name
      let key;
      if (node.type === 'ConstDeclaration' && node.id) {
        key = `const-${node.id.name}`;
      } else if (node.type === 'ReturnStatement') {
        key = `return-${node.position || node._id}`;
      } else if (node.type === 'ArrowFunctionExpression') {
        key = `arrow-${node.position || node._id}`;
      } else if (node._type) {
        // In-progress nodes
        const baseType = node._type.replace('Start', '');
        key = `${baseType.toLowerCase()}-${node._id}`;
      } else {
        // Fallback
        key = `${node.type || 'node'}-${node.position || node._id}`;
      }

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueNodes.push(node);
      }
    }

    nodesToRender = uniqueNodes;
  }

  // Render each node
  nodesToRender.forEach(node => {
    if (!node) return;

    // Check if this node is part of the current step
    const isCurrentNode = node._isCurrentStep ||
                           (node._id && currentStepIds.has(node._id));

    const nodeElement = createAstNodeElement(node, isCurrentNode);
    state.ui.astTreeElement.appendChild(nodeElement);
  });
}

/**
 * Create an AST node element for visualization with expand/collapse functionality
 *
 * @param {Object} node - AST node
 * @param {boolean} isCurrentStep - Whether this node is part of the current step
 * @returns {HTMLElement} - DOM element representing the node
 */
function createAstNodeElement(node, isCurrentStep = false) {
  const nodeElement = document.createElement("div");
  nodeElement.className = "ast-node";

  // Add node type as title attribute for hover tooltip
  const nodeType = node.type || node._type?.replace('Start', '');
  nodeElement.setAttribute('title', nodeType);

  // Add expandable/collapsible functionality
  const hasChildren = hasAstNodeChildren(node);
  if (hasChildren) {
    nodeElement.classList.add("ast-node-expanded");
  }

  // Add appropriate class based on node state
  if (isCurrentStep || node._isCurrentStep) {
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
  switch (node.type) {
    case "ConstDeclaration":
      // Simplify to just show "Const" at the top level
      syntaxContainer.textContent = "Const";
      // Use the same styling as Ternary for consistency
      syntaxContainer.className = "ast-syntax";
      break;

    case "Identifier":
      const idSpan = document.createElement("span");
      idSpan.className = "ast-identifier";
      idSpan.textContent = node.name || "";
      syntaxContainer.appendChild(idSpan);
      break;

    case "StringLiteral":
      const strSpan = document.createElement("span");
      strSpan.className = "ast-string";
      strSpan.textContent = `"${node.value}"`;
      syntaxContainer.appendChild(strSpan);
      break;

    case "NumericLiteral":
      const numSpan = document.createElement("span");
      numSpan.className = "ast-number";
      numSpan.textContent = node.value;
      syntaxContainer.appendChild(numSpan);
      break;

    case "BooleanLiteral":
      const boolSpan = document.createElement("span");
      boolSpan.className = "ast-boolean";
      boolSpan.textContent = node.value ? "true" : "false";
      syntaxContainer.appendChild(boolSpan);
      break;

    case "BinaryExpression":
      // Just show the operator, children will show the operands
      const opSpan = document.createElement("span");
      opSpan.className = "ast-operator";
      opSpan.textContent = node.operator;
      syntaxContainer.appendChild(opSpan);
      break;

    case "ConditionalExpression":
      // Show ternary operator
      syntaxContainer.textContent = "? :";
      // Keep consistent with the other node types
      syntaxContainer.className = "ast-syntax";
      break;

    case "ReturnStatement":
      // Add the 'return' keyword with syntax highlighting
      const returnKeyword = document.createElement("span");
      returnKeyword.className = "ast-keyword";
      returnKeyword.textContent = "return";
      syntaxContainer.appendChild(returnKeyword);

      // If there's a return value, add a space after 'return'
      if (node.argument) {
        syntaxContainer.appendChild(document.createTextNode(" "));
      }
      break;

    case "ArrowFunctionExpression":
      // Render as (params) => ...
      const paramCount = node.params?.length || 0;

      // Opening parenthesis
      const openParenSpan = document.createElement("span");
      openParenSpan.className = "ast-punctuation";
      openParenSpan.textContent = "(";
      syntaxContainer.appendChild(openParenSpan);

      // Parameters
      if (node.params && node.params.length > 0) {
        // Join parameter names with commas
        node.params.forEach((param, index) => {
          const paramSpan = document.createElement("span");
          paramSpan.className = "ast-identifier";
          paramSpan.textContent = param.name;
          syntaxContainer.appendChild(paramSpan);

          // Add type annotation if present
          if (param.typeAnnotation) {
            const typeColonSpan = document.createElement("span");
            typeColonSpan.className = "ast-operator";
            typeColonSpan.textContent = ": ";
            syntaxContainer.appendChild(typeColonSpan);

            const typeSpan = document.createElement("span");
            typeSpan.className = "ast-type";
            typeSpan.textContent = param.typeAnnotation.valueType;
            syntaxContainer.appendChild(typeSpan);
          }

          // Add comma if not the last parameter
          if (index < node.params.length - 1) {
            const commaSpan = document.createElement("span");
            commaSpan.className = "ast-punctuation";
            commaSpan.textContent = ", ";
            syntaxContainer.appendChild(commaSpan);
          }
        });
      }

      // Closing parenthesis
      const closeParenSpan = document.createElement("span");
      closeParenSpan.className = "ast-punctuation";
      closeParenSpan.textContent = ")";
      syntaxContainer.appendChild(closeParenSpan);

      // Return type annotation if present
      if (node.returnType) {
        const returnTypeColon = document.createElement("span");
        returnTypeColon.className = "ast-operator";
        returnTypeColon.textContent = ": ";
        syntaxContainer.appendChild(returnTypeColon);

        const returnTypeSpan = document.createElement("span");
        returnTypeSpan.className = "ast-type";
        returnTypeSpan.textContent = node.returnType.valueType;
        syntaxContainer.appendChild(returnTypeSpan);
      }

      // Arrow
      const arrowSpan = document.createElement("span");
      arrowSpan.className = "ast-operator";
      arrowSpan.textContent = " => ";
      syntaxContainer.appendChild(arrowSpan);

      // Expression or block indicator
      if (node.expression) {
        // Expression function
        syntaxContainer.appendChild(document.createTextNode("expression"));
      } else if (node.body && node.body.type === "BlockStatement") {
        // Block function
        const openBraceSpan = document.createElement("span");
        openBraceSpan.className = "ast-punctuation";
        openBraceSpan.textContent = "{...}";
        syntaxContainer.appendChild(openBraceSpan);
      }
      break;

    case "BlockStatement":
      const braceSpan = document.createElement("span");
      braceSpan.className = "ast-punctuation";
      braceSpan.textContent = `{ ${node.body?.length || 0} statements }`;
      syntaxContainer.appendChild(braceSpan);
      break;

    case "CallExpression":
      // Function name
      if (node.callee?.name) {
        const calleeSpan = document.createElement("span");
        calleeSpan.className = "ast-identifier";
        calleeSpan.textContent = node.callee.name;
        syntaxContainer.appendChild(calleeSpan);
      } else {
        // Complex callee
        syntaxContainer.appendChild(document.createTextNode("(...)"));
      }

      // Opening parenthesis
      const openCallParen = document.createElement("span");
      openCallParen.className = "ast-punctuation";
      openCallParen.textContent = "(";
      syntaxContainer.appendChild(openCallParen);

      // Argument count
      if (node.arguments && node.arguments.length > 0) {
        syntaxContainer.appendChild(document.createTextNode(`${node.arguments.length} args`));
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
        syntaxContainer.textContent = "(building...)";
      } else {
        // Show the node type for unknown node types
        syntaxContainer.textContent = nodeType;
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
        const statementElement = createAstNodeElement(statement);
        childrenContainer.appendChild(statementElement);
      });
    } else if (node.type === "ConstDeclaration") {
      // Add variable name and initialization as a child
      if (node.id) {
        // Add a label for the variable name
        const nameLabel = document.createElement("div");
        nameLabel.className = "ast-node-child-label";
        nameLabel.textContent = "name";
        childrenContainer.appendChild(nameLabel);

        // Create a node-like element for the variable name
        const nameContainer = document.createElement("div");
        nameContainer.className = "ast-node ast-node-highlighted";

        const nameSyntax = document.createElement("span");
        nameSyntax.className = "ast-syntax";

        // Add the identifier name
        const nameSpan = document.createElement("span");
        nameSpan.className = "ast-identifier";
        nameSpan.textContent = node.id.name;
        nameSyntax.appendChild(nameSpan);

        // Add type annotation if present
        if (node.typeAnnotation) {
          const typeSpan = document.createElement("span");
          typeSpan.className = "ast-operator";
          typeSpan.textContent = ": ";
          nameSyntax.appendChild(typeSpan);

          const typeValueSpan = document.createElement("span");
          typeValueSpan.className = "ast-type";
          typeValueSpan.textContent = node.typeAnnotation.valueType;
          nameSyntax.appendChild(typeValueSpan);
        }

        // Add equals sign
        const equalsSpan = document.createElement("span");
        equalsSpan.className = "ast-operator";
        equalsSpan.textContent = " = ";
        nameSyntax.appendChild(equalsSpan);

        nameContainer.appendChild(nameSyntax);
        childrenContainer.appendChild(nameContainer);
      }

      // Add initializer value as a separate child
      if (node.init) {
        const initElement = createAstNodeElement(node.init);
        childrenContainer.appendChild(initElement);
      }
    } else if (node.type === "ReturnStatement") {
      // Add return value as a child - without a label
      if (node.argument) {
        const argElement = createAstNodeElement(node.argument);
        childrenContainer.appendChild(argElement);
      }
    } else if (node.type === "BinaryExpression") {
      // Add left operand
      if (node.left) {
        const leftLabel = document.createElement("div");
        leftLabel.className = "ast-node-child-label";
        leftLabel.textContent = "left";
        childrenContainer.appendChild(leftLabel);

        const leftElement = createAstNodeElement(node.left);
        childrenContainer.appendChild(leftElement);
      }

      // Add right operand
      if (node.right) {
        const rightLabel = document.createElement("div");
        rightLabel.className = "ast-node-child-label";
        rightLabel.textContent = "right";
        childrenContainer.appendChild(rightLabel);

        const rightElement = createAstNodeElement(node.right);
        childrenContainer.appendChild(rightElement);
      }
    } else if (node.type === "ConditionalExpression") {
      // Add condition without a label
      if (node.test) {
        // No label for condition
        const testElement = createAstNodeElement(node.test);
        childrenContainer.appendChild(testElement);
      }

      // Add true branch with "?" label
      if (node.consequent) {
        const consLabel = document.createElement("div");
        consLabel.className = "ast-node-child-label";
        consLabel.textContent = "?";
        childrenContainer.appendChild(consLabel);

        const consElement = createAstNodeElement(node.consequent);
        childrenContainer.appendChild(consElement);
      }

      // Add false branch with ":" label
      if (node.alternate) {
        const altLabel = document.createElement("div");
        altLabel.className = "ast-node-child-label";
        altLabel.textContent = ":";
        childrenContainer.appendChild(altLabel);

        const altElement = createAstNodeElement(node.alternate);
        childrenContainer.appendChild(altElement);
      }
    } else if (node.type === "ArrowFunctionExpression") {
      // Add function body
      if (node.body) {
        // No label needed for the body
        const bodyElement = createAstNodeElement(node.body);
        childrenContainer.appendChild(bodyElement);
      }
    } else if (node.type === "BlockStatement") {
      // Add block statements without labels
      if (node.body && node.body.length > 0) {
        node.body.forEach(statement => {
          const statementElement = createAstNodeElement(statement);
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

        const calleeElement = createAstNodeElement(node.callee);
        childrenContainer.appendChild(calleeElement);
      }

      // Add arguments without labels
      if (node.arguments && node.arguments.length > 0) {
        node.arguments.forEach(arg => {
          const argElement = createAstNodeElement(arg);
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

// Initialize the visualizer when the page loads
document.addEventListener("DOMContentLoaded", () => {
  initializeVisualization();
});
