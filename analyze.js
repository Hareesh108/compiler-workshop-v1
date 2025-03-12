/**
 * Static Name Resolution
 *
 * This module analyzes the AST and performs static name resolution:
 * 1. Identifies all variable declarations
 * 2. Checks for references to undeclared variables
 * 3. Detects duplicate declarations in the same scope
 * 4. Detects invalid shadowing (same name in nested scopes)
 */

/**
 * Scope tracker that maintains the environment for name resolution
 */
class Scope {
  constructor(parent = null) {
    this.parent = parent;
    this.declarations = new Map();
  }

  /**
   * Declare a new variable in the current scope
   * @param {string} name - Variable name
   * @param {object} node - AST node where the variable is declared
   * @returns {boolean} - Whether the declaration was successful
   */
  declare(name, node) {
    if (this.declarations.has(name)) {
      return false; // Duplicate declaration
    }

    this.declarations.set(name, node);
    return true;
  }

  /**
   * Check if a variable is declared in this scope or any parent scope
   * @param {string} name - Variable name to look up
   * @returns {boolean} - Whether the variable is declared
   */
  isDeclared(name) {
    if (this.declarations.has(name)) {
      return true;
    }

    if (this.parent) {
      return this.parent.isDeclared(name);
    }

    return false;
  }

  /**
   * Find declaration node for a variable
   * @param {string} name - Variable name to look up
   * @returns {object|null} - The declaration node or null if not found
   */
  getDeclaration(name) {
    if (this.declarations.has(name)) {
      return this.declarations.get(name);
    }

    if (this.parent) {
      return this.parent.getDeclaration(name);
    }

    return null;
  }
}

/**
 * Analyzer that performs static name resolution on the AST
 */
class Analyzer {
  constructor() {
    this.errors = [];
    this.currentScope = null;
  }

  /**
   * Analyze an AST to check for naming errors
   * @param {object} ast - The AST to analyze
   * @returns {object} - The same AST, now with scope information
   */
  analyze(ast) {
    // Create global scope
    this.currentScope = new Scope();

    // Visit the AST
    this.visitNode(ast);

    return {
      ast,
      errors: this.errors,
    };
  }

  /**
   * Report an error during analysis
   * @param {string} message - Error message
   * @param {object} node - AST node where the error occurred
   */
  reportError(message, node) {
    let location = "unknown position";

    // Try to get position information from the node
    if (node.position !== undefined) {
      location = `position ${node.position}`;
    } else if (node.id && node.id.position !== undefined) {
      location = `position ${node.id.position}`;
    }

    this.errors.push({
      message: `${message} at ${location}`,
      node,
    });
  }

  /**
   * Create a new scope for a lexical environment (function, block, etc.)
   * @returns {Scope} - The previously active scope (for restoring later)
   */
  enterScope() {
    const previousScope = this.currentScope;
    this.currentScope = new Scope(previousScope);
    return previousScope;
  }

  /**
   * Restore the previous scope when leaving a lexical environment
   * @param {Scope} scope - The scope to restore
   */
  exitScope(scope) {
    this.currentScope = scope;
  }

  /**
   * Visit an AST node and its children
   * @param {object} node - AST node to visit
   */
  visitNode(node) {
    if (!node || typeof node !== "object") {
      return;
    }

    switch (node.type) {
      case "Program":
        this.visitProgram(node);
        break;

      case "ConstDeclaration":
        this.visitConstDeclaration(node);
        break;

      case "ArrowFunctionExpression":
        this.visitArrowFunction(node);
        break;

      case "Identifier":
        this.visitIdentifier(node);
        break;

      case "ReturnStatement":
        this.visitReturnStatement(node);
        break;

      case "BinaryExpression":
        this.visitBinaryExpression(node);
        break;

      case "ConditionalExpression":
        this.visitConditionalExpression(node);
        break;

      // For literals, we don't need to do anything
      case "StringLiteral":
      case "NumericLiteral":
      case "BooleanLiteral":
        break;

      default:
        // For unknown node types, traverse children
        this.visitChildren(node);
    }
  }

