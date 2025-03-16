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
    // Clear previous displays
    state.ui.tokensListElement.innerHTML = "";

    // Build tokenization data using events
    const tokenizationData = buildTokenizationData(state.sourceCode);

    // Store tokens and data
    state.tokens = tokenizationData.tokens;
    state.tokenizationData = tokenizationData;

    // Initialize the source code display with character spans
    initializeSourceCodeDisplay(state);

    // Filter the events to only include token events (skip whitespace and comments)
    // This ensures each scrubber step corresponds to a new token
    const tokenEvents = tokenizationData.events.filter(event =>
      event.type !== "WHITESPACE" && event.type !== "COMMENT"
    );

    // Convert filtered events to visualization steps for the scrubber
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

    // Calculate total steps (tokenization only)
    state.totalSteps = state.visualizationSteps.length;

    // Reset UI
    state.currentStepIndex = 0;
    // Set max to the number of tokenization steps
    state.ui.scrubber.max = Math.max(0, state.totalSteps - 1);
    state.ui.scrubber.value = 0;

    // Reset scroll positions
    state.ui.tokensListElement.scrollTop = 0;
    state.ui.sourceCodeElement.scrollTop = 0;

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
  const totalSteps = state.totalSteps;

  // Skip the initial step to avoid requiring two drags to see anything
  let progress = Math.min(scrubberValue, totalSteps - 1);

  // We're only in the tokenization phase now
  state.currentStepIndex = progress + 1; // Add 1 to skip the initial step

  // Update tokens list
  updateTokensDisplay(state);

  // Update source code highlighting
  updateSourceCodeHighlighting(state);
}

/**
 * Update the tokens display based on current step
 *
 * @param {Object} state - Visualization state
 */
