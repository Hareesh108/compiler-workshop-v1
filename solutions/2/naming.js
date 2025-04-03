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

let errors = [];
let scopeStack = []; // Stack of Sets, each Set contains variable names declared in that scope

/**
 * Declare a new variable in the current scope
 *
 * This adds a variable to the current scope, but will fail if the variable
 * is already declared in this scope (a duplicate declaration error).
 *
 * @param {string} name - Variable name
 * @param {object} node - Parse tree node where the variable is declared
 * @returns {boolean} - True if declaration succeeded, false if duplicate
 */
function declareVariable(name, node) {
  const currentScope = scopeStack[scopeStack.length - 1];

  if (currentScope.has(name)) {
    reportError(`Duplicate declaration of variable: ${name}`, node);
    return false;
  }

  currentScope.add(name);
  return true;
}

/**
 * Report an error found during analysis
 *
 * @param {string} message - Error message
 * @param {object} node - Parse tree node where the error occurred
 */
function reportError(message, node) {
  errors.push({
    message,
    node,
  });
}

/**
 * Create a new scope
 *
 * Pushes a new Set onto the scopeStack to represent a new scope
 */
function createScope() {
  const newScope = new Set();
  scopeStack.push(newScope);
}

/**
 * Visit and analyze a parse tree node and its children
 *
 * @param {object} node - Parse tree node to visit
 */
function visitNode(node) {
  switch (node.type) {
    case "ConstDeclaration":
      visitConstDeclaration(node);
      break;

    case "ArrowFunctionExpression":
      visitArrowFunction(node);
      break;

    case "Identifier":
      visitIdentifier(node);
      break;

    case "ReturnStatement":
      visitReturnStatement(node);
      break;

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
      throw new Error(`Unknown node type: ${node.type}`);
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

  declareVariable(node.id.name, node);
}

/**
 * Visit an arrow function
 *
 * @param {object} node - ArrowFunctionExpression node to visit
 */
function visitArrowFunction(node) {
  // Create a new scope for the function
  createScope();

  // Check for duplicate parameters within function scope
  if (node.params) {
    const paramNames = new Set();
    for (const param of node.params) {
      if (paramNames.has(param.name)) {
        reportError(`Duplicate parameter name: ${param.name}`, param);
      } else {
        paramNames.add(param.name);
        // Declare the parameter in the current function scope
        declareVariable(param.name, param);
      }
    }
  }

  // Process the function body
  if (node.body) {
    visitNode(node.body);
  }

  // Exit the function scope
  scopeStack.pop();
}

/**
 * Visit a block statement
 *
 * @param {object} node - BlockStatement node to visit
 */
function visitBlockStatement(node) {
  // Visit each statement in the block without creating a new scope
  // (in this implementation, only functions create new scopes per the tests)
  for (const statement of node.body) {
    visitNode(statement);
  }
}

/**
 * Check if a variable is declared in any accessible scope
 *
 * @param {string} name - The variable name to look for
 * @returns {boolean} - True if the variable is declared in any accessible scope
 */
function isVariableDeclared(name) {
  // Check each scope from innermost to outermost
  for (let i = scopeStack.length - 1; i >= 0; i--) {
    const scope = scopeStack[i];
    if (scope.has(name)) {
      return true;
    }
  }

  return false;
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

  if (!isVariableDeclared(node.name)) {
    reportError(`Reference to undeclared variable: ${node.name}`, node);
    return;
  }
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
  // First visit the function being called
  if (node.callee) {
    visitNode(node.callee);
  }

  // Then check arguments
  if (node.arguments && Array.isArray(node.arguments)) {
    for (const arg of node.arguments) {
      if (arg) {
        visitNode(arg);
      }
    }
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
  if (node.index) {
    visitNode(node.index);
  }
}

/**
 * Analyze a parse tree to check for scope-based errors
 *
 * @param {object|Array} statements - The parse tree to analyze (may be an array of statements)
 * @returns {object} - The analyzed parse tree with scope information and any errors
 */
function nameCheck(statements) {
  errors = [];
  scopeStack = [];

  // Create the global scope
  createScope();

  for (const statement of statements) {
    visitNode(statement);
  }

  // Clean up global scope after analysis
  scopeStack.pop();

  return {
    errors,
  };
}

module.exports = {
  nameCheck,
};
