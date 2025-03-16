/**
 * Static Name Resolution Module
 *
 * This module performs semantic analysis on the AST focusing on variable scoping.
 *
 * Purpose:
 * - Enforces that variables are declared before they are used
 * - Checks for duplicate variable declarations within the same scope
 * - Tracks variable scoping in nested environments (functions, blocks)
 * - Establishes the lexical environment for later type checking
 *
 * How it works:
 * 1. We walk through the AST in a depth-first manner
 * 2. We maintain a "scope" data structure that maps variable names to their declarations
 * 3. When we enter a new scope (e.g., a function), we create a child scope
 * 4. Variable lookups check the current scope and recursively check parent scopes
 *
 * This implements lexical (static) scoping, where variable references
 * are resolved based on their position in the source code.
 */

/**
 * Create a new scope
 * @param {object|null} parent - Parent scope, or null for the global scope
 * @returns {object} - A new scope object
 */
function createScope(parent = null) {
  return {
    parent,
    declarations: new Map(),
  };
}

/**
 * Declare a new variable in the current scope
 *
 * This adds a variable to the current scope, but will fail if the variable
 * is already declared in this scope (a duplicate declaration error).
 *
 * Note: It's perfectly legal to shadow a variable from an outer scope.
 * For example:
 *   const x = 10;
 *   function foo() {
 *     const x = 20; // This shadows the outer x, not a duplicate
 *   }
 *
 * @param {object} scope - The scope to declare the variable in
 * @param {string} name - Variable name
 * @param {object} node - AST node where the variable is declared
 * @returns {boolean} - Whether the declaration was successful
 */
function declareInScope(scope, name, node) {
  // Check if the variable is already declared in this scope
  if (scope.declarations.has(name)) {
    return false; // Duplicate declaration
  }

  // Add the declaration to this scope
  scope.declarations.set(name, {
    node,
    references: []
  });

  return true;
}

/**
 * Check if a variable is declared in this scope or any parent scope
 *
 * This implements lexical scoping rules, where a variable is visible
 * in its own scope and all inner scopes, unless shadowed.
 *
 * @param {object} scope - The scope to check
 * @param {string} name - Variable name to look up
 * @returns {boolean} - Whether the variable is declared
 */
function isDeclaredInScope(scope, name) {
  // Check the current scope first
  if (scope.declarations.has(name)) {
    return true;
  }

  // If not found, recursively check parent scopes
  if (scope.parent) {
    return isDeclaredInScope(scope.parent, name);
  }

  // Not found in any scope
  return false;
}

/**
 * Find declaration node for a variable
 *
 * This returns the actual AST node where the variable was declared.
 * Like isDeclared(), it follows lexical scoping rules by checking
 * the current scope first, then parent scopes.
 *
 * @param {object} scope - The scope to check
 * @param {string} name - Variable name to look up
 * @returns {object|null} - The declaration node or null if not found
 */
function getDeclarationFromScope(scope, name) {
  // Check current scope
  if (scope.declarations.has(name)) {
    return scope.declarations.get(name);
  }

  // Check parent scopes recursively
  if (scope.parent) {
    return getDeclarationFromScope(scope.parent, name);
  }

  // Not found anywhere
  return null;
}

/**
 * Report an error found during analysis
 *
 * This records details about an error including where it occurred
 * in the source code to help users find and fix it.
 *
 * @param {Array} errors - Array to add the error to
 * @param {string} message - Error message
 * @param {object} node - AST node where the error occurred
 */
function reportError(errors, message, node) {
  let location = "unknown position";

  // Try to get position information from the node
  if (node.position !== undefined) {
    location = `position ${node.position}`;
  } else if (node.id && node.id.position !== undefined) {
    location = `position ${node.id.position}`;
  }

  // Add the error to our list
  errors.push({
    message: `${message} at ${location}`,
    node,
  });
}

/**
 * Create a new scope for a lexical environment
 *
 * This is called when entering a new scope, such as:
 * - Function bodies
 * - Block statements
 *
 * @param {object} state - Current analyzer state
 */
function enterScope(state) {
  const previousScope = state.currentScope;
  // Create a new scope with the current scope as parent
  const newScope = createScope(previousScope);

  state.previousScope = previousScope;
  state.currentScope = newScope;
}

/**
 * Restore the previous scope when leaving a lexical environment
 *
 * @param {object} state - Current analyzer state
 */
