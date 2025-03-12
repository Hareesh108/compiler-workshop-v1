/**
 * Hindley-Milner Type Inference
 *
 * This module implements type inference based on the Hindley-Milner algorithm.
 * It also enforces that return statements can only appear as the last statement in a function.
 */

// Define the types we'll support
const Types = {
  Int: "Int",
  Float: "Float",
  Bool: "Bool",
  String: "String",
  Function: "Function",
  Unknown: "Unknown",
};

// Type variable for polymorphic types
class TypeVariable {
  constructor(name = null) {
    this.id = TypeVariable.nextId++;
    this.name = name || `t${this.id}`;
    this.instance = null;
  }

  static nextId = 0;

  // Get the actual type, following type variable references
  prune() {
    if (this.instance) {
      this.instance = this.instance.prune();
      return this.instance;
    }
    return this;
  }

  // Check if this type variable occurs within another type
  occursIn(type) {
    type = type.prune();

    if (type === this) {
      return true;
    }

    if (type instanceof FunctionType) {
      return this.occursIn(type.paramType) || this.occursIn(type.returnType);
    }

    return false;
  }

  toString() {
    if (this.instance) {
      return this.instance.toString();
    }
    return this.name;
  }
}

// Function type (param -> return)
class FunctionType {
  constructor(paramType, returnType) {
    this.paramType = paramType;
    this.returnType = returnType;
  }

  prune() {
    return new FunctionType(this.paramType.prune(), this.returnType.prune());
  }

  toString() {
    const paramStr =
      this.paramType instanceof FunctionType
        ? `(${this.paramType.toString()})`
        : this.paramType.toString();

    return `${paramStr} -> ${this.returnType.toString()}`;
  }
}

// Concrete types (Int, Bool, etc.)
class ConcreteType {
  constructor(type) {
    this.type = type;
  }

  prune() {
    return this;
  }

  toString() {
    return this.type;
  }
}

/**
 * Type inference engine that implements Hindley-Milner algorithm
 */
class TypeInferer {
  constructor() {
    this.errors = [];
    this.reset();
  }

  reset() {
    this.currentScope = {};
    this.nonGeneric = new Set();
  }

  /**
   * Report a type error
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
   * Enter a new scope
   */
  enterScope() {
    const outerScope = this.currentScope;
    this.currentScope = Object.create(outerScope);
    return outerScope;
  }

  /**
   * Exit the current scope and restore the previous one
   */
  exitScope(scope) {
    this.currentScope = scope;
  }

  /**
   * Create a fresh type variable
   */
  freshTypeVariable(name = null) {
    return new TypeVariable(name);
  }

  /**
   * Create a fresh instance of a type
   */
  freshInstance(type) {
    const mappings = new Map();

    function freshenType(type) {
      type = type.prune();

      if (type instanceof TypeVariable) {
        if (!mappings.has(type)) {
          mappings.set(type, new TypeVariable());
        }
        return mappings.get(type);
      } else if (type instanceof FunctionType) {
        return new FunctionType(
          freshenType(type.paramType),
          freshenType(type.returnType),
        );
      } else {
        return type;
      }
    }

    return freshenType(type);
  }

  /**
   * Get the type of a variable from the current environment
   */
  getType(name) {
    const type = this.currentScope[name];
    if (!type) {
      const typeVar = this.freshTypeVariable();
      this.currentScope[name] = typeVar;
      return typeVar;
    }

    // If the type is in the non-generic set, return it as is
    if (this.nonGeneric.has(type)) {
      return type;
    }

    // Otherwise, create a fresh instance
    return this.freshInstance(type);
  }

  /**
   * Unify two types, making them equal
   */
  unify(t1, t2, node) {
    t1 = t1.prune();
    t2 = t2.prune();

    if (t1 instanceof TypeVariable) {
      if (t1 !== t2) {
        if (t1.occursIn(t2)) {
          this.reportError(
            `Recursive unification: cannot unify ${t1} with ${t2}`,
            node,
          );
          return;
        }
        t1.instance = t2;
      }
    } else if (t1 instanceof FunctionType && t2 instanceof FunctionType) {
      this.unify(t1.paramType, t2.paramType, node);
      this.unify(t1.returnType, t2.returnType, node);
    } else if (t1 instanceof ConcreteType && t2 instanceof ConcreteType) {
      if (t1.type !== t2.type) {
        this.reportError(
          `Type mismatch: ${t1} is not compatible with ${t2}`,
          node,
        );
      }
    } else if (t2 instanceof TypeVariable) {
      this.unify(t2, t1, node);
    } else {
      this.reportError(`Cannot unify ${t1} with ${t2}`, node);
    }
  }

