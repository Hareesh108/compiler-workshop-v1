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
  // Check for duplicate declaration in the CURRENT scope only
  if (scope.declarations.has(name)) {
    return false; // Duplicate declaration error
  }

  // Add the declaration to the current scope
  scope.declarations.set(name, node);
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
  // Visit each statement in the program body
  for (const statement of node.body) {
    visitNode(state, statement);
  }
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
  // Get the variable name
  const name = node.id.name;

  // Try to declare it in the current scope
  if (!declareInScope(state.currentScope, name, node)) {
    // If declaration fails, report a duplicate declaration error
    reportError(state.errors, `Duplicate declaration of '${name}'`, node);
  }

  // Remember type annotation if present
  if (node.typeAnnotation) {
    // Store type annotation in node for later type checking
    node.id.typeAnnotation = node.typeAnnotation;
  }

  // Process the initializer expression
  visitNode(state, node.init);
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
  // Create a new scope for the function body
  enterScope(state);

  // Add each parameter to the function scope
  for (const param of node.params) {
    const name = param.name;
    // Check for duplicate parameter names
    if (!declareInScope(state.currentScope, name, param)) {
      reportError(state.errors, `Duplicate parameter name '${name}'`, param);
    }

    // Remember parameter type annotations if present
    // Type checking will validate these later
  }

  // Remember return type annotation if present
  // Type checking will validate this later

  // Process the function body
  if (Array.isArray(node.body)) {
    // Block body with statements: () => { statements }
    for (const statement of node.body) {
      visitNode(state, statement);
    }
  } else {
    // Expression body: () => expression
    visitNode(state, node.body);
  }

  // Restore the previous scope when leaving the function
  exitScope(state);
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
  // Skip built-in literals (true, false)
  if (node.name === "true" || node.name === "false") {
    return;
  }

  const name = node.name;

  // Check if the variable is declared in any accessible scope
  if (!isDeclaredInScope(state.currentScope, name)) {
    // If not, report an undeclared variable error
    reportError(
      state.errors,
      `Reference to undeclared variable '${name}'`,
      node,
    );
  }
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
  // Process the return value if it exists
  if (node.argument) {
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
  // Visit both operands
  visitNode(state, node.left);
  visitNode(state, node.right);
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
  // Visit the condition expression
  visitNode(state, node.test);

  // Visit both branches
  visitNode(state, node.consequent);
  visitNode(state, node.alternate);
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
 * Analyze an AST to check for naming errors
 *
 * This is the main entry point for static analysis. It:
 * 1. Creates a global scope
 * 2. Visits the AST recursively to analyze all nodes
 * 3. Returns the AST and any errors found
 *
 * @param {object} ast - The AST to analyze
 * @returns {object} - The same AST, now with scope information and any errors
 */
function analyze(ast) {
  // Create initial analyzer state with global scope
  const state = {
    errors: [],
    currentScope: createScope(),
    previousScope: null,
  };

  // Start traversing the AST from the root
  visitNode(state, ast);

  // Return the annotated AST and any errors found
  return {
    ast,
    errors: state.errors,
  };
}

/**
 * Convenience function to analyze source code directly
 *
 * This function combines parsing and name resolution in one step.
 *
 * @param {string} sourceCode - Source code to analyze
 * @param {object} options - Options including parsing function
 * @returns {object} - Analysis result
 */
function analyzeCode(sourceCode, { compile }) {
  // First parse the source code into an AST
  const ast = compile(sourceCode);

  // Then perform name resolution analysis
  return analyze(ast);
}

// Export the main functions based on environment
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    analyze, // Analyze an existing AST
    analyzeCode, // Analyze source code from scratch
    createScope, // Export for visualizer
    declareInScope, // Export for visualizer
    isDeclaredInScope, // Export for visualizer
    getDeclarationFromScope, // Export for visualizer
  };
}

// Also expose functions to browser if in browser environment
if (typeof window !== "undefined") {
  if (!window.CompilerModule) {
    window.CompilerModule = {};
  }
  
  // Make analyzer functions available in browser
  window.CompilerModule.analyze = analyze;
  window.CompilerModule.analyzeCode = analyzeCode;
  window.CompilerModule.createScope = createScope;
  window.CompilerModule.declareInScope = declareInScope;
  window.CompilerModule.isDeclaredInScope = isDeclaredInScope;
  window.CompilerModule.getDeclarationFromScope = getDeclarationFromScope;
}