function exitScope(state) {
  state.currentScope = state.previousScope;
}

/**
 * Visit an AST node and its children
 *
 * This is the main traversal method that routes each node to its
 * appropriate visitor function based on the node type.
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - AST node to visit
 */
function visitNode(state, node) {
  if (!node) return;

  // Create a new scope if this node introduces a new scope
  if (isNodeWithScope(node)) {
    // Emit event for entering a scope
    emitNameResolutionEvent(state, 'enterScope', {
      nodeType: node.type,
      location: node.location
    });

    // Create a new scope with the current scope as parent
    const newScope = createScope(state.currentScope);

    // Remember the previous scope to return to
    const previousScope = state.currentScope;

    // Set the current scope to the new scope
    state.currentScope = newScope;

    // Map the node to its scope for later reference
    state.scopes.set(node, newScope);

    // Process the node according to its type
    processNode(state, node);

    // After processing, revert to the previous scope
    state.currentScope = previousScope;

    // Emit event for leaving a scope
    emitNameResolutionEvent(state, 'leaveScope', {
      nodeType: node.type,
      location: node.location
    });
  } else {
    // Process node normally without changing scope
    processNode(state, node);
  }
}

/**
 * Visit all children of a node
 *
 * This is a generic traversal method used when we don't have a
 * specific visitor function for a node type.
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - Node whose children should be visited
 */
function visitChildren(state, node) {
  if (!node || typeof node !== "object") {
    return;
  }

  // Iterate through all properties of the node
  for (const key in node) {
    if (node.hasOwnProperty(key) && key !== "type") {
      const child = node[key];

      // Handle arrays (e.g., body of a block)
      if (Array.isArray(child)) {
        for (const item of child) {
          visitNode(state, item);
        }
      }
      // Handle nested objects (other AST nodes)
      else if (child && typeof child === "object") {
        visitNode(state, child);
      }
    }
  }
}

/**
 * Visit a program node (the root of the AST)
 *
 * A program consists of a series of top-level statements.
 * These statements are executed in the global scope.
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - Program node to visit
 */
function visitProgram(state, node) {
  // Emit event for entering program scope (global scope)
  emitNameResolutionEvent(state, 'enterProgram', {
    nodeType: 'Program',
    location: node.location
  });

  // Visit each statement in the program body
  for (const statement of node.body) {
    visitNode(state, statement);
  }

  // Emit event for leaving program scope
  emitNameResolutionEvent(state, 'leaveProgram', {
    nodeType: 'Program',
    location: node.location
  });
}

/**
 * Visit a function call expression
 *
 * For a call expression, we need to:
 * 1. Ensure the callee (the function) is in scope
 * 2. Check each argument expression
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - CallExpression node to visit
 */
function visitCallExpression(state, node) {
  // Visit the function being called
  visitNode(state, node.callee);

  // Visit each argument passed to the function
  for (const arg of node.arguments) {
    visitNode(state, arg);
  }
}

/**
 * Visit a const declaration
 *
 * When we see a const declaration, we need to:
 * 1. Add the variable to the current scope
 * 2. Check for duplicate declarations in the same scope
 * 3. Process the initializer expression
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - ConstDeclaration node to visit
 */
function visitConstDeclaration(state, node) {
  // Process the initializer first
  if (node.init) {
    visitNode(state, node.init);
  }

  // Check for duplicate declaration
  if (!declareInScope(state.currentScope, node.id.name, node)) {
    reportError(
      state.errors,
      `Duplicate declaration of variable: ${node.id.name}`,
      node
    );
  } else {
    // Emit declaration event
    emitNameResolutionEvent(state, 'declare', {
      name: node.id.name,
      node,
      scope: state.currentScope
    });
  }

  // Process the identifier (this is just for completeness; we don't need to check
  // for undeclared references since we just declared it)
  node.id._context = 'declaration';
  visitNode(state, node.id);
}

/**
 * Visit an arrow function
 *
 * Arrow functions create a new lexical scope. We need to:
 * 1. Create a new scope for the function body
 * 2. Declare parameters in the function scope
 * 3. Process the function body
 * 4. Restore the parent scope when done
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - ArrowFunctionExpression node to visit
 */
function visitArrowFunction(state, node) {
  // Process the function using the general function handling
  visitFunction(state, node);
}

