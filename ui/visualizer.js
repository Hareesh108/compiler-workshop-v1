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
 * Build a name resolution data structure that records scope events for visualization
 *
 * @param {string} sourceCode - Source code to analyze
 * @param {Object} ast - AST from parsing phase
 * @returns {Object} - Contains name resolution data and events
 */
function buildNameResolutionData(sourceCode, ast) {
  // Initialize data structure
  const nameResolutionData = {
    sourceCode,
    ast,
    scopes: [],
    events: [],
    errors: [],
    scopeMap: {}
  };

  // Scope ID counter to assign unique IDs
  let scopeIdCounter = 0;
  
  // Reference the original createScope function
  const origCreateScope = window.CompilerModule.createScope;
  
  // Create custom state for our name resolution traversal
  const state = {
    ast,
    errors: [],
    currentScope: null,
    previousScope: null,
    currentNode: null,
    
    // Custom enter scope handler that emits events
    enterScope: function() {
      // Get the parent scope
      const parentScope = this.currentScope;
      
      // Create a new scope with the current one as parent
      const newScope = origCreateScope(parentScope);
      const scopeId = scopeIdCounter++;
      
      // Add scope ID for tracking
      newScope.id = scopeId;
      newScope.parentId = parentScope ? parentScope.id : null;
      
      // Save previous scope and set new current scope
      this.previousScope = parentScope;
      this.currentScope = newScope;
      
      // Add to our scopes list
      nameResolutionData.scopes.push(newScope);
      
      // Emit enter scope event
      nameResolutionData.events.push({
        type: 'EnterScope',
        scopeId,
        node: this.currentNode,
        parentScopeId: newScope.parentId
      });
    },
    
    // Custom exit scope handler that emits events
    exitScope: function() {
      // Emit exit scope event
      nameResolutionData.events.push({
        type: 'ExitScope',
        scopeId: this.currentScope.id
      });
      
      // Restore previous scope
      this.currentScope = this.previousScope;
    },
    
    // Declare a variable in the current scope and emit event
    declareVariable: function(name, node) {
      if (!this.currentScope) return false;
      
      const success = window.CompilerModule.declareInScope(this.currentScope, name, node);
      
      // Emit declare event
      nameResolutionData.events.push({
        type: 'DeclareVariable',
        scopeId: this.currentScope.id,
        name,
        node
      });
      
      return success;
    },
    
    // Resolve a variable reference and emit event
    resolveReference: function(name, node) {
      if (!this.currentScope) return null;
      
      const declaration = window.CompilerModule.getDeclarationFromScope(this.currentScope, name);
      
      // Emit resolve event
      nameResolutionData.events.push({
        type: 'ResolveReference',
        scopeId: this.currentScope.id,
        name,
        node,
        declaration,
        resolved: !!declaration
      });
      
      return declaration;
    },
    
    // Report an error and emit error event
    reportError: function(message, node) {
      const error = { message, node };
      nameResolutionData.errors.push(error);
      
      // Emit error event
      nameResolutionData.events.push({
        type: 'Error',
        message,
        node,
        error
      });
      
      this.errors.push(error);
    }
  };

  try {
    // Process the AST to perform name resolution with our custom state object
    const visitNode = function(node) {
      if (!node) return;
      
      // Set current node on state
      state.currentNode = node;
      
      // Handle different node types
      switch (node.type) {
        case 'Program':
          // Create the global scope
          state.enterScope();
          
          // Visit all statements
          if (node.body && Array.isArray(node.body)) {
            node.body.forEach(stmt => visitNode(stmt));
          }
          
          // Exit global scope
          state.exitScope();
          break;
          
        case 'ConstDeclaration':
          // Declare the variable in current scope
          if (node.id && node.id.value) {
            state.declareVariable(node.id.value, node);
          }
          
          // Visit the initializer
          if (node.init) {
            visitNode(node.init);
          }
          break;
          
        case 'ArrowFunctionExpression':
          // Create a new scope for the function
          state.enterScope();
          
          // Add parameters to the function scope
          if (node.params) {
            if (Array.isArray(node.params)) {
              // Multiple parameters
              node.params.forEach(param => {
                if (param && param.value) {
                  state.declareVariable(param.value, param);
                }
              });
            } else if (node.params.value) {
              // Single parameter
              state.declareVariable(node.params.value, node.params);
            }
          }
          
          // Visit the function body
          if (node.body) {
            visitNode(node.body);
          }
          
          // Exit function scope
          state.exitScope();
          break;
          
        case 'CallExpression':
          // Visit the callee
          if (node.callee) {
            visitNode(node.callee);
          }
          
          // Visit all arguments
          if (node.arguments && Array.isArray(node.arguments)) {
            node.arguments.forEach(arg => visitNode(arg));
          }
          break;
          
        case 'Identifier':
          // Resolve the variable reference
          if (node.value) {
            state.resolveReference(node.value, node);
          }
          break;
          
        case 'BinaryExpression':
          // Visit left and right sides
          if (node.left) visitNode(node.left);
          if (node.right) visitNode(node.right);
          break;
          
        case 'ConditionalExpression':
          // Visit test, consequent, and alternate
          if (node.test) visitNode(node.test);
          if (node.consequent) visitNode(node.consequent);
          if (node.alternate) visitNode(node.alternate);
          break;
          
        case 'ReturnStatement':
          // Visit the argument if any
          if (node.argument) {
            visitNode(node.argument);
          }
          break;
          
        // Handle other node types as needed
        default:
          // Generic handling for unknown nodes - visit children
          Object.keys(node).forEach(key => {
            const child = node[key];
            if (child && typeof child === 'object') {
              if (Array.isArray(child)) {
                child.forEach(item => {
                  if (item && typeof item === 'object' && item.type) {
                    visitNode(item);
                  }
                });
              } else if (child.type) {
                visitNode(child);
              }
            }
          });
      }
    };
    
    // Start visiting from the root AST node
    visitNode(ast);
  } catch (e) {
    console.error("Error during name resolution:", e);
    nameResolutionData.events.push({
      type: 'Error',
      message: `Analysis error: ${e.message}`,
      node: null,
      error: e
    });
  }

  return nameResolutionData;
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
  // Initial state for the visualization
  const state = {
    sourceCode: "",
    tokenizationData: null,
    astData: null,
    nameResolutionData: null,
    currentTokenizationStep: 0,
    currentAstStep: 0,
    currentNameResolutionStep: 0,
    highlightedTokenIndex: null,
    highlightedAstNode: null,
    highlightedNameResolutionElement: null,
    // Add predefined code examples
    examples: {
      example1: `// Simple constant declaration
const message = "Hello, world!";`,
      example2: `// Function expression with a parameter
const greet = (name) => {
  return "Hello, " + name;
};`,
      example3: `// Multiple declarations and function calls
const x = 10;
const y = 20;
const sum = (a, b) => a + b;
const result = sum(x, y);`
    }
  };

  // Initialize UI references in state
  state.ui = {
    scrubber: document.getElementById("scrubber"),
    exampleSelect: document.getElementById("example-select"),
    customInput: document.getElementById("custom-input"),
    customInputContainer: document.getElementById("custom-input-container"),
    runCustomButton: document.getElementById("run-custom"),
    sourceCode: document.getElementById("source-code"),
    tokensList: document.getElementById("tokens-list"),
    astTree: document.getElementById("ast-tree"),
    nameResolution: document.getElementById("name-resolution")
  };

  // Load the default example
  loadExample(state, "example1");

  // Set up event handlers
  setupEventHandlers(state);

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
    // Get the current source code
    const sourceCode = state.sourceCode;

    // Clear previous results
    state.ui.tokensList.innerHTML = "";
    state.ui.astTree.innerHTML = "";
    state.ui.nameResolution.innerHTML = "";

    // Reset scrubber
    const scrubber = state.ui.scrubber;
    scrubber.value = 0;

    // Step 1: Tokenize
    const tokenizationData = buildTokenizationData(sourceCode);
    state.tokenizationData = tokenizationData;

    // Step 2: Parse
    const astData = buildAstData(sourceCode, tokenizationData.tokens);
    state.astData = astData;

    // Step 3: Name resolution
    const nameResolutionData = buildNameResolutionData(sourceCode, astData.rootNode);
    state.nameResolutionData = nameResolutionData;

    // Calculate total events
    const totalTokenEvents = tokenizationData.events.length;
    const totalAstEvents = astData.events.length;
    const totalNameResolutionEvents = nameResolutionData.events.length;
    const totalEvents = totalTokenEvents + totalAstEvents + totalNameResolutionEvents;

    // Update scrubber max value to total events - 1
    scrubber.max = totalEvents > 0 ? totalEvents - 1 : 0;

    // Initialize displays
    initializeSourceCodeDisplay(state);

    // Update initial visualization step
    updateVisualization(state);

    // Show a success message
    showToast(`Compilation successful. ${totalTokenEvents} tokenization events, ${totalAstEvents} AST events, ${totalNameResolutionEvents} name resolution events.`);
  } catch (error) {
    console.error("Compilation error:", error);
    showToast(`Error: ${error.message}`);
  }
}