  /**
   * Analyze an AST node and infer its type
   */
  inferType(node) {
    if (!node || typeof node !== "object") {
      return this.freshTypeVariable();
    }

    switch (node.type) {
      case "Program":
        return this.inferTypeProgram(node);

      case "NumericLiteral":
        return this.inferTypeNumericLiteral(node);

      case "StringLiteral":
        return this.inferTypeStringLiteral(node);

      case "BooleanLiteral":
        return this.inferTypeBooleanLiteral(node);

      case "Identifier":
        return this.inferTypeIdentifier(node);

      case "BinaryExpression":
        return this.inferTypeBinaryExpression(node);

      case "ConditionalExpression":
        return this.inferTypeConditionalExpression(node);

      case "ArrowFunctionExpression":
        return this.inferTypeArrowFunction(node);

      case "CallExpression":
        return this.inferTypeCallExpression(node);

      case "ConstDeclaration":
        return this.inferTypeConstDeclaration(node);

      case "ReturnStatement":
        return this.inferTypeReturnStatement(node);

      default:
        this.reportError(`Unknown node type: ${node.type}`, node);
        return this.freshTypeVariable();
    }
  }

  /**
   * Infer type for a function call expression
   */
  inferTypeCallExpression(node) {
    // Infer the type of the function being called
    const fnType = this.inferType(node.callee);

    // Check if it's a function
    if (!(fnType instanceof FunctionType)) {
      // If it's not yet resolved to a function, create a fresh function type
      if (fnType instanceof TypeVariable) {
        // Create a return type variable
        const returnType = this.freshTypeVariable();

        if (node.arguments.length === 0) {
          // For zero arguments, create a Unit -> returnType function
          const funcType = new FunctionType(
            new ConcreteType(Types.Unit),
            returnType,
          );
          this.unify(fnType, funcType, node);
          return returnType;
        } else {
          // For each argument, infer its type and create the function type
          const argTypes = node.arguments.map((arg) => this.inferType(arg));

          // Unify the function with a function expecting these argument types
          const funcType = argTypes.reduceRight((acc, argType) => {
            return new FunctionType(argType, acc);
          }, returnType);

          this.unify(fnType, funcType, node);
          return returnType;
        }
      } else {
        this.reportError("Called value is not a function", node);
        return this.freshTypeVariable();
      }
    }

    // Handle multi-parameter functions (curried form)
    let currentFnType = fnType;
    let resultType = this.freshTypeVariable();

    // Check each argument against the expected parameter type
    for (let i = 0; i < node.arguments.length; i++) {
      const arg = node.arguments[i];
      const argType = this.inferType(arg);

      if (!(currentFnType instanceof FunctionType)) {
        this.reportError(`Too many arguments provided to function`, node);
        return this.freshTypeVariable();
      }

      this.unify(currentFnType.paramType, argType, arg);
      resultType = currentFnType.returnType;
      currentFnType = resultType;
    }

    return resultType;
  }

  /**
   * Infer types for a program
   */
  inferTypeProgram(node) {
    let resultType = new ConcreteType(Types.Unknown);

    for (const statement of node.body) {
      resultType = this.inferType(statement);

      // Add type annotations to the AST
      statement.inferredType = resultType;
    }

    return resultType;
  }

  /**
   * Infer type for a numeric literal
   */
  inferTypeNumericLiteral(node) {
    // Check if the value has a decimal point
    if (Number.isInteger(node.value)) {
      return new ConcreteType(Types.Int);
    } else {
      return new ConcreteType(Types.Float);
    }
  }

  /**
   * Infer type for a string literal
   */
  inferTypeStringLiteral(node) {
    return new ConcreteType(Types.String);
  }

  /**
   * Infer type for a boolean literal
   */
  inferTypeBooleanLiteral(node) {
    return new ConcreteType(Types.Bool);
  }

  /**
   * Infer type for an identifier
   */
  inferTypeIdentifier(node) {
    return this.getType(node.name);
  }

  /**
   * Infer type for a binary expression
   */
  inferTypeBinaryExpression(node) {
    const leftType = this.inferType(node.left);
    const rightType = this.inferType(node.right);

    switch (node.operator) {
      case "+": {
        // For +, require numeric operands (Int or Float)
        const numericType = this.freshTypeVariable();
        this.unify(leftType, numericType, node.left);
        this.unify(rightType, numericType, node.right);

        // Try to unify with Int or Float
        try {
          this.unify(numericType, new ConcreteType(Types.Int), node);
          return new ConcreteType(Types.Int);
        } catch (e) {
          try {
            this.unify(numericType, new ConcreteType(Types.Float), node);
            return new ConcreteType(Types.Float);
          } catch (e) {
            this.reportError(
              `The '+' operator requires numeric operands`,
              node,
            );
            return this.freshTypeVariable();
          }
        }
      }
      default:
        this.reportError(`Unsupported binary operator: ${node.operator}`, node);
        return this.freshTypeVariable();
    }
  }