/**
 * Visit an identifier (variable reference)
 *
 * When we see an identifier used as a value, we need to:
 * 1. Check if it refers to a declared variable
 * 2. Report an error if the variable is not in scope
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - Identifier node to visit
 */
function visitIdentifier(state, node) {
  // Skip if this is not a variable reference
  // (e.g., it's a property in a member expression)
  if (node._context !== 'variable') {
    return;
  }

  // Look up the identifier in the current scope and parent scopes
  const declaration = getDeclarationFromScope(state.currentScope, node.name);

  // Record the lookup event
  emitNameResolutionEvent(state, 'lookup', {
    name: node.name,
    node,
    found: !!declaration,
    location: declaration ? declaration.node.location : null
  });

  if (!declaration) {
    reportError(state.errors, `Reference to undeclared variable: ${node.name}`, node);
    return;
  }

  // Record the reference in the original declaration
  declaration.references = declaration.references || [];
  declaration.references.push(node);

  // Link this identifier to its declaration
  node._declaration = declaration.node;
}

/**
 * Visit a return statement
 *
 * For a return statement, we just need to analyze its argument (if any).
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - ReturnStatement node to visit
 */
function visitReturnStatement(state, node) {
  // If we have a return value, mark any identifiers and process it
  if (node.argument) {
    if (node.argument.type === 'Identifier') {
      node.argument._context = 'variable';
    }
    visitNode(state, node.argument);
  }
}

/**
 * Visit a binary expression (e.g., a + b)
 *
 * For a binary expression, we need to analyze both sides.
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - BinaryExpression node to visit
 */
function visitBinaryExpression(state, node) {
  // Mark identifiers as variable references
  if (node.left && node.left.type === 'Identifier') {
    node.left._context = 'variable';
  }

  if (node.right && node.right.type === 'Identifier') {
    node.right._context = 'variable';
  }

  // Visit left and right operands
  if (node.left) {
    visitNode(state, node.left);
  }

  if (node.right) {
    visitNode(state, node.right);
  }
}

/**
 * Visit a conditional (ternary) expression (condition ? then : else)
 *
 * We need to analyze all three parts: the condition and both branches.
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - ConditionalExpression node to visit
 */
function visitConditionalExpression(state, node) {
  // Mark identifiers in the test condition
  if (node.test && node.test.type === 'Identifier') {
    node.test._context = 'variable';
  }

  // Process test condition
  if (node.test) {
    visitNode(state, node.test);
  }

  // Mark identifiers in the consequent (true branch)
  if (node.consequent && node.consequent.type === 'Identifier') {
    node.consequent._context = 'variable';
  }

  // Process consequent (true branch)
  if (node.consequent) {
    visitNode(state, node.consequent);
  }

  // Mark identifiers in the alternate (false branch)
  if (node.alternate && node.alternate.type === 'Identifier') {
    node.alternate._context = 'variable';
  }

  // Process alternate (false branch)
  if (node.alternate) {
    visitNode(state, node.alternate);
  }
}

/**
 * Visit an array literal
 *
 * We need to analyze each element in the array.
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - ArrayLiteral node to visit
 */
function visitArrayLiteral(state, node) {
  // Visit each element in the array
  for (const element of node.elements) {
    visitNode(state, element);
  }
}

/**
 * Visit a member expression (array access)
 *
 * We need to analyze both the object being accessed and the index.
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - MemberExpression node to visit
 */
function visitMemberExpression(state, node) {
  // Visit the object being accessed
  visitNode(state, node.object);

  // Visit the index expression
  visitNode(state, node.index);
}

/**
 * Analyze an AST to check for scope-based errors
 *
 * @param {object} ast - The AST to analyze
 * @param {object} [options] - Options for analysis
 * @param {Function} [options.onNameResolution] - Callback for name resolution events
 * @returns {object} - The analyzed AST with scope information and any errors
 */
function analyze(ast, options = {}) {
  const state = {
    currentScope: createScope(), // Initialize with global scope
    errors: [],
    scopes: new Map(), // Map from nodes to their scopes
    options
  };

  visitNode(state, ast);

  return {
    ast,
    errors: state.errors,
    scopes: state.scopes
  };
}

