/**
 * AST Validation Module
 *
 * This module performs early validation on the AST before type checking.
 * It checks for structural issues that don't require type information.
 */

/**
 * Report a validation error
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
 * Check if a return statement is in a valid position (last statement)
 *
 * @param {object} node - Return statement node
 * @param {Array} body - Array of statements to check
 * @param {Array} errors - Array to add errors to
 * @returns {boolean} - Whether the return is in a valid position
 */
function checkReturnPosition(node, body, errors) {
  if (!body || !Array.isArray(body)) {
    return true; // Nothing to check
  }

  const returnIndex = body.findIndex((stmt) => stmt.type === "ReturnStatement");
  if (returnIndex === -1) {
    return true; // No return statement
  }

  // Check if it's the last statement
  if (returnIndex !== body.length - 1) {
    reportError(
      errors,
      `Return statement must be the last statement in a function`,
      body[returnIndex],
    );
    return false;
  }

  return true;
}

/**
 * Validate functions in an AST
 *
 * @param {object} node - AST node to validate
 * @param {Array} errors - Array to add errors to
 */
function validateNode(node, errors) {
  if (!node || typeof node !== "object") {
    return;
  }

  // Check specific node types
  if (node.type === "ArrowFunctionExpression" && Array.isArray(node.body)) {
    checkReturnPosition(node, node.body, errors);
  }

  // Recursively validate all properties
  for (const key in node) {
    if (Object.prototype.hasOwnProperty.call(node, key)) {
      const value = node[key];
      
      // Recursively validate arrays
      if (Array.isArray(value)) {
        for (const item of value) {
          validateNode(item, errors);
        }
      } 
      // Recursively validate nested objects that are AST nodes
      else if (value && typeof value === "object" && value.type) {
        validateNode(value, errors);
      }
    }
  }
}

/**
 * Validate an AST
 *
 * @param {object} ast - AST to validate
 * @returns {Array} - Validation errors
 */
function validate(ast) {
  const errors = [];
  validateNode(ast, errors);
  return errors;
}

// Export for browser environment
if (typeof window !== "undefined") {
  window.CompilerModule = window.CompilerModule || {};
  window.CompilerModule.validate = validate;
}

// Export for Node.js environment
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    validate,
  };
}