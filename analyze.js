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
 * Scope class - represents a lexical environment
 *
 * A scope is essentially a symbol table that maps variable names to their
 * declaration nodes in the AST. Scopes can be nested (e.g., a function scope
 * inside the global scope), forming a tree structure that mirrors the lexical
 * structure of the code.
 */
class Scope {
  /**
   * Create a new scope
   * @param {Scope|null} parent - Parent scope, or null for the global scope
   */
  constructor(parent = null) {
    this.parent = parent; // Reference to the parent scope
    this.declarations = new Map(); // Map of variable names to declaration nodes
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
   * @param {string} name - Variable name
   * @param {object} node - AST node where the variable is declared
   * @returns {boolean} - Whether the declaration was successful
   */
  declare(name, node) {
    // Check for duplicate declaration in the CURRENT scope only
    if (this.declarations.has(name)) {
      return false; // Duplicate declaration error
    }

    // Add the declaration to the current scope
    this.declarations.set(name, node);
    return true;
  }

  /**
   * Check if a variable is declared in this scope or any parent scope
   *
   * This implements lexical scoping rules, where a variable is visible
   * in its own scope and all inner scopes, unless shadowed.
   *
   * @param {string} name - Variable name to look up
   * @returns {boolean} - Whether the variable is declared
   */
  isDeclared(name) {
    // Check the current scope first
    if (this.declarations.has(name)) {
      return true;
    }

    // If not found, recursively check parent scopes
    if (this.parent) {
      return this.parent.isDeclared(name);
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
   * @param {string} name - Variable name to look up
   * @returns {object|null} - The declaration node or null if not found
   */
  getDeclaration(name) {
    // Check current scope
    if (this.declarations.has(name)) {
      return this.declarations.get(name);
    }

    // Check parent scopes recursively
    if (this.parent) {
      return this.parent.getDeclaration(name);
    }

    // Not found anywhere
    return null;
  }
}

/**
 * Analyzer class - performs static name resolution on an AST
 *
 * This class visits each node in the AST and:
 * 1. Creates a scope hierarchy that matches the lexical structure of the code
 * 2. Records all variable declarations in the appropriate scope
 * 3. Verifies that all variable references can be resolved
 * 4. Reports any naming errors (undeclared variables, duplicate declarations)
 */
class Analyzer {
  constructor() {
    this.errors = []; // List of errors found during analysis
    this.currentScope = null; // Current lexical scope being analyzed
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
   * @returns {object} - The same AST, now with scope information
   */
  analyze(ast) {
    // Create the global scope (top-level scope)
    this.currentScope = new Scope();

    // Start traversing the AST from the root
    this.visitNode(ast);

    // Return the annotated AST and any errors found
    return {
      ast,
      errors: this.errors,
    };
  }

  /**
   * Report an error found during analysis
   *
   * This records details about an error including where it occurred
   * in the source code to help users find and fix it.
   *
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

    // Add the error to our list
    this.errors.push({
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
   * @returns {Scope} - The previously active scope (for restoring later)
   */
  enterScope() {
    const previousScope = this.currentScope;
    // Create a new scope with the current scope as parent
    this.currentScope = new Scope(previousScope);
    return previousScope;
  }

  /**
   * Restore the previous scope when leaving a lexical environment
   *
   * This is called when exiting a scope, to restore the parent scope.
   *
   * @param {Scope} scope - The scope to restore
   */
  exitScope(scope) {
    this.currentScope = scope;
  }

  /**
   * Visit an AST node and its children
   *
   * This is the main traversal method that routes each node to its
   * appropriate visitor method based on the node type.
   *
   * @param {object} node - AST node to visit
   */
  visitNode(node) {
    // Skip null/undefined nodes and non-objects
    if (!node || typeof node !== "object") {
      return;
    }

    // Dispatch to appropriate visitor method based on node type
    switch (node.type) {
      // Program is the root of the AST
      case "Program":
        this.visitProgram(node);
        break;

      // Variable declarations
      case "ConstDeclaration":
        this.visitConstDeclaration(node);
        break;

      // Functions
      case "ArrowFunctionExpression":
        this.visitArrowFunction(node);
        break;

      // Variable references
      case "Identifier":
        this.visitIdentifier(node);
        break;

      // Statements
      case "ReturnStatement":
        this.visitReturnStatement(node);
        break;

      // Expressions
      case "BinaryExpression":
        this.visitBinaryExpression(node);
        break;

      case "ConditionalExpression":
        this.visitConditionalExpression(node);
        break;

      case "CallExpression":
        this.visitCallExpression(node);
        break;

      // Literals don't need name resolution
      case "StringLiteral":
      case "NumericLiteral":
      case "BooleanLiteral":
        break;

      default:
        // For unknown node types, traverse children generically
        this.visitChildren(node);
    }
  }

  /**
   * Visit all children of a node
   *
   * This is a generic traversal method used when we don't have a
   * specific visitor method for a node type.
   *
   * @param {object} node - Node whose children should be visited
   */
  visitChildren(node) {
    if (!node || typeof node !== "object") {
      return;
    }

    // Iterate through all properties of the node
    for (const key in node) {
      if (node.hasOwnProperty(key) && key !== "type") {
        const child = node[key];

        // Handle arrays (e.g., body of a block)
        if (Array.isArray(child)) {
          child.forEach((item) => this.visitNode(item));
        }
        // Handle nested objects (other AST nodes)
        else if (child && typeof child === "object") {
          this.visitNode(child);
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
   * @param {object} node - Program node to visit
   */
  visitProgram(node) {
    // Visit each statement in the program body
    node.body.forEach((statement) => this.visitNode(statement));
  }

  /**
   * Visit a function call expression
   *
   * For a call expression, we need to:
   * 1. Ensure the callee (the function) is in scope
   * 2. Check each argument expression
   *
   * @param {object} node - CallExpression node to visit
   */
  visitCallExpression(node) {
    // Visit the function being called
    this.visitNode(node.callee);

    // Visit each argument passed to the function
    node.arguments.forEach((arg) => this.visitNode(arg));
  }

  /**
   * Visit a const declaration
   *
   * When we see a const declaration, we need to:
   * 1. Add the variable to the current scope
   * 2. Check for duplicate declarations in the same scope
   * 3. Process the initializer expression
   *
   * @param {object} node - ConstDeclaration node to visit
   */
  visitConstDeclaration(node) {
    // Get the variable name
    const name = node.id.name;

    // Try to declare it in the current scope
    if (!this.currentScope.declare(name, node)) {
      // If declaration fails, report a duplicate declaration error
      this.reportError(`Duplicate declaration of '${name}'`, node);
    }

    // Process the initializer expression
    this.visitNode(node.init);
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
   * @param {object} node - ArrowFunctionExpression node to visit
   */
  visitArrowFunction(node) {
    // Create a new scope for the function body
    const previousScope = this.enterScope();

    // Add each parameter to the function scope
    node.params.forEach((param) => {
      const name = param.name;
      // Check for duplicate parameter names
      if (!this.currentScope.declare(name, param)) {
        this.reportError(`Duplicate parameter name '${name}'`, param);
      }
    });

    // Process the function body
    if (Array.isArray(node.body)) {
      // Block body with statements: () => { statements }
      node.body.forEach((statement) => this.visitNode(statement));
    } else {
      // Expression body: () => expression
      this.visitNode(node.body);
    }

    // Restore the previous scope when leaving the function
    this.exitScope(previousScope);
  }

  /**
   * Visit an identifier (variable reference)
   *
   * When we see an identifier used as a value, we need to:
   * 1. Check if it refers to a declared variable
   * 2. Report an error if the variable is not in scope
   *
   * @param {object} node - Identifier node to visit
   */
  visitIdentifier(node) {
    // Skip built-in literals (true, false)
    if (node.name === "true" || node.name === "false") {
      return;
    }

    const name = node.name;

    // Check if the variable is declared in any accessible scope
    if (!this.currentScope.isDeclared(name)) {
      // If not, report an undeclared variable error
      this.reportError(`Reference to undeclared variable '${name}'`, node);
    }
  }

  /**
   * Visit a return statement
   *
   * For a return statement, we just need to analyze its argument (if any).
   *
   * @param {object} node - ReturnStatement node to visit
   */
  visitReturnStatement(node) {
    // Process the return value if it exists
    if (node.argument) {
      this.visitNode(node.argument);
    }
  }

  /**
   * Visit a binary expression (e.g., a + b)
   *
   * For a binary expression, we need to analyze both sides.
   *
   * @param {object} node - BinaryExpression node to visit
   */
  visitBinaryExpression(node) {
    // Visit both operands
    this.visitNode(node.left);
    this.visitNode(node.right);
  }

  /**
   * Visit a conditional (ternary) expression (condition ? then : else)
   *
   * We need to analyze all three parts: the condition and both branches.
   *
   * @param {object} node - ConditionalExpression node to visit
   */
  visitConditionalExpression(node) {
    // Visit the condition expression
    this.visitNode(node.test);

    // Visit both branches
    this.visitNode(node.consequent);
    this.visitNode(node.alternate);
  }
}

/**
 * Main function to perform static name resolution on an AST
 *
 * This is the entry point for name resolution analysis, used by the
 * compilation pipeline to verify variable scoping.
 *
 * @param {object} ast - The AST to analyze
 * @returns {object} - Analysis result containing the AST and any errors
 */
function analyze(ast) {
  const analyzer = new Analyzer();
  return analyzer.analyze(ast);
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

// Export the main functions for use in the compilation pipeline
module.exports = {
  analyze, // Analyze an existing AST
  analyzeCode, // Analyze source code from scratch
};
