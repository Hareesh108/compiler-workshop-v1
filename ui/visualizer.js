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
}`
    }
  };
  
  // UI elements
  state.ui = {
    sourceCodeElement: document.getElementById("source-code"),
    tokensListElement: document.getElementById("tokens-list"),
    astTreeElement: document.getElementById("ast-tree"),
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
 * Run tokenization and parsing on the current source code
 * 
 * @param {Object} state - Visualization state
 */
function runTokenization(state) {
  try {
    // Clear previous displays
    state.ui.tokensListElement.innerHTML = '';
    state.ui.astTreeElement.innerHTML = '';
    
    // Run the tokenizer simulation
    const tokenResult = runTokenizerSimulation(state.sourceCode);
    
    // Get the actual tokens from the original tokenizer
    state.tokens = getTokens(state.sourceCode);
    
    // Run the parser simulation with these tokens
    const parseResult = runParseSimulation(state.tokens);
    
    // Store visualization steps
    state.visualizationSteps = tokenResult.steps;
    state.astSteps = parseResult.steps;
    state.ast = parseResult.ast;
    
    // Calculate total steps (tokenization + parsing)
    state.totalSteps = state.visualizationSteps.length + state.astSteps.length;
    
    // Reset UI
    state.currentStepIndex = 0;
    // Set max to include both tokenization and parsing steps
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
    alert(`Compilation error: ${error.message}`);
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
  
  // Calculate which phase we're in (tokenizing or parsing) and the appropriate step index
  const tokenStepsCount = state.visualizationSteps.length;
  const totalSteps = state.totalSteps;
  
  // Skip the initial step to avoid requiring two drags to see anything
  let progress = Math.min(scrubberValue, totalSteps - 1);
  
  // Update progress info as percentage of total steps
  const percentage = Math.round((progress / (totalSteps - 1)) * 100);
  state.ui.progressInfo.textContent = `${percentage}%`;
  
  if (progress < tokenStepsCount) {
    // We're in the tokenization phase
    state.currentStepIndex = progress + 1; // Add 1 to skip the initial step
    
    // Update tokens list
    updateTokensDisplay(state);
    
    // Update source code highlighting
    updateSourceCodeHighlighting(state);
    
    // No AST display yet
    state.ui.astTreeElement.innerHTML = '';
  } else {
    // We're in the parsing phase
    const astStepIndex = progress - tokenStepsCount;
    
    // For parsing steps, we've finished tokenization, so show all tokens
    state.currentStepIndex = tokenStepsCount; // Set to max tokens
    
    // Update tokens list with all tokens
    updateTokensDisplay(state, true);
    
    // Update AST tree based on current parsing step
    updateAstDisplay(state, astStepIndex);
    
    // Scroll to the AST container if this is the first parsing step
    if (astStepIndex === 0) {
      const scrollContainer = document.querySelector('.visualization-scroll-container');
      if (scrollContainer) {
        scrollContainer.scrollLeft = scrollContainer.scrollWidth;
      }
    }
  }
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
    
    // Find the highlighted element and scroll it into view if not already visible
    setTimeout(() => {
      const highlightedElement = state.ui.sourceCodeElement.querySelector(`.${highlightClass}`);
      if (highlightedElement) {
        scrollIntoViewIfNeeded(highlightedElement, state.ui.sourceCodeElement);
      }
    }, 0);
  }
}

/**
 * Update the tokens display based on current step
 * 
 * @param {Object} state - Visualization state
 * @param {boolean} astMode - Whether we're in AST visualization mode
 */
function updateTokensDisplay(state, astMode = false) {
  // Clear tokens list
  state.ui.tokensListElement.innerHTML = '';
  
  if (state.currentStepIndex === 0) {
    return;
  }
  
  // Get tokens up to current step
  let tokens = [];
  let currentTokenIndex = -1;
  
  if (astMode) {
    // In AST mode, show all tokens
    tokens = state.tokens;
    
    // Get the current AST step
    const astStepIndex = parseInt(state.ui.scrubber.value, 10) - state.visualizationSteps.length;
    if (astStepIndex >= 0 && astStepIndex < state.astSteps.length) {
      // Get the tokens referenced by current AST step
      const astStep = state.astSteps[astStepIndex];
      
      // Get the directly referenced tokens plus any peek tokens
      let referencedTokens = astStep.tokensUsed || [];
      
      // Handle special case for peeking
      const isPeekStep = astStep.type.includes('Peek') || astStep.type === 'exprStart';
      if (isPeekStep && astStep.node && astStep.node.nextToken) {
        // Add the peeked token to referenced tokens
        const nextTokenValue = astStep.node.nextToken;
        const nextTokenIndex = state.tokens.findIndex(t => 
          t.value === nextTokenValue && t.position >= astStep.tokenPosition
        );
        
        if (nextTokenIndex >= 0) {
          referencedTokens = [...referencedTokens, state.tokens[nextTokenIndex]];
        }
      }
      
      // Track the first referenced token element to scroll to
      let firstReferencedTokenElement = null;
      
      // Add tokens to display
      tokens.forEach((token, index) => {
        const tokenElement = createTokenDisplay(token);
        
        // Check if this token is referenced in the current AST step
        const isReferenced = referencedTokens.some(refToken => {
          if (!refToken) return false;
          // Match by position and type if available, otherwise try to match by value
          return (refToken.position === token.position && refToken.type === token.type) || 
                 (refToken.value === token.value && token.position >= astStep.tokenPosition);
        });
        
        if (isReferenced) {
          // Highlight tokens that are referenced in the current AST step
          tokenElement.classList.add('token-highlighted');
          tokenElement.classList.add('token-referenced');
          
          // Track the first referenced token
          if (!firstReferencedTokenElement) {
            firstReferencedTokenElement = tokenElement;
          }
        }
        
        state.ui.tokensListElement.appendChild(tokenElement);
      });
      
      // Scroll the first referenced token into view if it exists
      setTimeout(() => {
        if (firstReferencedTokenElement) {
          scrollIntoViewIfNeeded(firstReferencedTokenElement, state.ui.tokensListElement);
        }
      }, 0);
    } else {
      // Just show all tokens without highlighting
      tokens.forEach(token => {
        const tokenElement = createTokenDisplay(token);
        state.ui.tokensListElement.appendChild(tokenElement);
      });
    }
  } else {
    // In tokenization mode, show tokens up to current step
    const step = state.visualizationSteps[state.currentStepIndex - 1];
    tokens = step.currentTokens || [];
    currentTokenIndex = tokens.length - 1;
    
    // Variable to keep track of the current token element
    let currentTokenElement = null;
    
    // Add tokens to display
    tokens.forEach((token, index) => {
      const tokenElement = createTokenDisplay(token);
      
      if (index === currentTokenIndex && step.type === 'token') {
        // Highlight the most recently added token
        tokenElement.classList.add('token-current');
        currentTokenElement = tokenElement;
      } else {
        // Normal highlighting for previous tokens
        tokenElement.classList.add('token-highlighted');
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
}

/**
 * Parse AST simulation that records each step for visualization
 *
 * @param {Array} tokens - Tokens produced by the tokenizer
 * @returns {Object} - Contains AST and visualization steps
 */
function runParseSimulation(tokens) {
  // Initialize state for recording parse steps
  const state = {
    tokens: [...tokens], // Make a copy of tokens to avoid modifying the original
    current: 0, // Current position in the token array
    ast: null, // Will hold the final AST
    astSteps: [] // Will hold steps for visualization
  };

  // Helper function to record a step in the parsing process
  function recordStep(nodeType, node, description, tokensUsed = []) {
    // Skip "start" and general placeholder steps - we want to show concrete parsing actions
    if (nodeType === 'start' || 
        nodeType === 'statement' || 
        nodeType === 'expression' || 
        nodeType === 'primary') {
      return;
    }
    
    state.astSteps.push({
      type: nodeType,
      node: JSON.parse(JSON.stringify(node)), // Deep copy to avoid reference issues
      description,
      tokenPosition: state.current, // Current token position
      tokensUsed: [...tokensUsed], // Which tokens were used for this node
      tokens: state.tokens.slice(0, state.current) // Tokens consumed so far
    });
  }

  // Modified versions of the original parse.js helper functions that record steps
  function peek() {
    return state.tokens[state.current];
  }

  function next() {
    return state.tokens[state.current++];
  }

  function check(type) {
    return peek() && peek().type === type;
  }

  function expect(type, message) {
    if (check(type)) {
      return next();
    }
    // If we don't find what we expect, record an error step
    const errorMsg = message || `Expected ${type} but got ${peek() ? peek().type : 'EOF'} at position ${peek() ? peek().position : 'end'}`;
    recordStep('error', { error: errorMsg }, errorMsg);
    throw new Error(errorMsg);
  }

  // Simplified parse function implementations that record visualization steps
  
  // Main parse function - entry point
  function parseProgram() {
    const body = [];
    
    // Keep parsing statements until we reach the end of the file
    while (state.current < state.tokens.length && !check('EOF')) {
      try {
        const stmt = parseStatement();
        if (stmt) {
          body.push(stmt);
        }
      } catch (error) {
        console.error('Parse error:', error);
        break;
      }
    }
    
    const program = {
      type: 'Program',
      body
    };
    
    // Record the final program, but we won't show this in the visualization
    // since we've already been showing the individual nodes as they're parsed
    recordStep('complete', program, 'Completed parsing program', state.tokens.slice(0, state.current));
    
    return program;
  }
  
  // Parse statements (const declarations, return, expressions)
  function parseStatement() {
    recordStep('statement', { type: 'Statement' }, 'Parsing statement');
    
    if (check('CONST')) {
      return parseConstDeclaration();
    }
    
    if (check('RETURN')) {
      return parseReturnStatement();
    }
    
    // If not a specific statement type, parse as expression
    return parseExpression();
  }
  
  // Parse const declarations: const x = value
  function parseConstDeclaration() {
    const startPos = state.current;
    const constToken = next(); // consume 'const'
    
    // After consuming 'const', show this as parsing a const declaration
    // Using only the tokens consumed so far
    const tokensConsumedSoFar = state.tokens.slice(startPos, state.current);
    recordStep('constDeclStart', 
               { type: 'ConstDeclaration', partial: true }, 
               `Parsing const declaration`, 
               tokensConsumedSoFar);
    
    // Get the variable name
    const idToken = expect('IDENTIFIER', 'Expected identifier after const');
    
    // After consuming the identifier, update the visualization
    const tokensAfterIdent = state.tokens.slice(startPos, state.current);
    recordStep('constDeclId', 
               { type: 'ConstDeclaration', 
                 id: { type: 'Identifier', name: idToken.value }, 
                 partial: true }, 
               `Parsing const declaration for '${idToken.value}'`, 
               tokensAfterIdent);
    
    // Check for type annotation
    let typeAnnotation = null;
    if (check('COLON')) {
      typeAnnotation = parseTypeAnnotation();
      
      // After parsing type annotation, update the visualization
      const tokensAfterType = state.tokens.slice(startPos, state.current);
      recordStep('constDeclWithType', 
                 { type: 'ConstDeclaration', 
                   id: { type: 'Identifier', name: idToken.value },
                   typeAnnotation,
                   partial: true }, 
                 `Parsing const declaration with type annotation`, 
                 tokensAfterType);
    }
    
    // Expect equals sign
    const equalToken = expect('EQUAL', 'Expected = after identifier in const declaration');
    
    // After consuming equals sign, update the visualization
    const tokensAfterEqual = state.tokens.slice(startPos, state.current);
    recordStep('constDeclBeforeInit', 
               { type: 'ConstDeclaration', 
                 id: { type: 'Identifier', name: idToken.value },
                 typeAnnotation,
                 partial: true }, 
               `Parsing const declaration initializer`, 
               tokensAfterEqual);
    
    // Parse the initializer expression
    const init = parseExpression();
    
    // Optional semicolon
    let semicolonToken = null;
    if (check('SEMICOLON')) {
      semicolonToken = next();
    }
    
    // Get all tokens used for this declaration
    const tokensUsed = state.tokens.slice(startPos, state.current);
    
    const constDecl = {
      type: 'ConstDeclaration',
      id: {
        type: 'Identifier',
        name: idToken.value
      },
      typeAnnotation,
      init
    };
    
    recordStep('constDeclComplete', constDecl, `Completed const declaration for '${idToken.value}'`, tokensUsed);
    
    return constDecl;
  }
  
  // Parse return statements: return expr
  function parseReturnStatement() {
    const startPos = state.current;
    const returnToken = next(); // consume 'return'
    
    // After consuming 'return', show this as parsing a return statement
    const tokensConsumedSoFar = state.tokens.slice(startPos, state.current);
    recordStep('returnStmtStart', 
               { type: 'ReturnStatement', partial: true }, 
               'Parsing return statement', 
               tokensConsumedSoFar);
    
    // Check for empty return
    if (check('SEMICOLON') || check('RIGHT_CURLY')) {
      let semicolonToken = null;
      if (check('SEMICOLON')) {
        semicolonToken = next();
      }
      
      const tokensUsed = state.tokens.slice(startPos, state.current);
      
      const returnStmt = {
        type: 'ReturnStatement',
        argument: null
      };
      
      recordStep('returnStmtComplete', returnStmt, 'Completed empty return statement', tokensUsed);
      
      return returnStmt;
    }
    
    // Parse return expression
    const argument = parseExpression();
    
    // Optional semicolon
    let semicolonToken = null;
    if (check('SEMICOLON')) {
      semicolonToken = next();
    }
    
    const tokensUsed = state.tokens.slice(startPos, state.current);
    
    const returnStmt = {
      type: 'ReturnStatement',
      argument
    };
    
    recordStep('returnStmtComplete', returnStmt, 'Completed return statement', tokensUsed);
    
    return returnStmt;
  }
  
  // Parse expressions (anything that produces a value)
  function parseExpression() {
    // We're simplifying for this demo, so directly parse primary expressions
    return parsePrimary();
  }
  
  // Parse primary expressions (identifiers, literals, etc.)
  function parsePrimary() {
    const startPos = state.current;
    
    if (check('EOF')) {
      // We've reached the end
      return null;
    }
    
    // Peek at the next token before consuming it
    const nextToken = peek();
    
    // Prepare to mark this token as being processed
    const tokensBeingProcessed = [nextToken];
    recordStep('exprStart', 
              { type: 'Expression', partial: true, tokenType: nextToken.type }, 
              `Processing token: ${nextToken.type} "${nextToken.value}"`, 
              tokensBeingProcessed);
    
    // Now consume the token
    const token = next();
    
    let expr;
    
    switch (token.type) {
      case 'IDENTIFIER': {
        expr = {
          type: 'Identifier',
          name: token.value,
          position: token.position
        };
        
        const tokensUsed = state.tokens.slice(startPos, state.current);
        recordStep('identifier', expr, `Parsed identifier: ${token.value}`, tokensUsed);
        break;
      }
      
      case 'NUMBER': {
        expr = {
          type: 'NumericLiteral',
          value: parseFloat(token.value),
          position: token.position
        };
        
        const tokensUsed = state.tokens.slice(startPos, state.current);
        recordStep('numberLiteral', expr, `Parsed number: ${token.value}`, tokensUsed);
        break;
      }
      
      case 'STRING': {
        const value = token.value.slice(1, -1); // Remove quotes
        expr = {
          type: 'StringLiteral',
          value,
          position: token.position
        };
        
        const tokensUsed = state.tokens.slice(startPos, state.current);
        recordStep('stringLiteral', expr, `Parsed string: "${value}"`, tokensUsed);
        break;
      }
      
      case 'BOOLEAN': {
        expr = {
          type: 'BooleanLiteral',
          value: token.value === 'true',
          position: token.position
        };
        
        const tokensUsed = state.tokens.slice(startPos, state.current);
        recordStep('booleanLiteral', expr, `Parsed boolean: ${token.value}`, tokensUsed);
        break;
      }
      
      default: {
        // For simplicity, we'll just make a placeholder node for any other token
        expr = {
          type: 'Unknown',
          tokenType: token.type,
          value: token.value,
          position: token.position
        };
        
        const tokensUsed = state.tokens.slice(startPos, state.current);
        recordStep('unknown', expr, `Encountered token: ${token.type}`, tokensUsed);
      }
    }
    
    return expr;
  }
  
  // Simplified version of type annotation parsing
  function parseTypeAnnotation() {
    const startPos = state.current;
    const colonToken = next(); // consume colon
    
    // After consuming ':', show this as parsing a type annotation
    const tokensAfterColon = state.tokens.slice(startPos, state.current);
    recordStep('typeAnnotationStart', 
               { type: 'TypeAnnotation', partial: true }, 
               'Parsing type annotation', 
               tokensAfterColon);
    
    // Peek at the type token before consuming it
    const nextToken = peek();
    const peekTokens = state.tokens.slice(startPos, state.current).concat([nextToken]);
    recordStep('typeAnnotationPeek', 
               { type: 'TypeAnnotation', partial: true, nextToken: nextToken.value }, 
               `Type annotation will use token: ${nextToken.type} "${nextToken.value}"`, 
               peekTokens);
    
    // Now consume the type token
    const typeToken = next();
    
    const tokensUsed = state.tokens.slice(startPos, state.current);
    
    const typeAnnotation = {
      type: 'TypeAnnotation',
      valueType: typeToken.value
    };
    
    recordStep('typeAnnotationComplete', 
               typeAnnotation, 
               `Completed type annotation: ${typeToken.value}`, 
               tokensUsed);
    
    return typeAnnotation;
  }
  
  // Start parsing
  try {
    state.ast = parseProgram();
  } catch (error) {
    console.error('Parse simulation error:', error);
    // Add a final error step if we crashed
    if (state.astSteps.length === 0 || state.astSteps[state.astSteps.length - 1].type !== 'error') {
      recordStep('error', { error: error.message }, error.message);
    }
  }
  
  return {
    ast: state.ast,
    steps: state.astSteps
  };
}

/**
 * Update the AST tree display based on current parsing step
 * 
 * @param {Object} state - Visualization state
 * @param {number} astStepIndex - Index of the current AST step
 */
function updateAstDisplay(state, astStepIndex) {
  // Clear the AST tree
  state.ui.astTreeElement.innerHTML = '';
  
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
  
  // Process all steps up to the current one
  for (let i = 0; i <= astStepIndex; i++) {
    const currentStep = state.astSteps[i];
    
    // Skip steps without nodes
    if (!currentStep.node) continue;
    
    const isCurrentStep = i === astStepIndex;
    const isCompleteStep = currentStep.type.endsWith('Complete');
    
    // Handle the node based on step type
    if (isCompleteStep) {
      // This is a completed node, add it to the top level if appropriate
      const completedNode = { 
        ...currentStep.node, 
        _isCurrentStep: isCurrentStep,
        _tokensUsed: currentStep.tokensUsed || []
      };
      
      // If this is a top-level declaration (const/return), add it to our top-level nodes
      if (completedNode.type === 'ConstDeclaration' || 
          completedNode.type === 'ReturnStatement') {
        // Create a unique ID for this node to avoid duplication
        const nodeId = `${completedNode.type}-${completedNode.id?.name || 'anonymous'}-${i}`;
        completedNodesMap.set(nodeId, completedNode);
      }
      
      // Reset current node since we've completed it
      currentNode = null;
    } 
    else if (currentStep.type.includes('Start') || 
             currentStep.type === 'exprStart' || 
             currentStep.type.includes('Peek')) {
      // This is a node that's currently being built
      currentNode = { 
        ...currentStep.node, 
        _isCurrentStep: isCurrentStep,
        _tokensUsed: currentStep.tokensUsed || [],
        _inProgress: true
      };
      
      // Only add in-progress nodes if there's no completed version of them
      if ((currentNode.type === 'ConstDeclaration' || 
           currentNode.type === 'ReturnStatement' || 
           currentNode.type === 'Expression')) {
        
        // Check if this node is already completed
        const nodeAlreadyCompleted = Array.from(completedNodesMap.values()).some(node => 
          node.type === currentNode.type && 
          (node.id?.name === currentNode.id?.name)
        );
        
        // Only add in-progress nodes if they're not already completed
        if (!nodeAlreadyCompleted) {
          // Create a unique ID for this in-progress node
          const nodeId = `in-progress-${currentNode.type}-${currentNode.id?.name || 'anonymous'}-${i}`;
          // Only add if we don't already have this exact node
          if (!Array.from(completedNodesMap.keys()).includes(nodeId)) {
            completedNodesMap.set(nodeId, currentNode);
          }
        }
      }
    }
    else {
      // Other intermediate steps - update current node if it exists
      if (currentNode) {
        // Extend the current node with any new properties
        currentNode = { 
          ...currentNode, 
          ...currentStep.node, 
          _isCurrentStep: isCurrentStep,
          _tokensUsed: currentStep.tokensUsed || [],
          _inProgress: true 
        };
      }
    }
  }
  
  // Convert the map to an array for rendering
  const nodesToRender = Array.from(completedNodesMap.values());
  
  // Render all top-level nodes directly (no program wrapper)
  nodesToRender.forEach(node => {
    const nodeElement = createAstNodeElement(node, false);
    state.ui.astTreeElement.appendChild(nodeElement);
  });
  
  // Add the sticky status message at the bottom
  const descriptionElement = document.createElement('div');
  descriptionElement.className = 'ast-step-description';
  descriptionElement.textContent = step.description || 'Parsing...';
  state.ui.astTreeElement.appendChild(descriptionElement);
  
  // Find and scroll to the current AST node
  setTimeout(() => {
    const currentNode = state.ui.astTreeElement.querySelector('.ast-node-current');
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
  const nodeElement = document.createElement('div');
  nodeElement.className = 'ast-node';
  
  // Check if this is the current node being processed
  if (node._isCurrentStep) {
    nodeElement.classList.add('ast-node-current');
  } else if (node._inProgress) {
    nodeElement.classList.add('ast-node-partial');
  } else {
    nodeElement.classList.add('ast-node-highlighted');
  }
  
  // Skip internal properties that start with '_'
  const filteredNode = Object.fromEntries(
    Object.entries(node).filter(([key]) => !key.startsWith('_'))
  );
  
  // Add the node type
  const typeElement = document.createElement('span');
  typeElement.className = 'ast-node-type';
  typeElement.textContent = filteredNode.type;
  nodeElement.appendChild(typeElement);
  
  // Add node details based on type
  const detailsElement = document.createElement('div');
  detailsElement.className = 'ast-node-details';
  
  // We no longer have a Program root node to skip
  switch (filteredNode.type) {
    case 'ConstDeclaration':
      if (filteredNode.id) {
        detailsElement.textContent = `${filteredNode.id.name}`;
        if (filteredNode.typeAnnotation) {
          detailsElement.textContent += `: ${filteredNode.typeAnnotation.valueType}`;
        }
      } else if (node.partial) {
        detailsElement.textContent = '(incomplete)';
      }
      break;
      
    case 'ReturnStatement':
      detailsElement.textContent = filteredNode.argument ? 'with value' : 'empty return';
      break;
      
    case 'Identifier':
      detailsElement.textContent = filteredNode.name || '';
      break;
      
    case 'NumericLiteral':
      detailsElement.textContent = filteredNode.value !== undefined ? filteredNode.value : '';
      break;
      
    case 'StringLiteral':
      detailsElement.textContent = `"${filteredNode.value || ''}"`;
      break;
      
    case 'BooleanLiteral':
      detailsElement.textContent = filteredNode.value !== undefined ? filteredNode.value : '';
      break;
      
    case 'TypeAnnotation':
      detailsElement.textContent = filteredNode.valueType || '';
      break;
      
    case 'Expression':
      if (filteredNode.tokenType) {
        detailsElement.textContent = `Processing ${filteredNode.tokenType}`;
      } else {
        detailsElement.textContent = 'Processing expression';
      }
      break;
      
    default:
      // For any other node type, filter out internal properties and show relevant details
      const details = Object.entries(filteredNode)
        .filter(([key]) => 
          key !== 'type' && 
          key !== 'body' && 
          key !== 'children' &&
          key !== 'partial'
        )
        .map(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            return `${key}: ${value.type || JSON.stringify(value)}`;
          }
          return `${key}: ${value}`;
        })
        .join(', ');
      
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
  if (filteredNode.init && typeof filteredNode.init === 'object') {
    const childrenElement = document.createElement('div');
    childrenElement.className = 'ast-node-children';
    const label = document.createElement('div');
    label.className = 'ast-node-child-label';
    label.textContent = 'initialized to:';
    childrenElement.appendChild(label);
    
    const childElement = createAstNodeElement(filteredNode.init, false);
    childrenElement.appendChild(childElement);
    nodeElement.appendChild(childrenElement);
  }
  
  if (filteredNode.argument && typeof filteredNode.argument === 'object') {
    const childrenElement = document.createElement('div');
    childrenElement.className = 'ast-node-children';
    const label = document.createElement('div');
    label.className = 'ast-node-child-label';
    label.textContent = 'returns:';
    childrenElement.appendChild(label);
    
    const childElement = createAstNodeElement(filteredNode.argument, false);
    childrenElement.appendChild(childElement);
    nodeElement.appendChild(childrenElement);
  }
  
  if (filteredNode.id && typeof filteredNode.id === 'object' && 
      filteredNode.id.type === 'Identifier' && !filteredNode.id.position) {
    // Add identifier as a child node for better tree visualization
    const childrenElement = document.createElement('div');
    childrenElement.className = 'ast-node-children';
    const label = document.createElement('div');
    label.className = 'ast-node-child-label';
    label.textContent = 'name:';
    childrenElement.appendChild(label);
    
    const childElement = createAstNodeElement(filteredNode.id, false);
    childrenElement.appendChild(childElement);
    nodeElement.appendChild(childrenElement);
  }
  
  if (filteredNode.typeAnnotation && typeof filteredNode.typeAnnotation === 'object') {
    const childrenElement = document.createElement('div');
    childrenElement.className = 'ast-node-children';
    const label = document.createElement('div');
    label.className = 'ast-node-child-label';
    label.textContent = 'type:';
    childrenElement.appendChild(label);
    
    const childElement = createAstNodeElement(filteredNode.typeAnnotation, false);
    childrenElement.appendChild(childElement);
    nodeElement.appendChild(childrenElement);
  }
  
  return nodeElement;
}

/**
 * Helper function to scroll an element into view only if it's not already visible
 * 
 * @param {HTMLElement} element - The element to scroll into view
 * @param {HTMLElement} container - The scrollable container
 */
function scrollIntoViewIfNeeded(element, container) {
  // Get the element's position relative to the container
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  
  // Check if the element is not fully visible
  const isNotFullyVisible = (
    elementRect.bottom > containerRect.bottom ||  // Element extends below container
    elementRect.top < containerRect.top ||        // Element extends above container
    elementRect.right > containerRect.right ||    // Element extends to the right of container
    elementRect.left < containerRect.left         // Element extends to the left of container
  );
  
  // Only scroll if the element is not fully visible
  if (isNotFullyVisible) {
    element.scrollIntoView({
      behavior: 'auto',
      block: 'nearest',
      inline: 'nearest'
    });
  }
}

// Initialize the visualizer when the page loads
document.addEventListener('DOMContentLoaded', () => {
  initializeVisualization();
});