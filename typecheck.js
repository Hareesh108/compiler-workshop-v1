/**
 * Hindley-Milner Type Inference Module
 *
 * This module implements type inference based on the Hindley-Milner algorithm,
 * which is the foundation of type systems in many functional languages.
 *
 * Features:
 * - Automatic type inference without explicit type annotations
 * - Polymorphic type support (functions that work on multiple types)
 * - Type checking for operations and expressions
 * - Detailed type error reporting
 *
 * It also enforces that return statements can only appear as the last statement in a function.
 *
 * How it works:
 * 1. Each expression is assigned a type variable initially
 * 2. As we analyze the code, we gather constraints about what these type variables must be
 * 3. We use unification to solve these constraints, determining concrete types
 * 4. If constraints are inconsistent, we report type errors
 *
 * The algorithm is named after Roger Hindley and Robin Milner, who independently
 * developed similar type systems in the late 1960s and early 1970s.
 */

/**
 * Types supported by our type system
 *
 * Our language has the following basic types:
 * - Int: Integer numbers (e.g., 1, 2, 3)
 * - Float: Floating-point numbers (e.g., 1.5, 2.0)
 * - Bool: Boolean values (true, false)
 * - String: Text strings (e.g., "hello")
 * - Function: Functions from one type to another
 * - Unknown: Used during inference when type is not yet determined
 */
const Types = {
  Int: "Int",
  Float: "Float",
  Bool: "Bool",
  String: "String",
  Function: "Function",
  Unknown: "Unknown",
};

/**
 * TypeVariable class - represents a type that isn't yet known
 *
 * Type variables are the foundation of Hindley-Milner type inference.
 * They act as placeholders for types that will be determined through unification.
 *
 * For example, the function:
 *    const identity = (x) => x;
 *
 * Would initially be assigned a type like:
 *    t0 -> t0
 *
 * where t0 is a type variable. This indicates the function takes any type
 * and returns the same type.
 */
class TypeVariable {
  constructor(name = null) {
    this.id = TypeVariable.nextId++; // Unique identifier for this variable
    this.name = name || `t${this.id}`; // Human-readable name
    this.instance = null; // What this variable resolves to, if known
  }

  static nextId = 0; // Counter for generating unique IDs

  /**
   * Prune a type variable by following the chain of instances
   *
   * If this type variable has been unified with another type,
   * follow the chain to get the most specific type.
   *
   * @returns {TypeVariable|ConcreteType} - The most specific type this variable refers to
   */
  prune() {
    if (this.instance) {
      // Recursively prune the instance
      this.instance = this.instance.prune();
      return this.instance;
    }
    // If not instantiated, return this variable
    return this;
  }

  /**
   * Check if this type variable appears within another type
   *
   * This is used to prevent recursive types like t0 = Array<t0>,
   * which would lead to infinite types.
   *
   * @param {object} type - The type to check
   * @returns {boolean} - Whether this variable occurs in the given type
   */
  occursIn(type) {
    type = type.prune();

    // Direct self-reference
    if (type === this) {
      return true;
    }

    // Check inside function types recursively
    if (type instanceof FunctionType) {
      return this.occursIn(type.paramType) || this.occursIn(type.returnType);
    }

    // Not found
    return false;
  }

  /**
   * String representation of this type variable
   *
   * If this variable has been resolved to another type,
   * use that type's representation.
   *
   * @returns {string} - A readable representation of this type
   */
  toString() {
    if (this.instance) {
      return this.instance.toString();
    }
    return this.name;
  }
}

/**
 * FunctionType class - represents function types (parameter -> return)
 *
 * Functions are represented as their parameter type and return type.
 * For multi-parameter functions, we use currying:
 *    (a, b) => c  becomes  a -> b -> c
 *
 * This representation simplifies the type inference algorithm while
 * still supporting all the functionality we need.
 */
