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

    // Update AST tree
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

  // Collect all completed nodes up to this step
  const completedNodes = new Map();
  const inProgressNodes = new Map();

  // First pass: collect all nodes
  for (let i = 0; i <= astStepIndex; i++) {
    const step = state.astSteps[i];
    if (!step) continue;

    const isCurrentStep = i === astStepIndex;

    if (step.node) {
      if (step.type && step.type.endsWith('Complete')) {
        // This is a completed node
        completedNodes.set(step.id, {
          ...step.node,
          _id: step.id,
          _type: step.type,
          _isCurrentStep: isCurrentStep
        });
      } else if (step.type && !step.type.endsWith('Complete') && !step.type.endsWith('Start')) {
        // This is a partial node (like an identifier)
        completedNodes.set(step.id, {
          ...step.node,
          _id: step.id,
          _type: step.type,
          _isCurrentStep: isCurrentStep
        });
      } else if (step.type) {
        // This is a node in progress
        inProgressNodes.set(step.id, {
          _id: step.id,
          _type: step.type,
          _isCurrentStep: isCurrentStep,
          _inProgress: true,
          type: step.type.replace('Start', '')
        });
      }
    }
  }

  // Always use the direct rendering of top-level nodes approach:
  // Get all top-level nodes from the Program node body if it exists
  let topLevelNodes = [];
  const programNode = Array.from(completedNodes.values())
    .find(node => node && node.type === 'Program');

  if (programNode && programNode.body && programNode.body.length > 0) {
    // Just use the program's body statements directly as top-level nodes
    topLevelNodes = programNode.body;
  } else {
    // If there's no program node yet, collect all top-level statement nodes
    topLevelNodes = Array.from(completedNodes.values())
      .filter(node => {
        return node && (
          node.type === 'ConstDeclaration' ||
          node.type === 'ReturnStatement' ||
          node.type === 'ArrowFunctionExpression'
        );
      });
  }

  // Add any in-progress top-level nodes
  const inProgressTopLevelNodes = Array.from(inProgressNodes.values())
    .filter(node => {
      return node && node._type && (
        node._type === 'ConstDeclarationStart' ||
        node._type === 'ReturnStatementStart' ||
        node._type === 'ArrowFunctionStart'
      );
    });

  // Combine and sort by ID or position to maintain order
  const allTopLevelNodes = [...topLevelNodes, ...inProgressTopLevelNodes]
    .sort((a, b) => {
      // Try to use position if available
      const posA = a.position || a._position || (a._id || 0);
      const posB = b.position || b._position || (b._id || 0);
      return posA - posB;
    });

  // Render each top-level node
  allTopLevelNodes.forEach(node => {
    if (node) {
      const nodeElement = createAstNodeElement(node, node._isCurrentStep);
      state.ui.astTreeElement.appendChild(nodeElement);
    }
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

  // Add expandable/collapsible functionality
  const hasChildren = hasAstNodeChildren(node);
  if (hasChildren) {
    nodeElement.classList.add("ast-node-expanded");
  }

  // Add appropriate class based on node state
  if (node._isCurrentStep) {
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

  // Add the node type
  const typeElement = document.createElement("span");
  typeElement.className = "ast-node-type";
  typeElement.textContent = node.type || node._type?.replace('Start', '');
  nodeElement.appendChild(typeElement);

  // Add node details based on type
  const detailsElement = document.createElement("span");
  detailsElement.className = "ast-node-details";

  switch (node.type) {
    case "ConstDeclaration":
      if (node.id) {
        detailsElement.textContent = `const ${node.id.name}`;
        if (node.typeAnnotation) {
          detailsElement.textContent += `: ${node.typeAnnotation.valueType}`;
        }
      } else {
        detailsElement.textContent = "const (incomplete)";
      }
      break;

    case "Identifier":
      detailsElement.textContent = node.name || "";
      break;

    case "StringLiteral":
      detailsElement.textContent = `"${node.value}"`;
      break;

    case "NumericLiteral":
      detailsElement.textContent = node.value;
      break;

    case "BooleanLiteral":
      detailsElement.textContent = node.value ? "true" : "false";
      break;

    case "BinaryExpression":
      detailsElement.textContent = `${node.operator}`;
      break;

    case "ConditionalExpression":
      detailsElement.textContent = "? :";
      break;

    case "ReturnStatement":
      detailsElement.textContent = "return";
      break;

    case "Program":
      detailsElement.textContent = `${node.body?.length || 0} statements`;
      break;

    case "ArrowFunctionExpression":
      const paramCount = node.params?.length || 0;
      detailsElement.textContent = `(${paramCount} params) =>`;
      break;

    case "BlockStatement":
      detailsElement.textContent = `{ ${node.body?.length || 0} statements }`;
      break;

    case "CallExpression":
      if (node.callee?.name) {
        detailsElement.textContent = `${node.callee.name}(${node.arguments?.length || 0} args)`;
      } else {
        detailsElement.textContent = `(...)(${node.arguments?.length || 0} args)`;
      }
      break;

    default:
      // For in-progress nodes
      if (node._inProgress) {
        detailsElement.textContent = "(building...)";
      }
  }

  nodeElement.appendChild(detailsElement);

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
      // Add initializer
      if (node.init) {
        const initLabel = document.createElement("div");
        initLabel.className = "ast-node-child-label";
        initLabel.textContent = "initialized to:";
        childrenContainer.appendChild(initLabel);

        const initElement = createAstNodeElement(node.init);
        childrenContainer.appendChild(initElement);
      }
    } else if (node.type === "ReturnStatement") {
      // Add return value if there is one
      if (node.argument) {
        const argLabel = document.createElement("div");
        argLabel.className = "ast-node-child-label";
        argLabel.textContent = "value:";
        childrenContainer.appendChild(argLabel);

        const argElement = createAstNodeElement(node.argument);
        childrenContainer.appendChild(argElement);
      }
    } else if (node.type === "BinaryExpression") {
      // Add left and right operands
      if (node.left) {
        const leftLabel = document.createElement("div");
        leftLabel.className = "ast-node-child-label";
        leftLabel.textContent = "left:";
        childrenContainer.appendChild(leftLabel);

        const leftElement = createAstNodeElement(node.left);
        childrenContainer.appendChild(leftElement);
      }

      if (node.right) {
        const rightLabel = document.createElement("div");
        rightLabel.className = "ast-node-child-label";
        rightLabel.textContent = "right:";
        childrenContainer.appendChild(rightLabel);

        const rightElement = createAstNodeElement(node.right);
        childrenContainer.appendChild(rightElement);
      }
    } else if (node.type === "ConditionalExpression") {
      // Add test, consequent, and alternate
      if (node.test) {
        const testLabel = document.createElement("div");
        testLabel.className = "ast-node-child-label";
        testLabel.textContent = "condition:";
        childrenContainer.appendChild(testLabel);

        const testElement = createAstNodeElement(node.test);
        childrenContainer.appendChild(testElement);
      }

      if (node.consequent) {
        const consLabel = document.createElement("div");
        consLabel.className = "ast-node-child-label";
        consLabel.textContent = "if true:";
        childrenContainer.appendChild(consLabel);

        const consElement = createAstNodeElement(node.consequent);
        childrenContainer.appendChild(consElement);
      }

      if (node.alternate) {
        const altLabel = document.createElement("div");
        altLabel.className = "ast-node-child-label";
        altLabel.textContent = "if false:";
        childrenContainer.appendChild(altLabel);

        const altElement = createAstNodeElement(node.alternate);
        childrenContainer.appendChild(altElement);
      }
    } else if (node.type === "ArrowFunctionExpression") {
      // Add parameters
      if (node.params && node.params.length > 0) {
        const paramsLabel = document.createElement("div");
        paramsLabel.className = "ast-node-child-label";
        paramsLabel.textContent = "parameters:";
        childrenContainer.appendChild(paramsLabel);

        node.params.forEach(param => {
          const paramElement = createAstNodeElement(param);
          childrenContainer.appendChild(paramElement);
        });
      }

      // Add function body
      if (node.body) {
        const bodyLabel = document.createElement("div");
        bodyLabel.className = "ast-node-child-label";
        bodyLabel.textContent = "body:";
        childrenContainer.appendChild(bodyLabel);

        const bodyElement = createAstNodeElement(node.body);
        childrenContainer.appendChild(bodyElement);
      }
    } else if (node.type === "BlockStatement") {
      // Add block statements
      if (node.body && node.body.length > 0) {
        node.body.forEach(statement => {
          const statementElement = createAstNodeElement(statement);
          childrenContainer.appendChild(statementElement);
        });
      }
    } else if (node.type === "CallExpression") {
      // Add callee
      if (node.callee) {
        const calleeLabel = document.createElement("div");
        calleeLabel.className = "ast-node-child-label";
        calleeLabel.textContent = "callee:";
        childrenContainer.appendChild(calleeLabel);

        const calleeElement = createAstNodeElement(node.callee);
        childrenContainer.appendChild(calleeElement);
      }

      // Add arguments
      if (node.arguments && node.arguments.length > 0) {
        const argsLabel = document.createElement("div");
        argsLabel.className = "ast-node-child-label";
        argsLabel.textContent = "arguments:";
        childrenContainer.appendChild(argsLabel);

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
