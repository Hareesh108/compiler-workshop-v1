// 👉 Run `node index.js` from the parent directory to see which tests are failing.
//
// Fix the failing tests by resolving the "👉" comments in this file!

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
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

/**
 * Visit an identifier (variable reference)
 *
 * @param {object} node - Identifier node to visit
 */
function visitIdentifier(node) {
  // Check if the identifier is in scope.
  const variableName = node.name;

  // Check if the variable exists in any scope
  const isDeclared = scopes.some((scope) => scope.has(variableName));

  // Only report an error if the variable is not declared in any scope
  if (!isDeclared) {
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
  // 👉 Change this to only report the error if the name has been declared.
  //
  // Hint: There are two viable ways to implement this. One way supports shadowing
  //       and the other doesn't. The tests assume shadowing is supported.
  if (false) {
    reportError(`Duplicate declaration of variable: ${name}`, node);
    return false;
  }

  // 👉 Right here, actually add the variable to scope.
  //
  // Hint: You'll need to add it to one of the existing Sets in `scopes`.

  return true;
}

/**
 * Visit a binary expression
 *
 * @param {object} node - BinaryExpression node to visit
 */
function visitBinaryExpression(node) {
  // 👉 Change this to visit both parse tree nodes in the binary expression.
  //
  // The structure of the `node` arg will be:
  //
  // {
  //    left: // the parse tree node to the left of the operator
  //    operator: // string (e.g. "+" or "*" or "/")
  //    right: // the parse tree node to the right of the operator
  // }
  visitNode(node.left);
  visitNode(node.right);
}

/**
 * Visit an arrow function
 *
 * @param {object} node - ArrowFunctionExpression node to visit
 */
function visitArrowFunction(node) {
  // 👉 Create a new scope for the function's body, then declare the
  // function's params in that scope.
  //
  // The structure of the `node` arg will be:
  //
  // {
  //    params: // array of Identifier parse tree nodes (with `name` fields on them).
  //    body: // parse tree node for the body of the function.
  // }
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
 * Visit a member expression (array access)
 *
 * @param {object} node - MemberExpression node to visit
 */
function visitMemberExpression(node) {
  visitNode(node.object);
  visitNode(node.index);
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