class FunctionType {
  /**
   * Create a function type
   * @param {object} paramType - Type of the parameter
   * @param {object} returnType - Type of the return value
   */
  constructor(paramType, returnType) {
    this.paramType = paramType; // Type of the parameter
    this.returnType = returnType; // Type of the return value
  }

  /**
   * Prune this function type by pruning its parameter and return types
   * @returns {FunctionType} - A new function type with pruned components
   */
  prune() {
    return new FunctionType(this.paramType.prune(), this.returnType.prune());
  }

  /**
   * String representation of this function type
   *
   * Uses the standard arrow notation: param -> return
   * Function parameters are parenthesized for clarity: (a -> b) -> c
   *
   * @returns {string} - A readable representation of this function type
   */
  toString() {
    // Parenthesize parameter type if it's a function to avoid ambiguity
    const paramStr =
      this.paramType instanceof FunctionType
        ? `(${this.paramType.toString()})`
        : this.paramType.toString();

    return `${paramStr} -> ${this.returnType.toString()}`;
  }
}

/**
 * ConcreteType class - represents known, specific types (Int, Bool, etc.)
 *
 * Unlike type variables, concrete types are fully determined and don't
 * need to be unified with other types to be resolved.
 */
class ConcreteType {
  /**
   * Create a concrete type
   * @param {string} type - The name of the type
   */
  constructor(type) {
    this.type = type; // Type name (e.g., "Int", "Bool")
  }

  /**
   * Prune this concrete type
   *
   * For concrete types, pruning is a no-op since they're already
   * fully determined.
   *
   * @returns {ConcreteType} - This concrete type
   */
  prune() {
    return this;
  }

  /**
   * String representation of this concrete type
   * @returns {string} - The type name
   */
  toString() {
    return this.type;
  }
}

/**
 * TypeInferer class - implements the Hindley-Milner type inference algorithm
 *
 * This class analyzes an AST to infer the types of all expressions and
 * ensures type consistency throughout the program.
 *
 * The Hindley-Milner algorithm works by:
 * 1. Assigning type variables to expressions
 * 2. Gathering constraints through the program structure
 * 3. Solving these constraints through unification
 * 4. Producing a fully typed AST or reporting type errors
 */
class TypeInferer {
  constructor() {
    this.errors = []; // List of type errors found
    this.reset(); // Initialize typing environment
  }

  /**
   * Reset the typing environment
   *
   * This clears all type variables and scopes, allowing
   * the inferer to be reused for multiple programs.
   */
  reset() {
    // Environment mapping variable names to their types
    this.currentScope = {};

    // Set of type variables that shouldn't be generalized
    // (used to prevent overgeneralization in let-polymorphism)
    this.nonGeneric = new Set();
  }

  /**
   * Report a type error
   *
   * This records a type error with location information to help
   * the user identify and fix the problem.
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
   * Enter a new type scope
   *
   * This is used when entering a new lexical scope like a function.
   * A new scope inherits from its parent but can define new variables
   * or shadow existing ones.
   *
   * @returns {object} - The previous scope (for restoring later)
   */
  enterScope() {
    const outerScope = this.currentScope;
    // Create a new scope with the current scope as prototype
    this.currentScope = Object.create(outerScope);
    return outerScope;
  }

  /**
   * Exit the current scope and restore the previous one
   *
   * @param {object} scope - The scope to restore
   */
  exitScope(scope) {
    this.currentScope = scope;
  }

  /**
   * Create a fresh type variable
   *
   * This is used when we need a new type variable, for example
   * when inferring the type of a function parameter.
   *
   * @param {string|null} name - Optional name for the type variable
   * @returns {TypeVariable} - A new type variable
   */
  freshTypeVariable(name = null) {
    return new TypeVariable(name);
  }

