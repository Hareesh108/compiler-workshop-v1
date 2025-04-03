/**
 * Naming (aka Name Resolution, aka Canonicalization)
 *
 * This module performs semantic analysis on the parse tree, focusing
 * on reporting naming errors.
 *
 * Purpose:
 * - Enforces that variables are declared before they are used
 * - Checks for duplicate variable declarations within the same scope
 * - Tracks variable scoping in nested environments (functions, blocks)
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
    references: [],
  });

  return true;
}

/**
 * Check if a variable is declared in this scope or any parent scope
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
 * @param {Array} errors - Array to add the error to
 * @param {string} message - Error message
 * @param {object} node - AST node where the error occurred
 */
function reportError(errors, message, node) {
  errors.push({
    message,
    node,
  });
}

/**
 * Check if a node introduces a new scope
 *
 * @param {object} node - The AST node
 * @returns {boolean} - True if the node introduces a new scope
 */
function isNodeWithScope(node) {
  return (
    node &&
    (node.type === "ArrowFunctionExpression" || node.type === "BlockStatement")
  );
}

/**
 * Visit and analyze an AST node and its children
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - AST node to visit
 */
function visitNode(state, node) {
  if (!node || typeof node !== "object") {
    return;
  }

  // Create a new scope if this node introduces a new scope
  if (isNodeWithScope(node)) {
    const previousScope = state.currentScope;
    // Create a new scope with the current scope as parent
    const newScope = createScope(previousScope);

    // Set the current scope to the new scope
    state.currentScope = newScope;

    // Map the node to its scope for later reference
    state.scopes.set(node, newScope);

    // Process the node according to its type
    processNode(state, node);

    // After processing, revert to the previous scope
    state.currentScope = previousScope;
  } else {
    // Process node normally without changing scope
    processNode(state, node);
  }
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

    case "BlockStatement":
      visitBlockStatement(state, node);
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
 * Visit a const declaration
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - ConstDeclaration node to visit
 */
function visitConstDeclaration(state, node) {
  // Process the initializer first (must be evaluated before variable is in scope)
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
  }
}

/**
 * Visit an arrow function
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - ArrowFunctionExpression node to visit
 */
function visitArrowFunction(state, node) {
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
      }
    }
  }

  // Process the function body
  visitNode(state, node.body);
}

/**
 * Visit a block statement
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - BlockStatement node to visit
 */
function visitBlockStatement(state, node) {
  // Visit each statement in the block
  for (const statement of node.body) {
    visitNode(state, statement);
  }
}

/**
 * Visit an identifier (variable reference)
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - Identifier node to visit
 */
function visitIdentifier(state, node) {
  // We only care about identifiers used as variables
  // Skip identifiers used in other contexts (e.g., property names)
  if (node._context === "property") {
    return;
  }

  // Look up the identifier in the current scope and parent scopes
  const declaration = getDeclarationFromScope(state.currentScope, node.name);

  if (!declaration) {
    reportError(
      state.errors,
      `Reference to undeclared variable: ${node.name}`,
      node
    );
    return;
  }

  // Record the reference in the original declaration
  declaration.references.push(node);

  // Link this identifier to its declaration
  node._declaration = declaration.node;
}

/**
 * Visit a return statement
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - ReturnStatement node to visit
 */
function visitReturnStatement(state, node) {
  // If we have a return value, process it
  if (node.argument) {
    visitNode(state, node.argument);
  }
}

/**
 * Visit a binary expression
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - BinaryExpression node to visit
 */
function visitBinaryExpression(state, node) {
  // Visit left and right operands
  visitNode(state, node.left);
  visitNode(state, node.right);
}

/**
 * Visit a conditional (ternary) expression
 *
 * @param {object} state - Current analyzer state
 * @param {object} node - ConditionalExpression node to visit
 */
function visitConditionalExpression(state, node) {
  // Process test condition
  visitNode(state, node.test);

  // Process consequent (true branch)
  visitNode(state, node.consequent);

  // Process alternate (false branch)
  visitNode(state, node.alternate);
}

/**
 * Visit a function call expression
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
 * Visit an array literal
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
 * @param {object|Array} ast - The AST to analyze (may be an array of statements)
 * @returns {object} - The analyzed AST with scope information and any errors
 */
function analyze(ast) {
  const state = {
    currentScope: createScope(), // Initialize with global scope
    errors: [],
    scopes: new Map(), // Map from nodes to their scopes
  };

  // If ast is an array (program statements), process each statement
  if (Array.isArray(ast)) {
    for (const statement of ast) {
      visitNode(state, statement);
    }
  } else {
    // Otherwise just process the single node
    visitNode(state, ast);
  }

  return {
    ast,
    errors: state.errors,
    scopes: state.scopes,
  };
}

/**
 * Analyze source code, running the parser first then the analyzer
 *
 * @param {string} sourceCode - Source code to analyze
 * @returns {object} - Result containing the AST and any errors
 */
function analyzeCode(sourceCode) {
  const { compile } = require("./parse");

  // First, parse the source code into an AST
  const statements = compile(sourceCode);

  // Then, perform semantic analysis on the AST
  const analysisResult = analyze(statements);

  return {
    ast: statements,
    errors: analysisResult.errors,
    scopes: analysisResult.scopes,
  };
}

module.exports = {
  analyze,
  analyzeCode,
};
