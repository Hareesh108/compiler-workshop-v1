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

      // Get the declaration from the current scope or parent scopes
      const declaration = window.CompilerModule.getDeclarationFromScope(this.currentScope, name);

      // Track which scope the variable was found in, if any
      let foundInScope = null;
      if (declaration) {
        // Find which scope contains this declaration
        let scope = this.currentScope;
        while (scope) {
          if (scope.declarations && scope.declarations[name]) {
            foundInScope = scope;
            break;
          }
          scope = scope.parent;
        }
      }

      // Emit lookup event with more detailed information
      nameResolutionData.events.push({
        type: 'VariableLookup',
        scopeId: this.currentScope.id,
        name,
        node,
        resolvedInScopeId: foundInScope ? foundInScope.id : null,
        declaration,
        resolved: !!declaration
      });

      // Also emit the standard resolve reference event for backward compatibility
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
                  // Emit specific event for function parameter declaration
                  nameResolutionData.events.push({
                    type: 'FunctionParameter',
                    scopeId: state.currentScope.id,
                    name: param.value,
                    node: param
                  });

                  state.declareVariable(param.value, param);
                }
              });
            } else if (node.params.value) {
              // Single parameter
              // Emit specific event for function parameter declaration
              nameResolutionData.events.push({
                type: 'FunctionParameter',
                scopeId: state.currentScope.id,
                name: node.params.value,
                node: node.params
              });

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
 * Initialize the compiler visualization
 */
function initializeVisualizer() {
  // Initialize UI references
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

  // Load the first example by default
  state.sourceCode = state.examples.example1;

  // Set event listeners
  state.ui.exampleSelect.addEventListener("change", () => {
    const selectedExample = state.ui.exampleSelect.value;

    if (selectedExample === "custom") {
      // Show custom input container
      state.ui.customInputContainer.classList.remove("hidden");
    } else {
      // Use predefined example
      state.ui.customInputContainer.classList.add("hidden");
      loadExample(state, selectedExample);
    }
  });

  // Set up custom code run button
  state.ui.runCustomButton.addEventListener("click", () => {
    const customCode = state.ui.customInput.value.trim();
    if (!customCode) {
      showToast("Please enter some code to tokenize");
      return;
    }

    state.sourceCode = customCode;
    compileAndVisualize(state);
  });

  // Set up scrubber
  state.ui.scrubber.addEventListener("input", () => {
    updateVisualization(state);
  });

  // Load initial example
  loadExample(state, "example1");
}

/**
 * Compile source code and update visualization
 */
function compileAndVisualize(state) {
  if (!state) {
    console.error("No state object provided to compileAndVisualize");
    return;
  }

  // Clear previous results
  state.ui.tokensList.innerHTML = "";
  state.ui.astTree.innerHTML = "";
  state.ui.nameResolution.innerHTML = "";

  try {
    // Get the current source code
    const sourceCode = state.sourceCode;

    // Reset scrubber
    const scrubber = state.ui.scrubber;
    scrubber.value = 0;

    // Step 1: Tokenize - with explicit error handling
    let tokenizationData;
    try {
      tokenizationData = buildTokenizationData(sourceCode);
      // Make sure it's valid before assigning
      if (!tokenizationData || !tokenizationData.events || !tokenizationData.tokens) {
        throw new Error("Invalid tokenization data structure");
      }
      state.tokenizationData = tokenizationData;
    } catch (tokenizeError) {
      console.error("Tokenization error:", tokenizeError);
      throw new Error(`Tokenization failed: ${tokenizeError.message}`);
    }

    // Now that we have tokenization data, initialize source code display
    initializeSourceCodeDisplay(state);

    // Step 2: Parse - with explicit error handling
    let astData;
    try {
      astData = buildAstData(sourceCode, tokenizationData.tokens);
      // Make sure it's valid before assigning
      if (!astData || !astData.events || !astData.rootNode) {
        throw new Error("Invalid AST data structure");
      }
      state.astData = astData;
    } catch (parseError) {
      console.error("Parsing error:", parseError);
      throw new Error(`Parsing failed: ${parseError.message}`);
    }

    // Step 3: Name resolution - with explicit error handling
    let nameResolutionData;
    try {
      nameResolutionData = buildNameResolutionData(sourceCode, astData.rootNode);
      // Make sure it's valid before assigning
      if (!nameResolutionData || !nameResolutionData.events) {
        throw new Error("Invalid name resolution data structure");
      }
      state.nameResolutionData = nameResolutionData;
    } catch (analysisError) {
      console.error("Name resolution error:", analysisError);
      throw new Error(`Name resolution failed: ${analysisError.message}`);
    }

    // Calculate total events
    const totalTokenEvents = tokenizationData.events.length;
    const totalAstEvents = astData.events.length;
    const totalNameResolutionEvents = nameResolutionData.events.length;

    // Set the max value for the scrubber based on total events
    scrubber.max = totalTokenEvents + totalAstEvents + totalNameResolutionEvents;

    // Update the visualization at step 0
    updateVisualization(state);
  } catch (error) {
    console.error("Compilation error:", error);

    // Show error message in the UI
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = `Compilation error: ${error.message}`;
    state.ui.tokensList.appendChild(errorDiv);

    // Create empty data structures if necessary
    if (!state.tokenizationData) {
      state.tokenizationData = { events: [], tokens: [], sourceToToken: {}, tokenToSource: {} };
    }
    if (!state.astData) {
      state.astData = { events: [], rootNode: null };
    }
    if (!state.nameResolutionData) {
      state.nameResolutionData = { events: [], scopes: [] };
    }

    // Initialize source code display even in error case
    initializeSourceCodeDisplay(state);
  }
}

/**
 * Main update function to update the visualization based on the scrubber position
 *
 * @param {Object} state - Global state object
 */
function updateVisualization(state) {
  // Check if we have state data
  if (!state) {
    console.error("No state object provided to updateVisualization");
    return;
  }

  // Get scrubber position
  const scrubber = state.ui.scrubber;
  const scrubberValue = parseInt(scrubber.value || 0);

  // Ensure we have data structures (even if empty)
  if (!state.tokenizationData) {
    console.error("No tokenization data available");
    state.tokenizationData = { events: [], tokens: [] };
  }

  if (!state.astData) {
    console.error("No AST data available");
    state.astData = { events: [], rootNode: null };
  }

  if (!state.nameResolutionData) {
    console.error("No name resolution data available");
    state.nameResolutionData = { events: [], scopes: [] };
  }

  // Calculate which phase we're in and which step within that phase
  const tokenEvents = state.tokenizationData.events.length || 0;
  const astEvents = state.astData.events.length || 0;
  const nameResolutionEvents = state.nameResolutionData.events.length || 0;

  let tokenizationStep = 0;
  let astStep = 0;
  let nameResolutionStep = 0;

  if (scrubberValue < tokenEvents) {
    // In tokenization phase
    tokenizationStep = scrubberValue;
  } else if (scrubberValue < tokenEvents + astEvents) {
    // In AST phase - all tokens complete
    tokenizationStep = tokenEvents;
    astStep = scrubberValue - tokenEvents;
  } else {
    // In name resolution phase - all tokens and AST complete
    tokenizationStep = tokenEvents;
    astStep = astEvents;
    nameResolutionStep = scrubberValue - tokenEvents - astEvents;
  }

  // Update all visualizations to the current step
  updateTokensDisplay(state, tokenizationStep);
  updateAstDisplay(state, astStep);
  updateNameResolutionDisplay(state, nameResolutionStep);
}

/**
 * Update the tokens display based on current step
 *
 * @param {Object} state - Visualization state
 * @param {number} tokenizationStep - Current tokenization step
 */
function updateTokensDisplay(state, tokenizationStep) {
  // Clear tokens list
  state.ui.tokensList.innerHTML = "";

  if (tokenizationStep === 0) {
    return;
  }

  // Determine which tokens to show
  let tokens = [];
  let currentTokenIndex = -1;

  // In tokenization mode, show tokens up to current step
  const step = state.tokenizationData.events[tokenizationStep];
  tokens = step.currentTokens || [];
  currentTokenIndex = tokens.length - 1;

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

    if (index === currentTokenIndex) {
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
 * @param {number} tokenizationStep - Current tokenization step
 */
function updateSourceCodeHighlighting(state, tokenizationStep) {
  if (tokenizationStep === 0) {
    // Reset all source code highlighting
    const allChars = state.ui.sourceCode.querySelectorAll('.source-char');
    allChars.forEach(char => {
      char.classList.remove('text-consumed', 'text-current');
    });
    return;
  }

  const currentStep = state.tokenizationData.events[tokenizationStep];
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

  if (astStepIndex === 0) {
    return;
  }

  if (!state.astData || !state.astData.events) {
    console.error("AST data not available for display");
    return;
  }

  // Get the AST event
  const event = state.astData.events[astStepIndex - 1];
  if (!event) {
    console.error("No AST event at step", astStepIndex);
    return;
  }

  // Create the tree
  const tree = document.createElement("ul");
  tree.className = "ast-tree";

  // Add the root node
  const rootNodeElement = createAstNodeElement(state.astData.rootNode);
  tree.appendChild(rootNodeElement);

  // Expand all nodes
  expandAstNode(rootNodeElement);

  // Highlight the current node
  const currentNodeElement = tree.querySelector(`[data-node-id="${event.node.id}"]`);
  if (currentNodeElement) {
    currentNodeElement.classList.add("ast-node-current");
    currentNodeElement.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Add the tree to the AST container
  state.ui.astTree.appendChild(tree);
}

/**
 * Update the name resolution display based on the current step
 *
 * @param {Object} state - Visualization state
 * @param {number} nameResolutionStepIndex - Index into the name resolution steps array
 */
function updateNameResolutionDisplay(state, nameResolutionStepIndex) {
  // Clear name resolution container
  state.ui.nameResolution.innerHTML = "";

  if (nameResolutionStepIndex === 0) {
    return;
  }

  if (!state.nameResolutionData || !state.nameResolutionData.events) {
    console.error("Name resolution data not available for display");
    return;
  }

  // Create variables container
  const variablesContainer = document.createElement("div");
  variablesContainer.className = "variables-container";

  // Create scopes container
  const scopesContainer = document.createElement("div");
  scopesContainer.className = "scopes-container";

  // Create events container
  const eventsContainer = document.createElement("div");
  eventsContainer.className = "events-container";

  // Track active scopes - map scopeId to scope element and declarations
  const activeScopes = {};

  // Process name resolution events up to current step
  for (let i = 0; i < nameResolutionStepIndex; i++) {
    const event = state.nameResolutionData.events[i];
    const isCurrentStep = (i === nameResolutionStepIndex - 1);

    // Create an event element
    const eventElement = document.createElement("div");
    eventElement.className = `event ${isCurrentStep ? "current-step" : ""}`;

    // Handle different event types
    switch (event.type) {
      case "EnterScope":
        // Create a new scope element
        const scopeElement = document.createElement("div");
        scopeElement.className = `scope ${isCurrentStep ? "current-scope" : ""}`;

        // Add scope info
        const scopeHeader = document.createElement("div");
        scopeHeader.className = "scope-header";
        scopeHeader.textContent = `Scope ${event.scopeId}`;

        if (event.parentScopeId !== null) {
          scopeHeader.textContent += ` (parent: ${event.parentScopeId})`;
        }

        scopeElement.appendChild(scopeHeader);

        // Add declarations container
        const declarationsContainer = document.createElement("div");
        declarationsContainer.className = "declarations";
        scopeElement.appendChild(declarationsContainer);

        // Add the scope to active scopes
        activeScopes[event.scopeId] = {
          element: scopeElement,
          declarations: {},
          parent: event.parentScopeId
        };

        // Add the scope to the container
        scopesContainer.appendChild(scopeElement);

        // Add event info
        eventElement.textContent = `Enter scope ${event.scopeId}`;
        break;

      case "ExitScope":
        // Mark scope as exited
        if (activeScopes[event.scopeId]) {
          activeScopes[event.scopeId].element.classList.add("exited");
        }

        // Add event info
        eventElement.textContent = `Exit scope ${event.scopeId}`;
        break;

      case "DeclareVariable":
        // Add variable declaration to scope
        if (activeScopes[event.scopeId]) {
          activeScopes[event.scopeId].declarations[event.name] = event.node;

          // Add to scope element
          const declarationsContainer = activeScopes[event.scopeId].element.querySelector(".declarations");

          const declarationElement = document.createElement("div");
          declarationElement.className = `declaration ${isCurrentStep ? "current-declaration" : ""}`;
          declarationElement.textContent = `Declare: ${event.name}`;
          declarationsContainer.appendChild(declarationElement);
        }

        // Add event info
        eventElement.textContent = `Declare variable "${event.name}" in scope ${event.scopeId}`;
        break;

      case "ResolveReference":
        // Add event info
        eventElement.textContent = `${event.resolved ? "Resolved" : "Failed to resolve"} variable "${event.name}" in scope ${event.scopeId}`;
        break;

      case "Error":
        // Add error styling
        eventElement.classList.add("error");

        // Add event info
        eventElement.textContent = `Error: ${event.message}`;
        break;

      case "FunctionParameter":
        // Add parameter declaration to scope
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
          declarationElement.className = `declaration parameter ${isCurrentStep ? "current-declaration" : ""}`;
          declarationElement.textContent = `Parameter: ${event.name}`;
          declarationsContainer.appendChild(declarationElement);
        }

        // Add event info
        eventElement.textContent = `Declare function parameter "${event.name}" in scope ${event.scopeId}`;
        break;

      case "VariableLookup":
        // Add lookup info
        const lookupElement = document.createElement("div");
        lookupElement.className = `lookup ${isCurrentStep ? "current-lookup" : ""} ${event.resolved ? "resolved" : "unresolved"}`;
        lookupElement.textContent = `Lookup: ${event.name} ${event.resolved ? `(resolved in scope ${event.resolvedInScopeId})` : "(unresolved)"}`;

        // Add to variables container
        variablesContainer.appendChild(lookupElement);

        // Add event info
        eventElement.textContent = `${event.resolved ? "Resolved" : "Failed to resolve"} variable "${event.name}" in scope ${event.scopeId}`;
        break;
    }

    // Add the event element to the name resolution container
    eventsContainer.appendChild(eventElement);
  }

  // Add the containers to the name resolution container
  state.ui.nameResolution.appendChild(scopesContainer);
  state.ui.nameResolution.appendChild(variablesContainer);
  state.ui.nameResolution.appendChild(eventsContainer);
}

/**
 * Create AST node element
 *
 * @param {Object} node - AST node
 * @returns {HTMLElement} - AST node element
 */
function createAstNodeElement(node) {
  if (!node) return null;

  // Create node element
  const nodeElement = document.createElement("li");
  nodeElement.className = "ast-node";
  nodeElement.dataset.nodeId = node.id;

  // Create node header
  const nodeHeader = document.createElement("div");
  nodeHeader.className = "ast-node-header";

  // Add expand/collapse button
  const expandButton = document.createElement("span");
  expandButton.className = "ast-node-expand";
  expandButton.textContent = "►";
  expandButton.addEventListener("click", function() {
    toggleAstNode(nodeElement);
  });

  // Add node type
  const nodeType = document.createElement("span");
  nodeType.className = "ast-node-type";
  nodeType.textContent = node.type;

  // Add node value if available
  if (node.value !== undefined) {
    const nodeValue = document.createElement("span");
    nodeValue.className = "ast-node-value";
    nodeValue.textContent = `: ${formatValue(node.value)}`;
    nodeHeader.appendChild(nodeValue);
  }

  // Add node children container
  const nodeChildren = document.createElement("ul");
  nodeChildren.className = "ast-node-children";

  // Add children if any
  if (node.children && node.children.length > 0) {
    // Add children to container
    node.children.forEach(child => {
      const childElement = createAstNodeElement(child);
      if (childElement) {
        nodeChildren.appendChild(childElement);
      }
    });
  }

  // Assemble node element
  nodeHeader.appendChild(expandButton);
  nodeHeader.appendChild(nodeType);
  nodeElement.appendChild(nodeHeader);
  nodeElement.appendChild(nodeChildren);

  return nodeElement;
}

/**
 * Toggle AST node expansion
 *
 * @param {HTMLElement} nodeElement - AST node element
 */
function toggleAstNode(nodeElement) {
  const childrenContainer = nodeElement.querySelector(".ast-node-children");
  const expandButton = nodeElement.querySelector(".ast-node-expand");

  if (childrenContainer.style.display === "none") {
    // Expand
    childrenContainer.style.display = "block";
    expandButton.textContent = "▼";
  } else {
    // Collapse
    childrenContainer.style.display = "none";
    expandButton.textContent = "►";
  }
}

/**
 * Expand AST node
 *
 * @param {HTMLElement} nodeElement - AST node element
 */
function expandAstNode(nodeElement) {
  const childrenContainer = nodeElement.querySelector(".ast-node-children");
  const expandButton = nodeElement.querySelector(".ast-node-expand");

  if (childrenContainer) {
    childrenContainer.style.display = "block";
  }

  if (expandButton) {
    expandButton.textContent = "▼";
  }

  // Expand all children
  const childNodes = nodeElement.querySelectorAll(":scope > .ast-node-children > .ast-node");
  childNodes.forEach(child => {
    expandAstNode(child);
  });
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
  compileAndVisualize(state);
}

// Initialize the visualizer when the page loads
document.addEventListener("DOMContentLoaded", () => {
  // Global state object
  window.state = {
    sourceCode: "",
    tokenizationData: { events: [], tokens: [] },
    astData: { events: [], rootNode: null },
    nameResolutionData: { events: [], scopes: [] },
    currentTokenizationStep: 0,
    currentAstStep: 0,
    currentNameResolutionStep: 0,
    highlightedTokenIndex: null,
    highlightedAstNode: null,
    highlightedNameResolutionElement: null,
    // Add predefined code examples
    examples: {
      example1: `// Function expression with a parameter
const greet = (name) => {
  return "Hello, " + name;
};`,
      example2: `// Simple constant declaration
const message = "Hello, world!";`,
      example3: `// Multiple declarations and function calls
const x = 10;
const y = 20;
const sum = (a, b) => a + b;
const result = sum(x, y);`
    },
    // UI references will be added in initializeVisualizer
    ui: {}
  };

  initializeVisualizer();
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