  /**
   * Create a fresh instance of a type
   *
   * This is used for polymorphic types, where each use of a type
   * should be independent. For example, if a function has type
   * 'a -> 'a, each call to the function should use fresh type variables.
   *
   * @param {object} type - The type to create a fresh instance of
   * @returns {object} - A fresh instance of the type
   */
  freshInstance(type) {
    // Map of original type variables to their fresh copies
    const mappings = new Map();

    // Recursive function to create fresh instances
    function freshenType(type) {
      type = type.prune();

      if (type instanceof TypeVariable) {
        // If we haven't seen this type variable before, create a fresh copy
        if (!mappings.has(type)) {
          mappings.set(type, new TypeVariable());
        }
        return mappings.get(type);
      } else if (type instanceof FunctionType) {
        // For function types, recursively freshen parameter and return types
        return new FunctionType(
          freshenType(type.paramType),
          freshenType(type.returnType),
        );
      } else {
        // Concrete types don't need to be freshened
        return type;
      }
    }

    return freshenType(type);
  }

  /**
   * Get the type of a variable from the current environment
   *
   * This looks up a variable name in the current scope and returns its type.
   * If the variable is not found, a fresh type variable is created.
   *
   * @param {string} name - The variable name to look up
   * @returns {object} - The type of the variable
   */
  getType(name) {
    // Look up the variable in the current scope
    const type = this.currentScope[name];

    // If not found, create a fresh type variable
    if (!type) {
      const typeVar = this.freshTypeVariable();
      this.currentScope[name] = typeVar;
      return typeVar;
    }

    // If the type is in the non-generic set, return it as is
    // (this prevents overgeneralization in certain contexts)
    if (this.nonGeneric.has(type)) {
      return type;
    }

    // Otherwise, create a fresh instance to ensure proper polymorphism
    return this.freshInstance(type);
  }

  /**
   * Unify two types, making them equal
   *
   * This is the heart of the Hindley-Milner algorithm. Unification
   * takes two types and tries to make them equal by:
   * 1. If one is a type variable, set it to the other type
   * 2. If both are function types, unify parameter and return types
   * 3. If both are concrete types, check if they're the same
   *
   * @param {object} t1 - First type to unify
   * @param {object} t2 - Second type to unify
   * @param {object} node - AST node for error reporting
   */
  unify(t1, t2, node) {
    // First, prune both types to get their most specific form
    t1 = t1.prune();
    t2 = t2.prune();

    // Case 1: First type is a variable
    if (t1 instanceof TypeVariable) {
      // If they're not already the same variable
      if (t1 !== t2) {
        // Check for recursive types (not allowed)
        if (t1.occursIn(t2)) {
          this.reportError(
            `Recursive unification: cannot unify ${t1} with ${t2}`,
            node,
          );
          return;
        }

        // Set the type variable to point to the other type
        t1.instance = t2;
      }
    }
    // Case 2: Both are function types
    else if (t1 instanceof FunctionType && t2 instanceof FunctionType) {
      // Recursively unify parameter and return types
      this.unify(t1.paramType, t2.paramType, node);
      this.unify(t1.returnType, t2.returnType, node);
    }
    // Case 3: Both are concrete types
    else if (t1 instanceof ConcreteType && t2 instanceof ConcreteType) {
      // Check if they're the same type
      if (t1.type !== t2.type) {
        this.reportError(
          `Type mismatch: ${t1} is not compatible with ${t2}`,
          node,
        );
      }
    }
    // Case 4: Second type is a variable (swap and try again)
    else if (t2 instanceof TypeVariable) {
      this.unify(t2, t1, node);
    }
    // Case 5: Types are incompatible
    else {
      this.reportError(`Cannot unify ${t1} with ${t2}`, node);
    }
  }

  /**
   * Analyze an AST node and infer its type
   *
   * This is the main type inference function that dispatches to
   * specialized functions based on the node type.
   *
   * @param {object} node - AST node to analyze
   * @returns {object} - The inferred type of the node
   */
  inferType(node) {
    // Handle null/undefined or non-object nodes
    if (!node || typeof node !== "object") {
      return this.freshTypeVariable();
    }

    // Dispatch based on node type
    switch (node.type) {
      // Program structure
      case "Program":
        return this.inferTypeProgram(node);

      // Literals
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
