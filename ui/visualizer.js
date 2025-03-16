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

    // Filter out unwanted AST events and convert to visualization steps
    const filteredAstEvents = astData.events.filter(event => {
      // Skip Program, Statement, Primary, and Expression events
      const skipTypes = [
        "ProgramStart", "ProgramComplete",
        "StatementStart", "StatementComplete",
        "PrimaryStart", "PrimaryComplete",
        "ExpressionStart", "ExpressionComplete"
      ];

      return !skipTypes.some(type => event.type.includes(type));
    });

    state.astSteps = filteredAstEvents.map((event, index) => {
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

  // Show the step number in the AST container title for debugging
  const astTitle = document.querySelector('.ast-container h2');
  if (astTitle) {
    // For parsing phase, show the actual step number for debugging
    if (scrubberValue >= totalTokenizationSteps) {
      const astStepIndex = scrubberValue - totalTokenizationSteps;
      astTitle.textContent = `Abstract Syntax Tree (Step ${astStepIndex + 1}/${state.astSteps.length})`;
    } else {
      astTitle.textContent = `Abstract Syntax Tree`;
    }
  }

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

    // Update AST tree with the current step - use the exact step index without skipping
    updateAstDisplay(state, astStepIndex);
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

  console.log("Current step:", currentStep.type, currentStep.node);

  // Display the current step information
  const currentStepInfo = document.createElement('div');
  currentStepInfo.className = 'ast-current-step-info';

  // Simplify the event type for display
  const eventType = currentStep.type || 'Unknown';
  const cleanEventType = eventType
    .replace('Start', '')
    .replace('Complete', '');

  currentStepInfo.innerHTML = `<strong>Current Step ${astStepIndex}/${state.astSteps.length-1}:</strong> ${cleanEventType} (${currentStep.type.endsWith('Complete') ? 'Complete' : 'WIP'})`;
  currentStepInfo.style.padding = '5px';
  currentStepInfo.style.marginBottom = '10px';
  currentStepInfo.style.backgroundColor = '#f0f0f0';
  currentStepInfo.style.borderRadius = '4px';
  state.ui.astTreeElement.appendChild(currentStepInfo);

  // ============================================================================
  // TRACKING NODE STATE IMPROVED: KEEP BETTER TRACK OF INCOMPLETE VS COMPLETE
  // ============================================================================

  // Map to track the most recent state of each node by ID
  const nodeStates = new Map();
  // Map to specifically track ConstDeclaration nodes by their location in code
  const constDecls = new Map();

  // Process all steps up to the current one to build node state tracking
  for (let i = 0; i <= astStepIndex; i++) {
    const step = state.astSteps[i];
    if (!step || !step.node) continue;

    // Get clean type without Start/Complete
    const nodeType = step.type.replace('Start', '').replace('Complete', '');

    // Set completion status - VERY IMPORTANT: only "Complete" events mark completion
    const isComplete = step.type.endsWith('Complete');

    // Track if this is the current step
    const isCurrent = (i === astStepIndex);

    // Create node object with metadata
    const nodeObj = {
      ...step.node,
      _id: step.id,
      _type: step.type,
      _step: i,
      _isCurrent: isCurrent,
      _isComplete: isComplete,
      type: nodeType
    };

    // Extra tracking for ConstDeclaration nodes - helps us identify them uniquely
    if (nodeType === 'ConstDeclaration') {
      // Create a unique key based on position in source
      // This is necessary to distinguish between multiple const declarations
      const sourcePos = step.node.loc ? `${step.node.loc.start.line}:${step.node.loc.start.column}` : i;
      constDecls.set(sourcePos, nodeObj);

      // Debug output
      console.log(`ConstDecl at step ${i}: ${isComplete ? 'COMPLETE' : 'WIP'}, pos=${sourcePos}`, nodeObj);
    }

    // Store the node state keyed by ID
    nodeStates.set(step.id, nodeObj);
  }

  console.log("All node states:", nodeStates);
  console.log("ConstDeclaration nodes:", constDecls.values());

  // Create a final array of nodes to display, preserving order
  const nodesToDisplay = Array.from(nodeStates.values());

  // Sort nodes by step for consistent display order
  nodesToDisplay.sort((a, b) => a._step - b._step);

  // Now render all nodes with our improved tracking
  for (const node of nodesToDisplay) {
    // Create element with appropriate highlighting
    const nodeElement = createAstNodeElement(node, node._isCurrent, node._step);

    // Add special styling based on node state
    if (node._isCurrent) {
      nodeElement.classList.add("ast-node-current");
      nodeElement.style.borderLeft = '3px solid #3498db';

      // Special highlighting for current ConstDeclaration
      if (node.type === 'ConstDeclaration') {
        nodeElement.style.border = '2px solid #e74c3c';
        nodeElement.style.padding = '5px';
      }
    } else if (!node._isComplete) {
      nodeElement.classList.add("ast-node-partial");
      nodeElement.style.borderLeft = '3px solid #f39c12';
    }

    // Add to display
    state.ui.astTreeElement.appendChild(nodeElement);
  }
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
  // CRITICAL DEBUG: Check if blanks should be shown - always show for non-complete nodes
  const needsBlanks = !node._isComplete;

  // Add verbose debugging
  console.log(`Node ${node.type} (step ${step}): needsBlanks=${needsBlanks}, isComplete=${node._isComplete}`, node);

  const nodeElement = document.createElement("div");
  nodeElement.className = "ast-node";

  // Add debugging information as data attributes and title
  nodeElement.dataset.step = step;
  nodeElement.dataset.nodeType = node.type || '';
  nodeElement.dataset.isComplete = node._isComplete ? 'true' : 'false';
  nodeElement.dataset.needsBlanks = needsBlanks ? 'true' : 'false';
  nodeElement.setAttribute('title', `${node.type} (Step: ${step}) - ${node._isComplete ? 'Complete' : 'WIP - SHOULD SHOW BLANKS'}`);

  // Add expandable/collapsible functionality
  const hasChildren = hasAstNodeChildren(node);
  if (hasChildren) {
    nodeElement.classList.add("ast-node-expanded");
  }

  // Add appropriate class based on node state
  if (isCurrentStep) {
    nodeElement.classList.add("ast-node-current");
  }
  if (!node._isComplete) {
    nodeElement.classList.add("ast-node-partial");
    // Make WIP nodes VERY obvious
    nodeElement.style.border = '2px dashed #e74c3c';
    nodeElement.style.padding = '4px';
    nodeElement.style.margin = '2px 0';
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

  // If this is the current step or WIP, add extra highlighting to the syntax container
  if (isCurrentStep) {
    syntaxContainer.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
    syntaxContainer.style.padding = '2px 4px';
    syntaxContainer.style.borderRadius = '3px';
  }

  if (!node._isComplete) {
    syntaxContainer.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
    syntaxContainer.style.borderBottom = '1px dotted #e74c3c';
  }

  // SPECIAL DISPLAY MODE FOR CONST DECLARATIONS - ALWAYS SHOW PLACEHOLDERS FOR MISSING PARTS
  if (node.type === "ConstDeclaration") {
    // Add special color for ConstDeclaration
    syntaxContainer.style.backgroundColor = 'rgba(231, 76, 60, 0.15)';

    // Log specific details about this ConstDeclaration for debugging
    console.log("Rendering ConstDeclaration:", {
      step,
      isComplete: node._isComplete,
      hasId: !!node.id,
      hasName: !!(node.id && node.id.name),
      hasInit: !!node.init,
      initType: node.init ? node.init.type : 'none'
    });

    // Always show the const keyword
    const constKeyword = document.createElement("span");
    constKeyword.className = "ast-keyword";
    constKeyword.textContent = "const";
    syntaxContainer.appendChild(constKeyword);
    syntaxContainer.appendChild(document.createTextNode(" "));

    // Variable name - ALWAYS show blanks if missing OR if we're in an incomplete state
    if (node.id && node.id.name && node._isComplete) {
      const nameSpan = document.createElement("span");
      nameSpan.className = "ast-identifier";
      nameSpan.textContent = node.id.name;
      syntaxContainer.appendChild(nameSpan);
    } else {
      // Missing variable name or WIP node - ALWAYS show placeholder
      const placeholder = document.createElement("span");
      placeholder.className = "ast-placeholder";
      placeholder.textContent = node.id && node.id.name ? node.id.name : "_____";
      syntaxContainer.appendChild(placeholder);
    }

    // Always show equals sign
    syntaxContainer.appendChild(document.createTextNode(" = "));

    // Show initializer - ALWAYS show blanks if missing OR we're in incomplete state
    if (node.init && node._isComplete) {
      if (node.init.type === "StringLiteral" && node.init.value !== undefined) {
        const valueSpan = document.createElement("span");
        valueSpan.className = "ast-string";
        valueSpan.textContent = `"${node.init.value}"`;
        syntaxContainer.appendChild(valueSpan);
      } else if (node.init.type === "NumericLiteral" && node.init.value !== undefined) {
        const valueSpan = document.createElement("span");
        valueSpan.className = "ast-number";
        valueSpan.textContent = node.init.value;
        syntaxContainer.appendChild(valueSpan);
      } else if (node.init.type === "BooleanLiteral" && node.init.value !== undefined) {
        const valueSpan = document.createElement("span");
        valueSpan.className = "ast-boolean";
        valueSpan.textContent = node.init.value ? "true" : "false";
        syntaxContainer.appendChild(valueSpan);
      } else {
        // Complex expression
        const typePlaceholder = document.createElement("span");
        typePlaceholder.className = "ast-node-type";
        typePlaceholder.textContent = node.init.type || "unknown";
        syntaxContainer.appendChild(typePlaceholder);
      }
    } else {
      // ALWAYS show placeholder for missing initializer or incomplete state
      const placeholder = document.createElement("span");
      placeholder.className = "ast-placeholder";
      placeholder.textContent = "_____";
      syntaxContainer.appendChild(placeholder);
    }
  }
  // For other node types, render normally
  else {
    // Render based on node type - more concise and syntax-like
    switch (node.type) {
      case "Identifier":
        const idSpan = document.createElement("span");
        idSpan.className = "ast-identifier";
        // ALWAYS show blanks if name is missing
        if (node.name) {
          idSpan.textContent = node.name;
        } else {
          idSpan.className = "ast-placeholder";
          idSpan.textContent = "_____";
        }
        syntaxContainer.appendChild(idSpan);
        break;

      case "StringLiteral":
        const strSpan = document.createElement("span");
        strSpan.className = "ast-string";
        // ALWAYS show blanks if value is missing
        if (node.value !== undefined) {
          strSpan.textContent = `"${node.value}"`;
        } else {
          strSpan.className = "ast-placeholder";
          strSpan.textContent = `"_____"`;
        }
        syntaxContainer.appendChild(strSpan);
        break;

      case "NumericLiteral":
        const numSpan = document.createElement("span");
        numSpan.className = "ast-number";
        // ALWAYS show blanks if value is missing
        if (node.value !== undefined) {
          numSpan.textContent = node.value;
        } else {
          numSpan.className = "ast-placeholder";
          numSpan.textContent = "_____";
        }
        syntaxContainer.appendChild(numSpan);
        break;

      case "BooleanLiteral":
        const boolSpan = document.createElement("span");
        boolSpan.className = "ast-boolean";
        // ALWAYS show blanks if value is missing
        if (node.value !== undefined) {
          boolSpan.textContent = node.value ? "true" : "false";
        } else {
          boolSpan.className = "ast-placeholder";
          boolSpan.textContent = "_____";
        }
        syntaxContainer.appendChild(boolSpan);
        break;

      case "BinaryExpression":
        // Left operand - ALWAYS show blanks if missing
        if (node.left && node.left.type) {
          const leftType = document.createElement("span");
          leftType.className = "ast-node-type";
          leftType.textContent = node.left.type;
          syntaxContainer.appendChild(leftType);
        } else {
          const placeholder = document.createElement("span");
          placeholder.className = "ast-placeholder";
          placeholder.textContent = "_____";
          syntaxContainer.appendChild(placeholder);
        }

        syntaxContainer.appendChild(document.createTextNode(" "));

        // Operator - ALWAYS show blanks if missing
        const opSpan = document.createElement("span");
        if (node.operator) {
          opSpan.className = "ast-operator";
          opSpan.textContent = node.operator;
        } else {
          opSpan.className = "ast-placeholder";
          opSpan.textContent = "_____";
        }
        syntaxContainer.appendChild(opSpan);
        syntaxContainer.appendChild(document.createTextNode(" "));

        // Right operand - ALWAYS show blanks if missing
        if (node.right && node.right.type) {
          const rightType = document.createElement("span");
          rightType.className = "ast-node-type";
          rightType.textContent = node.right.type;
          syntaxContainer.appendChild(rightType);
        } else {
          const placeholder = document.createElement("span");
          placeholder.className = "ast-placeholder";
          placeholder.textContent = "_____";
          syntaxContainer.appendChild(placeholder);
        }
        break;

      case "ConditionalExpression":
        // Test condition - ALWAYS show blanks if missing
        if (node.test && node.test.type) {
          const testType = document.createElement("span");
          testType.className = "ast-node-type";
          testType.textContent = node.test.type;
          syntaxContainer.appendChild(testType);
        } else {
          const placeholder = document.createElement("span");
          placeholder.className = "ast-placeholder";
          placeholder.textContent = "_____";
          syntaxContainer.appendChild(placeholder);
        }

        syntaxContainer.appendChild(document.createTextNode(" ? "));

        // Consequent - ALWAYS show blanks if missing
        if (node.consequent && node.consequent.type) {
          const consType = document.createElement("span");
          consType.className = "ast-node-type";
          consType.textContent = node.consequent.type;
          syntaxContainer.appendChild(consType);
        } else {
          const placeholder = document.createElement("span");
          placeholder.className = "ast-placeholder";
          placeholder.textContent = "_____";
          syntaxContainer.appendChild(placeholder);
        }

        syntaxContainer.appendChild(document.createTextNode(" : "));

        // Alternate - ALWAYS show blanks if missing
        if (node.alternate && node.alternate.type) {
          const altType = document.createElement("span");
          altType.className = "ast-node-type";
          altType.textContent = node.alternate.type;
          syntaxContainer.appendChild(altType);
        } else {
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

        // Return value - ALWAYS show blanks if missing
        syntaxContainer.appendChild(document.createTextNode(" "));
        if (node.argument && node.argument.type) {
          const argType = document.createElement("span");
          argType.className = "ast-node-type";
          argType.textContent = node.argument.type;
          syntaxContainer.appendChild(argType);
        } else {
          const placeholder = document.createElement("span");
          placeholder.className = "ast-placeholder";
          placeholder.textContent = "_____";
          syntaxContainer.appendChild(placeholder);
        }
        break;

      case "ArrowFunctionExpression":
        // Opening parenthesis
        syntaxContainer.appendChild(document.createTextNode("("));

        // Parameters - ALWAYS show blanks if missing
        if (node.params && node.params.length > 0) {
          // Join parameter names with commas
          node.params.forEach((param, index) => {
            if (param.name) {
              const paramSpan = document.createElement("span");
              paramSpan.className = "ast-identifier";
              paramSpan.textContent = param.name;
              syntaxContainer.appendChild(paramSpan);
            } else {
              const placeholder = document.createElement("span");
              placeholder.className = "ast-placeholder";
              placeholder.textContent = "_____";
              syntaxContainer.appendChild(placeholder);
            }

            // Add comma if not the last parameter
            if (index < node.params.length - 1) {
              syntaxContainer.appendChild(document.createTextNode(", "));
            }
          });
        } else if (!node._isComplete) {
          // Show placeholder for missing params in incomplete node
          const placeholder = document.createElement("span");
          placeholder.className = "ast-placeholder";
          placeholder.textContent = "_____";
          syntaxContainer.appendChild(placeholder);
        }

        // Closing parenthesis and arrow
        syntaxContainer.appendChild(document.createTextNode(") => "));

        // Body - ALWAYS show blanks if missing
        if (node.body && node.body.type) {
          if (node.body.type === "BlockStatement") {
            const braceSpan = document.createElement("span");
            braceSpan.className = "ast-punctuation";
            braceSpan.textContent = "{...}";
            syntaxContainer.appendChild(braceSpan);
          } else {
            const bodyType = document.createElement("span");
            bodyType.className = "ast-node-type";
            bodyType.textContent = node.body.type;
            syntaxContainer.appendChild(bodyType);
          }
        } else {
          const placeholder = document.createElement("span");
          placeholder.className = "ast-placeholder";
          placeholder.textContent = "_____";
          syntaxContainer.appendChild(placeholder);
        }
        break;

      case "BlockStatement":
        const braceSpan = document.createElement("span");
        braceSpan.className = "ast-punctuation";
        if (node.body && node.body.length > 0) {
          braceSpan.textContent = `{ ${node.body.length} statements }`;
        } else {
          // ALWAYS show blanks if body is missing or empty in incomplete node
          if (!node._isComplete) {
            braceSpan.className = "ast-placeholder";
            braceSpan.textContent = "{ _____ }";
          } else {
            braceSpan.textContent = "{ }";
          }
        }
        syntaxContainer.appendChild(braceSpan);
        break;

      case "CallExpression":
        // Function name - ALWAYS show blanks if missing
        if (node.callee && node.callee.name) {
          const calleeSpan = document.createElement("span");
          calleeSpan.className = "ast-identifier";
          calleeSpan.textContent = node.callee.name;
          syntaxContainer.appendChild(calleeSpan);
        } else if (node.callee && node.callee.type) {
          const calleeType = document.createElement("span");
          calleeType.className = "ast-node-type";
          calleeType.textContent = node.callee.type;
          syntaxContainer.appendChild(calleeType);
        } else {
          const placeholder = document.createElement("span");
          placeholder.className = "ast-placeholder";
          placeholder.textContent = "_____";
          syntaxContainer.appendChild(placeholder);
        }

        // Arguments - ALWAYS show blanks if missing
        syntaxContainer.appendChild(document.createTextNode("("));
        if (node.arguments && node.arguments.length > 0) {
          syntaxContainer.appendChild(document.createTextNode(`${node.arguments.length} args`));
        } else if (!node._isComplete) {
          const placeholder = document.createElement("span");
          placeholder.className = "ast-placeholder";
          placeholder.textContent = "_____";
          syntaxContainer.appendChild(placeholder);
        }
        syntaxContainer.appendChild(document.createTextNode(")"));
        break;

      default:
        // Default handling for other node types or unknown nodes
        // ALWAYS show the node type and a placeholder for incomplete nodes

        // Node type
        const typeSpan = document.createElement("span");
        typeSpan.className = "ast-node-type";
        typeSpan.textContent = node.type || 'Unknown';
        syntaxContainer.appendChild(typeSpan);

        // For incomplete nodes, always add a placeholder
        if (!node._isComplete) {
          syntaxContainer.appendChild(document.createTextNode(" "));
          const placeholder = document.createElement("span");
          placeholder.className = "ast-placeholder";
          placeholder.textContent = "_____";
          syntaxContainer.appendChild(placeholder);
        }
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
      // Add identifier as child if it exists
      if (node.id) {
        const idLabel = document.createElement("div");
        idLabel.className = "ast-node-child-label";
        idLabel.textContent = "identifier";
        childrenContainer.appendChild(idLabel);

        const idElement = createAstNodeElement(node.id, false, step);
        childrenContainer.appendChild(idElement);
      }

      // Add initializer value as a separate child
      if (node.init) {
        const initLabel = document.createElement("div");
        initLabel.className = "ast-node-child-label";
        initLabel.textContent = "initializer";
        childrenContainer.appendChild(initLabel);

        const initElement = createAstNodeElement(node.init, false, step);
        childrenContainer.appendChild(initElement);
      }
    } else if (node.type === "ReturnStatement") {
      // Add return value as a child
      if (node.argument) {
        const argLabel = document.createElement("div");
        argLabel.className = "ast-node-child-label";
        argLabel.textContent = "value";
        childrenContainer.appendChild(argLabel);

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
      // Add condition
      if (node.test) {
        const testLabel = document.createElement("div");
        testLabel.className = "ast-node-child-label";
        testLabel.textContent = "condition";
        childrenContainer.appendChild(testLabel);

        const testElement = createAstNodeElement(node.test, false, step);
        childrenContainer.appendChild(testElement);
      }

      // Add true branch
      if (node.consequent) {
        const consLabel = document.createElement("div");
        consLabel.className = "ast-node-child-label";
        consLabel.textContent = "if true";
        childrenContainer.appendChild(consLabel);

        const consElement = createAstNodeElement(node.consequent, false, step);
        childrenContainer.appendChild(consElement);
      }

      // Add false branch
      if (node.alternate) {
        const altLabel = document.createElement("div");
        altLabel.className = "ast-node-child-label";
        altLabel.textContent = "if false";
        childrenContainer.appendChild(altLabel);

        const altElement = createAstNodeElement(node.alternate, false, step);
        childrenContainer.appendChild(altElement);
      }
    } else if (node.type === "ArrowFunctionExpression") {
      // Add params
      if (node.params && node.params.length > 0) {
        const paramsLabel = document.createElement("div");
        paramsLabel.className = "ast-node-child-label";
        paramsLabel.textContent = "parameters";
        childrenContainer.appendChild(paramsLabel);

        node.params.forEach(param => {
          const paramElement = createAstNodeElement(param, false, step);
          childrenContainer.appendChild(paramElement);
        });
      }

      // Add function body
      if (node.body) {
        const bodyLabel = document.createElement("div");
        bodyLabel.className = "ast-node-child-label";
        bodyLabel.textContent = "body";
        childrenContainer.appendChild(bodyLabel);

        const bodyElement = createAstNodeElement(node.body, false, step);
        childrenContainer.appendChild(bodyElement);
      }
    } else if (node.type === "BlockStatement") {
      // Add block statements
      if (node.body && node.body.length > 0) {
        const statementsLabel = document.createElement("div");
        statementsLabel.className = "ast-node-child-label";
        statementsLabel.textContent = "statements";
        childrenContainer.appendChild(statementsLabel);

        node.body.forEach(statement => {
          const statementElement = createAstNodeElement(statement, false, step);
          childrenContainer.appendChild(statementElement);
        });
      }
    } else if (node.type === "CallExpression") {
      // Add callee
      if (node.callee && node.callee.type !== "Identifier") {
        const calleeLabel = document.createElement("div");
        calleeLabel.className = "ast-node-child-label";
        calleeLabel.textContent = "callee";
        childrenContainer.appendChild(calleeLabel);

        const calleeElement = createAstNodeElement(node.callee, false, step);
        childrenContainer.appendChild(calleeElement);
      }

      // Add arguments
      if (node.arguments && node.arguments.length > 0) {
        const argsLabel = document.createElement("div");
        argsLabel.className = "ast-node-child-label";
        argsLabel.textContent = "arguments";
        childrenContainer.appendChild(argsLabel);

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

// Initialize the visualizer when the page loads
document.addEventListener("DOMContentLoaded", () => {
  initializeVisualization();
});

// Update CSS rule for placeholders
const style = document.createElement('style');
style.textContent = `
  .ast-placeholder {
    color: #e74c3c;
    font-style: italic;
    text-decoration: none;
    letter-spacing: 1px;
    background-color: rgba(231, 76, 60, 0.1);
    padding: 1px 3px;
    border-radius: 2px;
    display: inline-block;
  }

  .ast-node-type {
    color: #3498db;
    font-style: italic;
    font-size: 0.9em;
    background-color: rgba(52, 152, 219, 0.1);
    padding: 1px 3px;
    border-radius: 2px;
  }

  .ast-node-current > .ast-syntax {
    background-color: rgba(52, 152, 219, 0.15);
    padding: 3px 5px;
    border-radius: 3px;
    display: inline-block;
  }

  .ast-node-partial > .ast-syntax {
    background-color: rgba(243, 156, 18, 0.1);
    padding: 3px;
    border-radius: 3px;
    display: inline-block;
  }
`;
document.head.appendChild(style);