  /**
   * Infer type for a conditional (ternary) expression
   */
  inferTypeConditionalExpression(node) {
    const testType = this.inferType(node.test);
    this.unify(testType, new ConcreteType(Types.Bool), node.test);

    const consequentType = this.inferType(node.consequent);
    const alternateType = this.inferType(node.alternate);

    // Result type must unify with both branches
    const resultType = this.freshTypeVariable();
    this.unify(consequentType, resultType, node.consequent);
    this.unify(alternateType, resultType, node.alternate);

    return resultType;
  }

  /**
   * Check if a return statement is in a valid position (last statement)
   */
  checkReturnPosition(node, body) {
    if (!body || !Array.isArray(body)) {
      return true; // Nothing to check
    }

    const returnIndex = body.findIndex(
      (stmt) => stmt.type === "ReturnStatement",
    );
    if (returnIndex === -1) {
      return true; // No return statement
    }

    // Check if it's the last statement
    if (returnIndex !== body.length - 1) {
      this.reportError(
        `Return statement must be the last statement in a function`,
        body[returnIndex],
      );
      return false;
    }

    return true;
  }

  /**
   * Infer type for an arrow function
   */
  inferTypeArrowFunction(node) {
    const outerScope = this.enterScope();
    const outerNonGeneric = this.nonGeneric;
    this.nonGeneric = new Set(outerNonGeneric);

    // Validate return statement position
    if (Array.isArray(node.body)) {
      this.checkReturnPosition(node, node.body);
    }

    // Create fresh type variables for parameters
    const paramTypes = [];
    for (const param of node.params) {
      const paramType = this.freshTypeVariable();
      this.currentScope[param.name] = paramType;
      this.nonGeneric.add(paramType);
      paramTypes.push(paramType);
    }

    // Infer the return type
    let returnType;
    if (Array.isArray(node.body)) {
      // For block bodies, the return type is the type of the return statement,
      // or Unit if there is no return statement
      const returnStatement = node.body.find(
        (stmt) => stmt.type === "ReturnStatement",
      );

      if (returnStatement) {
        returnType = returnStatement.argument
          ? this.inferType(returnStatement.argument)
          : new ConcreteType(Types.Unit);

        // Process all statements for side effects and type checking
        for (const statement of node.body) {
          if (statement !== returnStatement) {
            this.inferType(statement);
          }
        }
      } else {
        // No return statement, process all statements
        for (const statement of node.body) {
          this.inferType(statement);
        }
        returnType = new ConcreteType(Types.Unit);
      }
    } else {
      // For expression bodies, the return type is the type of the expression
      returnType = this.inferType(node.body);
    }

    // Construct the function type
    let functionType;
    if (paramTypes.length === 0) {
      functionType = new FunctionType(new ConcreteType(Types.Unit), returnType);
    } else {
      // For multiple parameters, create a curried function type
      functionType = paramTypes.reduceRight((acc, paramType) => {
        return new FunctionType(paramType, acc);
      }, returnType);
    }

    this.exitScope(outerScope);
    this.nonGeneric = outerNonGeneric;

    return functionType;
  }

  /**
   * Infer type for a const declaration
   */
  inferTypeConstDeclaration(node) {
    const initType = this.inferType(node.init);
    this.currentScope[node.id.name] = initType;

    // Add type information to the AST
    node.inferredType = initType;

    return initType;
  }

  /**
   * Infer type for a return statement
   */
  inferTypeReturnStatement(node) {
    if (!node.argument) {
      return new ConcreteType(Types.Unit);
    }

    return this.inferType(node.argument);
  }

  /**
   * Analyze the AST and infer types
   */
  analyze(ast) {
    this.reset();
    this.inferType(ast);

    return {
      ast,
      errors: this.errors,
    };
  }
}

/**
 * Main function to perform type inference on an AST
 */
function infer(ast) {
  const inferer = new TypeInferer();
  return inferer.analyze(ast);
}

/**
 * Combined analysis: name resolution + type inference
 */
function typecheck(ast, nameErrors = []) {
  // First, perform type inference
  const inferer = new TypeInferer();
  const { errors: typeErrors } = inferer.analyze(ast);

  // Combine errors from name resolution and type inference
  return {
    ast,
    errors: [...nameErrors, ...typeErrors],
  };
}

module.exports = {
  infer,
  typecheck,
  Types,
};
