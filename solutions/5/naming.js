/**
 * Naming (aka Name Resolution, aka Canonicalization)
 *
 * This module performs semantic analysis on the parse tree, focusing
 * on reporting naming errors. It:
 * - Enforces that variables are declared before they are used
 * - Checks for duplicate variable declarations within the same scope
 * - Supports nested scopes (e.g. in function bodies)
 */

let errors = [];
let scopes = [];

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

    case "BlockStatement":
      visitBlockStatement(node);
      break;

    // Literals don't need name resolution
    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral":
      break;

    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

/**
 * Visit an identifier (variable reference)
 *
 * @param {object} node - Identifier node to visit
 */
function visitIdentifier(node) {
  if (!scopes.some((scope) => scope.has(node.name))) {
    reportError(`Reference to undeclared variable: ${node.name}`, node);
  }
}

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
  const currentScope = scopes[scopes.length - 1];

  if (currentScope.has(name)) {
    reportError(`Duplicate declaration of variable: ${name}`, node);
    return false;
  }

  currentScope.add(name);
  return true;
}

/**
 * Visit a binary expression
 *
 * @param {object} node - BinaryExpression node to visit
 */
function visitBinaryExpression(node) {
  visitNode(node.left);
  visitNode(node.right);
}

/**
 * Visit an arrow function
 *
 * @param {object} node - ArrowFunctionExpression node to visit
 */
function visitArrowFunction(node) {
  scopes.push(new Set());

  for (const param of node.params) {
    declareVariable(param.name, param);
  }

  visitNode(node.body);
  scopes.pop();
}

/**
 * Visit a function call expression
 *
 * @param {object} node - CallExpression node to visit
 */
function visitCallExpression(node) {
  visitNode(node.callee);

  for (const arg of node.arguments) {
    visitNode(arg);
  }
}

/**
 * Visit a const declaration
 *
 * @param {object} node - ConstDeclaration node to visit
 */
function visitConstDeclaration(node) {
  visitNode(node.init);
  declareVariable(node.id.name, node);
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
 * Visit a return statement
 *
 * @param {object} node - ReturnStatement node to visit
 */
function visitReturnStatement(node) {
  visitNode(node.argument);
}

/**
 * Visit a conditional (ternary) expression
 *
 * @param {object} node - ConditionalExpression node to visit
 */
function visitConditionalExpression(node) {
  visitNode(node.test);
  visitNode(node.consequent);
  visitNode(node.alternate);
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
 * Analyze a parse tree to check for scope-based errors
 *
 * @param {object|Array} statements - The parse tree to analyze (may be an array of statements)
 * @returns {object} - The analyzed parse tree with scope information and any errors
 */
function nameCheck(statements) {
  // Reset globals
  errors = [];
  scopes = [new Set()];

  for (const statement of statements) {
    visitNode(statement);
  }

  scopes.pop();

  return { errors };
}

module.exports = {
  nameCheck,
};