/**
 * Update the visualization based on current scrubber position
 *
 * @param {Object} state - Visualization state
 */
function updateVisualization(state) {
  // Get the current position from the scrubber
  const scrubber = state.ui.scrubber;
  const currentPosition = parseInt(scrubber.value);

  // Calculate which phase (tokenization, AST, or name resolution) we're in
  const totalTokenizationEvents = state.tokenizationData?.events.length || 0;
  const totalAstEvents = state.astData?.events.length || 0;
  
  // In tokenization phase
  if (currentPosition < totalTokenizationEvents) {
    state.currentTokenizationStep = currentPosition;
    state.currentAstStep = 0;
    state.currentNameResolutionStep = 0;
    
    updateTokensDisplay(state);
    updateSourceCodeHighlighting(state);
    
    // Clear AST and name resolution displays if we're back in tokenization
    if (currentPosition === 0) {
      state.ui.astTree.innerHTML = "";
      state.ui.nameResolution.innerHTML = "";
    }
  }
  // In AST phase
  else if (currentPosition < totalTokenizationEvents + totalAstEvents) {
    state.currentTokenizationStep = totalTokenizationEvents - 1;
    state.currentAstStep = currentPosition - totalTokenizationEvents;
    state.currentNameResolutionStep = 0;
    
    // Show all tokens
    updateTokensDisplay(state, true);
    
    // Update the AST display
    updateAstDisplay(state, state.currentAstStep);
    
    // Clear name resolution display if we're back in AST phase
    if (state.currentAstStep === 0) {
      state.ui.nameResolution.innerHTML = "";
    }
  }
  // In name resolution phase
  else {
    state.currentTokenizationStep = totalTokenizationEvents - 1;
    state.currentAstStep = totalAstEvents - 1;
    state.currentNameResolutionStep = currentPosition - totalTokenizationEvents - totalAstEvents;
    
    // Show all tokens and full AST
    updateTokensDisplay(state, true);
    updateAstDisplay(state, state.currentAstStep);
    
    // Update name resolution display
    updateNameResolutionDisplay(state, state.currentNameResolutionStep);
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
  state.ui.tokensList.innerHTML = "";

  if (state.currentTokenizationStep === 0 && !showAll) {
    return;
  }

  // Determine which tokens to show
  let tokens = [];
  let currentTokenIndex = -1;

  if (showAll) {
    // Show all tokens
    tokens = state.tokenizationData.tokens;
  } else {
  // In tokenization mode, show tokens up to current step
    const step = state.tokenizationData.events[state.currentTokenizationStep];
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

    state.ui.tokensList.appendChild(tokenElement);
  });

  // Scroll the current token into view if it's not already visible
  setTimeout(() => {
    if (currentTokenElement) {
      scrollIntoViewIfNeeded(currentTokenElement, state.ui.tokensList);
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
  if (state.currentTokenizationStep === 0 && !showAll) {
    // Reset all source code highlighting
    const allChars = state.ui.sourceCode.querySelectorAll('.source-char');
    allChars.forEach(char => {
      char.classList.remove('text-consumed', 'text-current');
    });
    return;
  }

  // If showing all, mark everything as consumed
  if (showAll) {
    const allChars = state.ui.sourceCode.querySelectorAll('.source-char');
    allChars.forEach(char => {
      char.classList.remove('text-current', 'text-whitespace', 'text-clicked');
      char.classList.add('text-consumed');
    });
    return;
  }

  const currentStep = state.tokenizationData.events[state.currentTokenizationStep];
  const currentPosition = currentStep.position;
  const currentLength = currentStep.length || 0;

  // Find the end position of the current token
  const currentEndPosition = currentPosition + currentLength;

  // Determine highlight class based on the step type (always "token" now)
  const highlightClass = "text-current";

  // Clear previous highlighting
  const allChars = state.ui.sourceCode.querySelectorAll('.source-char');
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
  const firstHighlightedChar = state.ui.sourceCode.querySelector(`.${highlightClass}`);
  if (firstHighlightedChar) {
    setTimeout(() => {
      scrollIntoViewIfNeeded(firstHighlightedChar, state.ui.sourceCode);
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
  const allTokens = state.ui.tokensList.querySelectorAll('.token');
  allTokens.forEach(el => {
    el.classList.remove('token-clicked');
  });

  // Find and highlight the specified token
  const tokenElement = state.ui.tokensList.querySelector(`[data-token-index="${tokenIndex}"]`);
  if (tokenElement) {
    tokenElement.classList.add('token-clicked');
    scrollIntoViewIfNeeded(tokenElement, state.ui.tokensList);
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
  const currentStep = state.tokenizationData.events[state.currentTokenizationStep - 1] || { position: 0, length: 0 };
  const currentTokenEndPos = currentStep.position + currentStep.length;

  // Clear highlighting for clicked state
  const allChars = state.ui.sourceCode.querySelectorAll('.source-char');
  allChars.forEach(char => {
    char.classList.remove('text-clicked');

    // Ensure consumed text is still marked as consumed
    const charPos = parseInt(char.dataset.pos, 10);

    // We want to preserve the consumed/current highlighting from the scrubber
    if (state.currentTokenizationStep > 0) {
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
    const charSpan = state.ui.sourceCode.querySelector(`[data-pos="${i}"]`);
    if (charSpan) {
      charSpan.classList.add('text-clicked');
    }
  }

  // Scroll to the highlighted source if not in view
  const firstHighlightedChar = state.ui.sourceCode.querySelector('.text-clicked');
  if (firstHighlightedChar) {
    setTimeout(() => {
      scrollIntoViewIfNeeded(firstHighlightedChar, state.ui.sourceCode);
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
  state.ui.astTree.innerHTML = "";

  if (astStepIndex < 0 || astStepIndex >= state.astData.events.length) {
    return;
  }

  // Get the current step
  const currentStep = state.astData.events[astStepIndex];
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
  state.ui.astTree.appendChild(currentStepInfo);

  // SIMPLER APPROACH: Create a map of nodes by their location in the source code
  // for const declarations, we'll use variable name as the key
  const nodesByIdentifier = new Map();

  // A map to track all nodes by their ID
  const nodesById = new Map();

  // Track the current node for highlighting
  let currentNodeId = currentStep.id;

  // First pass: Process all steps up to the current one
  for (let i = 0; i <= astStepIndex; i++) {
    const step = state.astData.events[i];
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
    state.ui.astTree.appendChild(nodeElement);
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
      // FIXED RENDERING: Always show the const declaration clearly
      console.log("Rendering ConstDeclaration:", node);

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
 * Update the name resolution display based on the current step
 *
 * @param {Object} state - Visualization state
 * @param {number} nameResolutionStepIndex - Index into the name resolution steps array
 */
function updateNameResolutionDisplay(state, nameResolutionStepIndex) {
  // Get the name resolution container
  const nameResolutionContainer = state.ui.nameResolution;
  
  // If no name resolution data, return
  if (!state.nameResolutionData || !state.nameResolutionData.events) {
    nameResolutionContainer.innerHTML = "<div class='no-data'>No name resolution data available</div>";
    return;
  }

  // Get all events up to the current step
  const currentEvents = state.nameResolutionData.events.slice(0, nameResolutionStepIndex + 1);
  
  // Clear the previous display
  nameResolutionContainer.innerHTML = "";
  
  // Track active scopes
  const activeScopes = {};
  
  // Create a scope hierarchy display
  const scopeHierarchy = document.createElement("div");
  scopeHierarchy.className = "scope-hierarchy";
  nameResolutionContainer.appendChild(scopeHierarchy);
  
  // Create container for variable declarations and references
  const variablesContainer = document.createElement("div");
  variablesContainer.className = "variables-container";
  nameResolutionContainer.appendChild(variablesContainer);
  
  // Process each event
  for (let i = 0; i < currentEvents.length; i++) {
    const event = currentEvents[i];
    const isCurrentStep = i === nameResolutionStepIndex;
    
    // Create an event element
    const eventElement = document.createElement("div");
    eventElement.className = `name-resolution-event ${isCurrentStep ? "current-step" : ""}`;
    
    // Handle different event types
    switch (event.type) {
      case "EnterScope":
        // Add scope to active scopes
        activeScopes[event.scopeId] = {
          id: event.scopeId,
          parentId: event.parentScopeId,
          declarations: {},
          element: document.createElement("div")
        };
        
        // Create scope element
        const scopeElement = activeScopes[event.scopeId].element;
        scopeElement.className = `scope ${isCurrentStep ? "current-scope" : ""}`;
        scopeElement.innerHTML = `<div class="scope-header">Scope ${event.scopeId} ${event.parentScopeId !== null ? `(parent: ${event.parentScopeId})` : "(global)"}</div>`;
        
        // Place scope in hierarchy
        if (event.parentScopeId !== null && activeScopes[event.parentScopeId]) {
          const parentElement = activeScopes[event.parentScopeId].element;
          const childrenContainer = parentElement.querySelector(".scope-children") || 
                                   (() => { 
                                     const container = document.createElement("div");
                                     container.className = "scope-children";
                                     parentElement.appendChild(container);
                                     return container;
                                   })();
          childrenContainer.appendChild(scopeElement);
        } else {
          scopeHierarchy.appendChild(scopeElement);
        }
        
        // Add event info
        eventElement.textContent = `Enter scope ${event.scopeId}`;
        break;
        
      case "ExitScope":
        // Add event info
        eventElement.textContent = `Exit scope ${event.scopeId}`;
        
        // Mark scope as inactive
        if (activeScopes[event.scopeId]) {
          activeScopes[event.scopeId].element.classList.add("exited-scope");
        }
        break;
        
      case "DeclareVariable":
        // Add declaration to scope
        if (activeScopes[event.scopeId]) {
          activeScopes[event.scopeId].declarations[event.name] = event.node;
          
          // Add to scope element
          const declarationsContainer = activeScopes[event.scopeId].element.querySelector(".declarations") || 
                                      (() => { 
                                        const container = document.createElement("div");
                                        container.className = "declarations";
                                        activeScopes[event.scopeId].element.appendChild(container);
                                        return container;
                                      })();
          
          const declarationElement = document.createElement("div");
          declarationElement.className = `declaration ${isCurrentStep ? "current-declaration" : ""}`;
          declarationElement.textContent = `Declare: ${event.name}`;
          declarationsContainer.appendChild(declarationElement);
        }
        
        // Add event info
        eventElement.textContent = `Declare variable "${event.name}" in scope ${event.scopeId}`;
        break;
        
      case "ResolveReference":
        // Add resolution info
        const resolutionElement = document.createElement("div");
        resolutionElement.className = `resolution ${isCurrentStep ? "current-resolution" : ""} ${event.resolved ? "resolved" : "unresolved"}`;
        resolutionElement.textContent = `Reference: ${event.name} ${event.resolved ? `(declared in scope ${event.declaration ? event.declaration.scope : "unknown"})` : "(unresolved)"}`;
        
        // Add to variables container
        variablesContainer.appendChild(resolutionElement);
        
        // Add event info
        eventElement.textContent = `${event.resolved ? "Resolved" : "Failed to resolve"} variable "${event.name}" in scope ${event.scopeId}`;
        break;
        
      case "Error":
        // Create error element
        const errorElement = document.createElement("div");
        errorElement.className = `error ${isCurrentStep ? "current-error" : ""}`;
        errorElement.textContent = event.message;
        nameResolutionContainer.appendChild(errorElement);
        
        // Add event info
        eventElement.textContent = `Error: ${event.message}`;
        break;
    }
    
    // Add the event element to the name resolution container
    if (isCurrentStep) {
      // Add current event indicator
      const currentEventElement = document.createElement("div");
      currentEventElement.className = "current-event-indicator";
      currentEventElement.textContent = "Current step:";
      nameResolutionContainer.appendChild(currentEventElement);
      nameResolutionContainer.appendChild(eventElement);
    }
  }
  
  // If no events, show message
  if (currentEvents.length === 0) {
    nameResolutionContainer.innerHTML = "<div class='no-events'>No name resolution events yet</div>";
  }
  
  // Update source highlighting if needed
  const currentEvent = currentEvents[nameResolutionStepIndex];
  if (currentEvent && currentEvent.node && currentEvent.node.position !== undefined) {
    // Highlight the relevant source code
    const position = currentEvent.node.position;
    const length = currentEvent.node.value ? currentEvent.node.value.length : 1;
    highlightSourceRange(state, null, position, length);
  }
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
  state.ui.sourceCode.innerHTML = '';

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
  state.ui.sourceCode.appendChild(fragment);

  // Add click handler to the source code container
  state.ui.sourceCode.addEventListener('click', (event) => {
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
