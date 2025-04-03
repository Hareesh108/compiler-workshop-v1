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

// Global state for the name resolver
const state = {
  currentScope: null,
  errors: [],
  scopes: new Map() // Map from nodes to their scopes
};

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
 * @param {object} node - Parse tree node where the variable is declared
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
 * @param {string} message - Error message
 * @param {object} node - Parse tree node where the error occurred
 */
function reportError(message, node) {
  state.errors.push({
    message,
    node,
  });
}

/**
 * Check if a node introduces a new scope
 *
 * @param {object} node - The parse tree node
 * @returns {boolean} - True if the node introduces a new scope
 */
function isNodeWithScope(node) {
  return (
    node &&
    (node.type === "ArrowFunctionExpression" || node.type === "BlockStatement")
  );
}

/**
 * Visit and analyze a parse tree node and its children
 *
 * @param {object} node - Parse tree node to visit
 */
function visitNode(node) {
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
    processNode(node);

    // After processing, revert to the previous scope
    state.currentScope = previousScope;
  } else {
    // Process node normally without changing scope
    processNode(node);
  }
}

/**
 * Process a node according to its type
 *
 * @param {object} node - The parse tree node
 */
function processNode(node) {
  // Skip null/undefined nodes and non-objects
  if (!node || typeof node !== "object") {
    return;
  }

  // Dispatch to appropriate visitor function based on node type
  switch (node.type) {
    // Variable declarations
    case "ConstDeclaration":
      visitConstDeclaration(node);
      break;

    // Functions
    case "ArrowFunctionExpression":
      visitArrowFunction(node);
      break;

    // Variable references
    case "Identifier":
      visitIdentifier(node);
      break;

    // Statements
    case "ReturnStatement":
      visitReturnStatement(node);
      break;

    // Expressions
    case "BinaryExpression":
      visitBinaryExpression(node);
      break;

    case "ConditionalExpression":
      visitConditionalExpression(node);
      break;

    case "CallExpression":
      visitCallExpression(node);
      break;

    case "ArrayLiteral":
      visitArrayLiteral(node);
      break;

    case "MemberExpression":
      visitMemberExpression(node);
      break;

    case "BlockStatement":
      visitBlockStatement(node);
      break;

    // Literals don't need name resolution
    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral":
      break;

    default:
      // For unknown node types, traverse children generically
      visitChildren(node);
      break;
  }
}

/**
 * Visit all children of a node
 *
 * @param {object} node - Node whose children should be visited
 */
function visitChildren(node) {
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
          visitNode(item);
        }
      }
      // Handle nested objects (other parse tree nodes)
      else if (child && typeof child === "object") {
        visitNode(child);
      }
    }
  }
}

/**
 * Visit a const declaration
 *
 * @param {object} node - ConstDeclaration node to visit
 */
function visitConstDeclaration(node) {
  // Process the initializer first (must be evaluated before variable is in scope)
  if (node.init) {
    visitNode(node.init);
  }

  // Check for duplicate declaration
  if (!declareInScope(state.currentScope, node.id.name, node)) {
    reportError(
      `Duplicate declaration of variable: ${node.id.name}`,
      node
    );
  }
}

/**
 * Visit an arrow function
 *
 * @param {object} node - ArrowFunctionExpression node to visit
 */
function visitArrowFunction(node) {
  // For each parameter, declare it in the current scope
  if (node.params) {
    for (const param of node.params) {
      // Declare the parameter in the current function scope
      if (!declareInScope(state.currentScope, param.name, param)) {
        reportError(
          `Duplicate parameter name: ${param.name}`,
          param
        );
      }
    }
  }

  // Process the function body
  visitNode(node.body);
}

/**
 * Visit a block statement
 *
 * @param {object} node - BlockStatement node to visit
 */
function visitBlockStatement(node) {
  // Visit each statement in the block
  for (const statement of node.body) {
    visitNode(statement);
  }
}

/**
 * Visit an identifier (variable reference)
 *
 * @param {object} node - Identifier node to visit
 */
function visitIdentifier(node) {
  // We only care about identifiers used as variables
  // Skip identifiers used in other contexts (e.g., property names)
  if (node._context === "property") {
    return;
  }

  // Look up the identifier in the current scope and parent scopes
  const declaration = getDeclarationFromScope(state.currentScope, node.name);

  if (!declaration) {
    reportError(
      `Reference to undeclared variable: ${node.name}`,
      node
    );
    return;
  }

  // Link this identifier to its declaration
  node._declaration = declaration.node;
}

/**
 * Visit a return statement
 *
 * @param {object} node - ReturnStatement node to visit
 */
function visitReturnStatement(node) {
  // If we have a return value, process it
  if (node.argument) {
    visitNode(node.argument);
  }
}

/**
 * Visit a binary expression
 *
 * @param {object} node - BinaryExpression node to visit
 */
function visitBinaryExpression(node) {
  // Visit left and right operands
  visitNode(node.left);
  visitNode(node.right);
}

/**
 * Visit a conditional (ternary) expression
 *
 * @param {object} node - ConditionalExpression node to visit
 */
function visitConditionalExpression(node) {
  // Process test condition
  visitNode(node.test);

  // Process consequent (true branch)
  visitNode(node.consequent);

  // Process alternate (false branch)
  visitNode(node.alternate);
}

/**
 * Visit a function call expression
 *
 * @param {object} node - CallExpression node to visit
 */
function visitCallExpression(node) {
  // Visit the function being called
  visitNode(node.callee);

  // Visit each argument passed to the function
  for (const arg of node.arguments) {
    visitNode(arg);
  }
}

/**
 * Visit an array literal
 *
 * @param {object} node - ArrayLiteral node to visit
 */
function visitArrayLiteral(node) {
  // Visit each element in the array
  for (const element of node.elements) {
    visitNode(element);
  }
}

/**
 * Visit a member expression (array access)
 *
 * @param {object} node - MemberExpression node to visit
 */
function visitMemberExpression(node) {
  // Visit the object being accessed
  visitNode(node.object);

  // Visit the index expression
  visitNode(node.index);
}

/**
 * Analyze a parse tree to check for scope-based errors
 *
 * @param {object|Array} statements - The parse tree to analyze (may be an array of statements)
 * @returns {object} - The analyzed parse tree with scope information and any errors
 */
function nameCheck(statements) {
  state.currentScope = createScope();
  state.errors = [];
  state.scopes = new Map();

  for (const statement of statements) {
    visitNode(statement);
  }

  return {
    errors: state.errors,
  };
}

module.exports = {
  nameCheck,
};