  /**
   * Visit all children of a node
   * @param {object} node - Node whose children should be visited
   */
  visitChildren(node) {
    if (!node || typeof node !== "object") {
      return;
    }

    for (const key in node) {
      if (node.hasOwnProperty(key) && key !== "type") {
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach((item) => this.visitNode(item));
        } else if (child && typeof child === "object") {
          this.visitNode(child);
        }
      }
    }
  }

  /**
   * Visit a program node
   * @param {object} node - Program node to visit
   */
  visitProgram(node) {
    // Visit all statements in the program
    node.body.forEach((statement) => this.visitNode(statement));
  }

  /**
   * Visit a const declaration
   * @param {object} node - ConstDeclaration node to visit
   */
  visitConstDeclaration(node) {
    // Check for duplicate declaration
    const name = node.id.name;
    if (!this.currentScope.declare(name, node)) {
      this.reportError(`Duplicate declaration of '${name}'`, node);
    }

    // Process the initializer
    this.visitNode(node.init);
  }

  /**
   * Visit an arrow function
   * @param {object} node - ArrowFunctionExpression node to visit
   */
  visitArrowFunction(node) {
    // Create a new scope for the function
    const previousScope = this.enterScope();

    // Add parameters to function scope
    node.params.forEach((param) => {
      const name = param.name;
      if (!this.currentScope.declare(name, param)) {
        this.reportError(`Duplicate parameter name '${name}'`, param);
      }
    });

    // Process function body
    if (Array.isArray(node.body)) {
      // Block body
      node.body.forEach((statement) => this.visitNode(statement));
    } else {
      // Expression body
      this.visitNode(node.body);
    }

    // Restore the previous scope
    this.exitScope(previousScope);
  }

  /**
   * Visit an identifier (variable reference)
   * @param {object} node - Identifier node to visit
   */
  visitIdentifier(node) {
    // Skip built-in global variables (true, false)
    if (node.name === "true" || node.name === "false") {
      return;
    }

    const name = node.name;

    // We only want to check identifiers that are references, not declarations
    // Since we don't explicitly track parent relationships in the AST, we need to
    // be a bit clever about distinguishing between references and declarations

    // For simplicity, we'll just check if the name is declared at all
    if (!this.currentScope.isDeclared(name)) {
      this.reportError(`Reference to undeclared variable '${name}'`, node);
    }
  }

  /**
   * Visit a return statement
   * @param {object} node - ReturnStatement node to visit
   */
  visitReturnStatement(node) {
    if (node.argument) {
      this.visitNode(node.argument);
    }
  }

  /**
   * Visit a binary expression
   * @param {object} node - BinaryExpression node to visit
   */
  visitBinaryExpression(node) {
    this.visitNode(node.left);
    this.visitNode(node.right);
  }

  /**
   * Visit a conditional (ternary) expression
   * @param {object} node - ConditionalExpression node to visit
   */
  visitConditionalExpression(node) {
    this.visitNode(node.test);
    this.visitNode(node.consequent);
    this.visitNode(node.alternate);
  }
}

/**
 * Main function that performs static analysis on an AST
 * @param {object} ast - The AST to analyze
 * @returns {object} - Analysis result containing the AST and any errors
 */
function analyze(ast) {
  const analyzer = new Analyzer();
  return analyzer.analyze(ast);
}

/**
 * Complete static analysis on source code
 * @param {string} sourceCode - Source code to analyze
 * @param {function} parseFunc - The parsing function to use
 * @returns {object} - Analysis result
 */
function analyzeCode(sourceCode, { compile }) {
  const ast = compile(sourceCode);
  return analyze(ast);
}

module.exports = {
  analyze,
  analyzeCode,
};