function updateTokensDisplay(state) {
  // Clear tokens list
  state.ui.tokensListElement.innerHTML = "";

  if (state.currentStepIndex === 0) {
    return;
  }

  // In tokenization mode, show tokens up to current step
  const step = state.visualizationSteps[state.currentStepIndex - 1];
  const tokens = step.currentTokens || [];
  const currentTokenIndex = tokens.length - 1;

  // Variable to keep track of the current token element
  let currentTokenElement = null;

  // Add tokens to display
  tokens.forEach((token, index) => {
    // Add index to token for easy retrieval
    token.tokenIndex = index;

    const tokenElement = document.createElement("div");
    tokenElement.className = "token";
    tokenElement.textContent = `${token.type}: "${token.value || ""}" (pos: ${token.position})`;
    tokenElement.dataset.position = token.position;
    tokenElement.dataset.tokenIndex = token.tokenIndex;

    // Add click handler directly to the token element
    tokenElement.addEventListener("click", () => {
      // When a token is clicked, highlight both the token and its source code
      highlightToken(state, token.tokenIndex);
      highlightSourceRange(state, token.tokenIndex);
    });

    if (index === currentTokenIndex && step.type === "token") {
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
 */
function updateSourceCodeHighlighting(state) {
  if (state.currentStepIndex === 0) {
    // Reset all source code highlighting
    const allChars = state.ui.sourceCodeElement.querySelectorAll('.source-char');
    allChars.forEach(char => {
      char.classList.remove('text-consumed', 'text-current');
    });
    return;
  }

  const currentStep = state.visualizationSteps[state.currentStepIndex - 1];
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
 * Update the AST tree display based on current parsing step
 *
 * @param {Object} state - Visualization state
 * @param {number} astStepIndex - Index of the current AST step
 */
function updateAstDisplay(state, astStepIndex) {
  // Clear the AST tree
  state.ui.astTreeElement.innerHTML = "";

  if (astStepIndex < 0 || astStepIndex >= state.astSteps.length) {
    return;
  }

  // Get the current step
  const step = state.astSteps[astStepIndex];

  // Instead of a program node, we'll just have a collection of top-level nodes
  const topLevelNodes = [];

  // Completed nodes by ID to avoid duplication
  const completedNodesMap = new Map();

  let currentNode = null; // Tracks the node that's currently being built

  // First pass: find all completed nodes
  // This helps us determine which in-progress nodes to exclude
  for (let i = 0; i <= astStepIndex; i++) {
    const currentStep = state.astSteps[i];

    // Skip steps without nodes
    if (!currentStep.node) continue;

    const isCurrentStep = i === astStepIndex;

    // Only process complete steps in this pass
    if (currentStep.isComplete || currentStep.type.endsWith("Complete")) {
      const completedNode = {
        ...currentStep.node,
        _isCurrentStep: isCurrentStep,
        _tokensUsed: currentStep.tokensUsed || [],
        _stepIndex: i, // Track which step created this node
        _isComplete: true, // Explicitly mark as completed
      };

      // Add top-level nodes to the map
      if (
        completedNode.type === "ConstDeclaration" ||
        completedNode.type === "ReturnStatement"
      ) {
        // Create a unique ID for this node to avoid duplication
        const nodeId = `${completedNode.type}-${completedNode.id?.name || "anonymous"}-${i}`;
        completedNodesMap.set(nodeId, completedNode);
      }
    }
  }

  // Process all steps up to the current one again
  // Now we can properly filter out in-progress nodes that end up completed
  currentNode = null;
  for (let i = 0; i <= astStepIndex; i++) {
    const currentStep = state.astSteps[i];

    // Skip steps without nodes
    if (!currentStep.node) continue;

    const isCurrentStep = i === astStepIndex;
    const isCompleteStep =
      currentStep.isComplete || currentStep.type.endsWith("Complete");

    // Handle the node based on step type
    if (isCompleteStep) {
      // We already added these in the first pass
      // Reset current node since we've completed it
      currentNode = null;
    } else if (
      currentStep.type.includes("Start") ||
      currentStep.type === "exprStart" ||
      currentStep.type.includes("Peek")
    ) {
      // This is a node that's currently being built
      currentNode = {
        ...currentStep.node,
        _isCurrentStep: isCurrentStep,
        _tokensUsed: currentStep.tokensUsed || [],
        _inProgress: true,
        _stepIndex: i,
      };

      // Only add in-progress nodes if there's no completed version of them
      if (
        currentNode.type === "ConstDeclaration" ||
        currentNode.type === "ReturnStatement" ||
        currentNode.type === "Expression"
      ) {
        // More thorough check for completed nodes
        const nodeAlreadyCompleted = Array.from(
          completedNodesMap.values(),
        ).some((node) => {
          // For const declarations, match by type and identifier name
          if (
            node.type === currentNode.type &&
            currentNode.type === "ConstDeclaration"
          ) {
            return node.id?.name === currentNode.id?.name;
          }
          // For return statements, match by type and if they both have arguments or both don't
          else if (
            node.type === currentNode.type &&
            currentNode.type === "ReturnStatement"
          ) {
            return !!node.argument === !!currentNode.argument;
          }
          // For expressions, match by type and value if available
          else if (
            node.type === currentNode.type &&
            (node.type === "NumericLiteral" ||
              node.type === "StringLiteral" ||
              node.type === "BooleanLiteral")
          ) {
            return node.value === currentNode.value;
          }
          // For identifiers, match by name
          else if (
            node.type === currentNode.type &&
            node.type === "Identifier"
          ) {
            return node.name === currentNode.name;
          }
          return false;
        });

        // Only add in-progress nodes if they're not already completed
        if (!nodeAlreadyCompleted) {
          // Create a unique ID for this in-progress node
          const nodeId = `in-progress-${currentNode.type}-${currentNode.id?.name || "anonymous"}-${i}`;
          // Only add if we don't already have this exact node
          if (!Array.from(completedNodesMap.keys()).includes(nodeId)) {
            completedNodesMap.set(nodeId, currentNode);
          }
        }
      }
    } else {
      // Other intermediate steps - update current node if it exists
      if (currentNode) {
        // Extend the current node with any new properties
        currentNode = {
          ...currentNode,
          ...currentStep.node,
          _isCurrentStep: isCurrentStep,
          _tokensUsed: currentStep.tokensUsed || [],
          _inProgress: true,
        };
      }
    }
  }

  // Handle the final step differently - only show fully completed nodes
  let nodesToRender;

  // If we're at the very last step, only show explicitly completed nodes
  // This is a very aggressive approach to ensure no in-progress nodes appear
  if (astStepIndex === state.astSteps.length - 1) {
    // Filter map to only contain explicitly completed top-level nodes
    const cleanMap = new Map();

    // First pass: only add completed nodes
    Array.from(completedNodesMap.entries()).forEach(([key, node]) => {
      if (node._isComplete === true && node._inProgress !== true) {
        // Add only fully completed nodes
        const completedNode = { ...node, _purged: true };
        cleanMap.set(key, completedNode);

        // Special handling for nested expressions in const declarations
        if (node.type === "ConstDeclaration" && node.init) {
          // Define deep completion marking helper
          const deepMarkComplete = (obj) => {
            if (!obj || typeof obj !== "object") return;

            // Mark this node as complete
            obj._isComplete = true;
            obj._inProgress = false;

            // For ternary operations, recursively mark all parts
            if (obj.type === "ConditionalExpression") {
              if (obj.test) deepMarkComplete(obj.test);
              if (obj.consequent) deepMarkComplete(obj.consequent);
              if (obj.alternate) deepMarkComplete(obj.alternate);
            }

            // For binary operations, recursively mark both sides
            if (obj.type === "BinaryExpression") {
              if (obj.left) deepMarkComplete(obj.left);
              if (obj.right) deepMarkComplete(obj.right);
            }
          };

          // Apply deep completion marking to init node
          deepMarkComplete(completedNode.init);
        }
      }
    });

    // Empty out our map and replace with clean one
    completedNodesMap.clear();
    Array.from(cleanMap.entries()).forEach(([key, node]) => {
      completedNodesMap.set(key, node);
    });

    // Final filter for nodes to render - strict filtering
    nodesToRender = Array.from(completedNodesMap.values()).filter(
      (node) => node._isComplete === true && node._inProgress !== true,
    );
  } else {
    // For intermediate steps, show both completed and in-progress nodes
    // But filter out in-progress nodes that already have completed versions
    nodesToRender = Array.from(completedNodesMap.values()).filter((node) => {
      // If this is an incomplete node
      if (node._inProgress) {
        // Check if there's any completed node that matches this one
        return !Array.from(completedNodesMap.values()).some((completedNode) => {
          if (!completedNode._inProgress) {
            // Check for different types of nodes
            if (node.type === completedNode.type) {
              // For const declarations
              if (node.type === "ConstDeclaration") {
                return node.id?.name === completedNode.id?.name;
              }
              // For return statements
              else if (node.type === "ReturnStatement") {
                return !!node.argument === !!completedNode.argument;
              }
              // For literals
              else if (
                ["NumericLiteral", "StringLiteral", "BooleanLiteral"].includes(
                  node.type,
                )
              ) {
                return node.value === completedNode.value;
              }
              // For identifiers
              else if (node.type === "Identifier") {
                return node.name === completedNode.name;
              }
            }
          }
          return false;
        });
      }

      // Include all completed nodes
      return !node._inProgress;
    });
  }

  // Sort by type to have const declarations first, then returns, then others
  nodesToRender.sort((a, b) => {
    // Put ConstDeclarations first
    if (a.type === "ConstDeclaration" && b.type !== "ConstDeclaration")
      return -1;
    if (b.type === "ConstDeclaration" && a.type !== "ConstDeclaration")
      return 1;

    // Then ReturnStatements
    if (a.type === "ReturnStatement" && b.type !== "ReturnStatement") return -1;
    if (b.type === "ReturnStatement" && a.type !== "ReturnStatement") return 1;

    // If both same type, sort by step index
    return (a._stepIndex || 0) - (b._stepIndex || 0);
  });

  // Render all top-level nodes directly (no program wrapper)
  nodesToRender.forEach((node) => {
    const nodeElement = createAstNodeElement(node, false);
    state.ui.astTreeElement.appendChild(nodeElement);
  });

  // Add the sticky status message at the bottom
  const descriptionElement = document.createElement("div");
  descriptionElement.className = "ast-step-description";
  descriptionElement.textContent = step.description || "Parsing...";
  state.ui.astTreeElement.appendChild(descriptionElement);

  // Find and scroll to the current AST node
  setTimeout(() => {
    const currentNode =
      state.ui.astTreeElement.querySelector(".ast-node-current");
    if (currentNode) {
      scrollIntoViewIfNeeded(currentNode, state.ui.astTreeElement);
    }
  }, 0);
}

/**
 * Create an AST node element for visualization
 *
 * @param {Object} node - AST node
 * @param {boolean} forceHighlight - Whether to force highlighting this node
 * @returns {HTMLElement} - DOM element representing the node
 */
function createAstNodeElement(node, forceHighlight = false) {
  const nodeElement = document.createElement("div");
  nodeElement.className = "ast-node";

  // Check if this is the current node being processed
  if (node._isCurrentStep) {
    nodeElement.classList.add("ast-node-current");
  } else if (node._inProgress && !node._isComplete) {
    nodeElement.classList.add("ast-node-partial");
  } else {
    nodeElement.classList.add("ast-node-highlighted");
  }

  // Skip internal properties that start with '_'
  const filteredNode = Object.fromEntries(
    Object.entries(node).filter(([key]) => !key.startsWith("_")),
  );

  // Add the node type
  const typeElement = document.createElement("span");
  typeElement.className = "ast-node-type";
  typeElement.textContent = filteredNode.type;
  nodeElement.appendChild(typeElement);

  // Add node details based on type
  const detailsElement = document.createElement("div");
  detailsElement.className = "ast-node-details";

  // DEBUG: Add a data attribute showing the node's type and structure
  nodeElement.setAttribute("data-node-type", filteredNode.type);
  if (filteredNode.type === "ConstDeclaration" && filteredNode.init) {
    nodeElement.setAttribute(
      "data-init-type",
      filteredNode.init.type || "none",
    );
  }

  // We no longer have a Program root node to skip
  switch (filteredNode.type) {
    case "ConstDeclaration":
      if (filteredNode.id) {
        detailsElement.textContent = `${filteredNode.id.name}`;
        if (filteredNode.typeAnnotation) {
          detailsElement.textContent += `: ${filteredNode.typeAnnotation.valueType}`;
        }
      } else if (node.partial) {
        detailsElement.textContent = "(incomplete)";
      }

      // SPECIAL HANDLING FOR TERNARY EXPRESSIONS IN CONST DECLARATIONS
      if (
        filteredNode.init &&
        filteredNode.init.type === "ConditionalExpression"
      ) {
        // Mark the init as already rendered to avoid duplicate rendering
        filteredNode.init._isAlreadyRendered = true;

        // Create child container for the ternary expression
        const ternaryContainer = document.createElement("div");
        ternaryContainer.className = "ast-node-children";
        const ternaryLabel = document.createElement("div");
        ternaryLabel.className = "ast-node-child-label";
        ternaryLabel.textContent = "initialized to:";
        ternaryContainer.appendChild(ternaryLabel);

        // Create the ternary expression node
        const ternaryNode = document.createElement("div");
        ternaryNode.className = "ast-node ast-node-highlighted";

        // Add the node type
        const ternaryTypeElement = document.createElement("span");
        ternaryTypeElement.className = "ast-node-type";
        ternaryTypeElement.textContent = "ConditionalExpression";
        ternaryNode.appendChild(ternaryTypeElement);

        // Add details
        const ternaryDetails = document.createElement("div");
        ternaryDetails.className = "ast-node-details";
        ternaryDetails.textContent = "condition ? then : else";
        ternaryNode.appendChild(ternaryDetails);

        // Mark all child nodes as complete too
        if (filteredNode.init.test) filteredNode.init.test._isComplete = true;
        if (filteredNode.init.consequent)
          filteredNode.init.consequent._isComplete = true;
        if (filteredNode.init.alternate)
          filteredNode.init.alternate._isComplete = true;

        // Add the condition
        if (filteredNode.init.test) {
          const condContainer = document.createElement("div");
          condContainer.className = "ast-node-children";
          const condLabel = document.createElement("div");
          condLabel.className = "ast-node-child-label";
          condLabel.textContent = "condition:";
          condContainer.appendChild(condLabel);

          // Pass a clone to avoid modifying the original
          const condElement = createAstNodeElement(
            {
              ...filteredNode.init.test,
              _isComplete: true,
              _inProgress: false,
            },
            false,
          );

          condContainer.appendChild(condElement);
          ternaryNode.appendChild(condContainer);
        }

        // Add the 'then' part
        if (filteredNode.init.consequent) {
          const thenContainer = document.createElement("div");
          thenContainer.className = "ast-node-children";
          const thenLabel = document.createElement("div");
          thenLabel.className = "ast-node-child-label";
          thenLabel.textContent = "then:";
          thenContainer.appendChild(thenLabel);

          // Pass a clone to avoid modifying the original
          const thenElement = createAstNodeElement(
            {
              ...filteredNode.init.consequent,
              _isComplete: true,
              _inProgress: false,
            },
            false,
          );

          thenContainer.appendChild(thenElement);
          ternaryNode.appendChild(thenContainer);
        }

        // Add the 'else' part
        if (filteredNode.init.alternate) {
          const elseContainer = document.createElement("div");
          elseContainer.className = "ast-node-children";
          const elseLabel = document.createElement("div");
          elseLabel.className = "ast-node-child-label";
          elseLabel.textContent = "else:";
          elseContainer.appendChild(elseLabel);

          // Pass a clone to avoid modifying the original
          const elseElement = createAstNodeElement(
            {
              ...filteredNode.init.alternate,
              _isComplete: true,
              _inProgress: false,
            },
            false,
          );

          elseContainer.appendChild(elseElement);
          ternaryNode.appendChild(elseContainer);
        }

        // Add the ternary node to the container
        ternaryContainer.appendChild(ternaryNode);

        // Add to main node
        nodeElement.appendChild(ternaryContainer);
      }
      break;

    case "ReturnStatement":
      detailsElement.textContent = filteredNode.argument
        ? "with value"
        : "empty return";
      break;

    case "ConditionalExpression":
      detailsElement.textContent = "condition ? then : else";
      break;

    case "BinaryExpression":
      detailsElement.textContent = `${filteredNode.operator || "+"} operation`;
      break;

    case "Identifier":
      detailsElement.textContent = filteredNode.name || "";
      break;

    case "NumericLiteral":
      detailsElement.textContent =
        filteredNode.value !== undefined ? filteredNode.value : "";
      break;

    case "StringLiteral":
      detailsElement.textContent = `"${filteredNode.value || ""}"`;
      break;

    case "BooleanLiteral":
      detailsElement.textContent =
        filteredNode.value !== undefined ? filteredNode.value : "";
      break;

    case "TypeAnnotation":
      detailsElement.textContent = filteredNode.valueType || "";
      break;

    case "Expression":
      if (filteredNode.tokenType) {
        detailsElement.textContent = `Processing ${filteredNode.tokenType}`;
      } else {
        detailsElement.textContent = "Processing expression";
      }
      break;

    default:
      // For any other node type, filter out internal properties and show relevant details
      const details = Object.entries(filteredNode)
        .filter(
          ([key]) =>
            key !== "type" &&
            key !== "body" &&
            key !== "children" &&
            key !== "partial",
        )
        .map(([key, value]) => {
          if (typeof value === "object" && value !== null) {
            return `${key}: ${value.type || JSON.stringify(value)}`;
          }
          return `${key}: ${value}`;
        })
        .join(", ");

      if (details) {
        detailsElement.textContent = details;
      }
  }

  if (detailsElement.textContent) {
    nodeElement.appendChild(detailsElement);
  }

  // We're removing the 'Uses X tokens' indicator as requested

  // We no longer need special handling for Program node body statements,
  // as we're directly rendering top-level nodes

  // Handle special cases for other child relationships - these should be nested
  // Only show init if we're not at the final step OR the node is complete
  // Skip for const declarations with ternary expressions (we've already handled them)
  if (
    filteredNode.init &&
    typeof filteredNode.init === "object" &&
    !(
      filteredNode.type === "ConstDeclaration" &&
      filteredNode.init.type === "ConditionalExpression"
    )
  ) {
    // Mark child nodes with the same completion status as parent
    if (node._isComplete) {
      // Deep completion marking - mark all nodes in this subtree as complete
      const deepMarkComplete = (obj) => {
        if (!obj || typeof obj !== "object") return;

        // Mark this node as complete
        obj._isComplete = true;

        // For ternary operations, mark all parts
        if (obj.type === "ConditionalExpression") {
          deepMarkComplete(obj.test);
          deepMarkComplete(obj.consequent);
          deepMarkComplete(obj.alternate);
        }

        // For binary operations, mark both sides
        if (obj.type === "BinaryExpression") {
          deepMarkComplete(obj.left);
          deepMarkComplete(obj.right);
        }

        // Mark any other nested expressions
        if (obj.init) deepMarkComplete(obj.init);
        if (obj.argument) deepMarkComplete(obj.argument);
      };

      // Apply deep completion marking to this init node
      deepMarkComplete(filteredNode.init);
    }

    const childrenElement = document.createElement("div");
    childrenElement.className = "ast-node-children";
    const label = document.createElement("div");
    label.className = "ast-node-child-label";
    label.textContent = "initialized to:";
    childrenElement.appendChild(label);

    const childElement = createAstNodeElement(filteredNode.init, false);
    childrenElement.appendChild(childElement);
    nodeElement.appendChild(childrenElement);
  }

  if (filteredNode.argument && typeof filteredNode.argument === "object") {
    // Mark child nodes with the same completion status as parent
    if (node._isComplete) {
      // Apply the same deep completion marking to the argument node
      const deepMarkComplete = (obj) => {
        if (!obj || typeof obj !== "object") return;

        // Mark this node as complete
        obj._isComplete = true;

        // For ternary operations, mark all parts
        if (obj.type === "ConditionalExpression") {
          deepMarkComplete(obj.test);
          deepMarkComplete(obj.consequent);
          deepMarkComplete(obj.alternate);
        }

        // For binary operations, mark both sides
        if (obj.type === "BinaryExpression") {
          deepMarkComplete(obj.left);
          deepMarkComplete(obj.right);
        }

        // Mark any other nested expressions
        if (obj.init) deepMarkComplete(obj.init);
        if (obj.argument) deepMarkComplete(obj.argument);
      };

      // Apply deep completion marking
      deepMarkComplete(filteredNode.argument);
    }

    const childrenElement = document.createElement("div");
    childrenElement.className = "ast-node-children";
    const label = document.createElement("div");
    label.className = "ast-node-child-label";
    label.textContent = "returns:";
    childrenElement.appendChild(label);

    const childElement = createAstNodeElement(filteredNode.argument, false);
    childrenElement.appendChild(childElement);
    nodeElement.appendChild(childrenElement);
  }

  if (
    filteredNode.id &&
    typeof filteredNode.id === "object" &&
    filteredNode.id.type === "Identifier" &&
    !filteredNode.id.position
  ) {
    // Mark child nodes with the same completion status as parent
    if (node._isComplete) {
      // Just mark the ID as complete - it doesn't have nested expressions
      filteredNode.id._isComplete = true;
    }

    // Add identifier as a child node for better tree visualization
    const childrenElement = document.createElement("div");
    childrenElement.className = "ast-node-children";
    const label = document.createElement("div");
    label.className = "ast-node-child-label";
    label.textContent = "name:";
    childrenElement.appendChild(label);

    const childElement = createAstNodeElement(filteredNode.id, false);
    childrenElement.appendChild(childElement);
    nodeElement.appendChild(childrenElement);
  }

  if (
    filteredNode.typeAnnotation &&
    typeof filteredNode.typeAnnotation === "object"
  ) {
    // Mark child nodes with the same completion status as parent
    if (node._isComplete) {
      // Just mark the type annotation as complete - it generally doesn't have nested expressions
      filteredNode.typeAnnotation._isComplete = true;
    }

    const childrenElement = document.createElement("div");
    childrenElement.className = "ast-node-children";
    const label = document.createElement("div");
    label.className = "ast-node-child-label";
    label.textContent = "type:";
    childrenElement.appendChild(label);

    const childElement = createAstNodeElement(
      filteredNode.typeAnnotation,
      false,
    );
    childrenElement.appendChild(childElement);
    nodeElement.appendChild(childrenElement);
  }

  // Handle standalone ConditionalExpression nodes (not inside const declarations)
  if (
    filteredNode.type === "ConditionalExpression" &&
    !filteredNode._isAlreadyRendered
  ) {
    // First, mark that we've rendered this ternary to avoid duplicates
    filteredNode._isAlreadyRendered = true;

    // Mark all parts as complete if parent is complete
    if (node._isComplete) {
      if (filteredNode.test) filteredNode.test._isComplete = true;
      if (filteredNode.consequent) filteredNode.consequent._isComplete = true;
      if (filteredNode.alternate) filteredNode.alternate._isComplete = true;
    }

    // Add condition part
    if (filteredNode.test && typeof filteredNode.test === "object") {
      const condContainer = document.createElement("div");
      condContainer.className = "ast-node-children";
      const condLabel = document.createElement("div");
      condLabel.className = "ast-node-child-label";
      condLabel.textContent = "condition:";
      condContainer.appendChild(condLabel);

      const condElement = createAstNodeElement(filteredNode.test, false);
      condContainer.appendChild(condElement);
      nodeElement.appendChild(condContainer);
    }

    // Add 'then' part
    if (
      filteredNode.consequent &&
      typeof filteredNode.consequent === "object"
    ) {
      const thenContainer = document.createElement("div");
      thenContainer.className = "ast-node-children";
      const thenLabel = document.createElement("div");
      thenLabel.className = "ast-node-child-label";
      thenLabel.textContent = "then:";
      thenContainer.appendChild(thenLabel);

      const thenElement = createAstNodeElement(filteredNode.consequent, false);
      thenContainer.appendChild(thenElement);
      nodeElement.appendChild(thenContainer);
    }

    // Add 'else' part
    if (filteredNode.alternate && typeof filteredNode.alternate === "object") {
      const elseContainer = document.createElement("div");
      elseContainer.className = "ast-node-children";
      const elseLabel = document.createElement("div");
      elseLabel.className = "ast-node-child-label";
      elseLabel.textContent = "else:";
      elseContainer.appendChild(elseLabel);

      const elseElement = createAstNodeElement(filteredNode.alternate, false);
      elseContainer.appendChild(elseElement);
      nodeElement.appendChild(elseContainer);
    }
  }

  return nodeElement;
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