/**
 * Analyze source code, running the parser first then the analyzer
 *
 * @param {string} sourceCode - Source code to analyze
 * @param {object} options - Options for compilation
 * @param {boolean} [options.compile=true] - Whether to run the full compilation or just parse
 * @param {Function} [options.onNameResolution] - Callback for name resolution events
 * @returns {object} - Result containing the AST and any errors
 */
function analyzeCode(sourceCode, { compile = true, onNameResolution } = {}) {
  // First, parse the source code into an AST
  const parseResult = window.CompilerModule.parseCode(sourceCode);

  if (parseResult.errors.length > 0) {
    return parseResult;  // Return early if there are syntax errors
  }

  // Then, perform semantic analysis on the AST
  const analysisResult = analyze(parseResult.ast, { onNameResolution });

  return {
    ast: parseResult.ast,
    errors: [...parseResult.errors, ...analysisResult.errors],
    scopes: analysisResult.scopes
  };
}

/**
 * Emit a name resolution event via the callback if provided
 *
 * @param {object} state - The current state
 * @param {string} eventType - The type of event (e.g., 'declare', 'lookup')
 * @param {object} details - Details about the event
 */
function emitNameResolutionEvent(state, eventType, details) {
  if (state.options.onNameResolution) {
    state.options.onNameResolution({
      type: eventType,
      ...details
    });
  }
}

/**
 * Check if a node introduces a new scope
 *
 * @param {object} node - The AST node
 * @returns {boolean} - True if the node introduces a new scope
 */
function isNodeWithScope(node) {
  return node && (
    node.type === "Program" ||
    node.type === "ArrowFunctionExpression" ||
    node.type === "BlockStatement"
  );
}

/**
 * Process a node according to its type
 *
 * @param {object} state - The current state
 * @param {object} node - The AST node
 */
function processNode(state, node) {
  // Skip null/undefined nodes and non-objects
  if (!node || typeof node !== "object") {
    return;
  }

  // Dispatch to appropriate visitor function based on node type
  switch (node.type) {
    // Program is the root of the AST
    case "Program":
      visitProgram(state, node);
      break;

    // Variable declarations
    case "ConstDeclaration":
      visitConstDeclaration(state, node);
      break;

    // Functions
    case "ArrowFunctionExpression":
      visitArrowFunction(state, node);
      break;

    // Variable references
    case "Identifier":
      visitIdentifier(state, node);
      break;

    // Statements
    case "ReturnStatement":
      visitReturnStatement(state, node);
      break;

    // Expressions
    case "BinaryExpression":
      visitBinaryExpression(state, node);
      break;

    case "ConditionalExpression":
      visitConditionalExpression(state, node);
      break;

    case "CallExpression":
      visitCallExpression(state, node);
      break;

    case "ArrayLiteral":
      visitArrayLiteral(state, node);
      break;

    case "MemberExpression":
      visitMemberExpression(state, node);
      break;

    // Literals don't need name resolution
    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral":
      break;

    default:
      // For unknown node types, traverse children generically
      visitChildren(state, node);
      break;
  }
}

/**
 * Process a function node
 *
 * @param {object} state - The current state
 * @param {object} node - The function node
 */
function visitFunction(state, node) {
  // For each parameter, declare it in the current scope
  if (node.params) {
    for (const param of node.params) {
      // Declare the parameter in the current function scope
      if (!declareInScope(state.currentScope, param.name, param)) {
        reportError(
          state.errors,
          `Duplicate parameter name: ${param.name}`,
          param
        );
      } else {
        // Emit function parameter declaration event
        emitNameResolutionEvent(state, 'declareParam', {
          name: param.name,
          node: param,
          scope: state.currentScope
        });
      }
    }
  }

  // Process the function body
  if (node.body) {
    if (Array.isArray(node.body)) {
      // Block body with statements: () => { statements }
      for (const statement of node.body) {
        visitNode(state, statement);
      }
    } else {
      // Expression body: () => expression
      visitNode(state, node.body);
    }
  }
}

// Export functions for use in the browser
if (typeof window !== "undefined") {
  window.CompilerModule = window.CompilerModule || {};

  // Expose analyze function to the global CompilerModule
  window.CompilerModule.analyze = analyze;
  window.CompilerModule.analyzeCode = analyzeCode;
}

// Export the main functions for use in the compilation pipeline
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    analyze, // Analyze an existing AST
    analyzeCode, // Analyze source code from scratch
  };
}
