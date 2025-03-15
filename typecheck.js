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
  Unit: "Unit",
  Array: "Array",
};

// Counter for generating unique IDs for type variables
let nextTypeVarId = 0;

/**
 * Create a new type variable
 *
 * @param {string|null} name - Optional name for the variable
 * @returns {object} - A type variable object
 */
function createTypeVariable(name = null) {
  const id = nextTypeVarId++;
  return { kind: "TypeVariable", id, name: name || `t${id}`, instance: null };
}

/**
 * Create a new function type
 *
 * @param {object} paramType - Type of the parameter
 * @param {object} returnType - Type of the return value
 * @returns {object} - A function type object
 */
function createFunctionType(paramType, returnType) {
  return { kind: "FunctionType", paramType, returnType };
}

/**
 * Create a new array type
 *
 * @param {object} elementType - Type of the array elements
 * @returns {object} - An array type object
 */
function createArrayType(elementType) {
  return { kind: "ArrayType", elementType };
}

/**
 * Create a new concrete type
 *
 * @param {string} type - The name of the type
 * @returns {object} - A concrete type object
 */
function createConcreteType(type) {
  return { kind: "ConcreteType", type };
}

/**
 * Compress a type by following the chain of instances
 *
 * If this type variable has been unified with another type,
 * follow the chain to get the most specific type.
 *
 * @param {object} type - The type to compress
 * @returns {object} - The most specific type
 */
function compress(type) {
  if (type.kind === "TypeVariable" && type.instance) {
    // Recursively compress the instance
    type.instance = compress(type.instance);
    return type.instance;
  }

  return type;
}

/**
 * Check if a type variable appears within another type
 *
 * This is used to prevent infinite types like t0 = Array<t0>,
 * which would lead to infinite types.
 *
 * @param {object} typeVar - The type variable to check
 * @param {object} type - The type to check inside
 * @returns {boolean} - Whether this variable occurs in the given type
 */
function occursIn(typeVar, type) {
  type = compress(type);

  // Direct self-reference, e.g. `a = a`
  if (type === typeVar) {
    return true;
  }

  // Check inside function types recursively
  if (type.kind === "FunctionType") {
    return (
      occursIn(typeVar, type.paramType) || occursIn(typeVar, type.returnType)
    );
  }

  // Check inside array types recursively
  if (type.kind === "ArrayType") {
    return occursIn(typeVar, type.elementType);
  }

  return false;
}

/**
 * Return a string representation of a type.
 *
 * @param {object} type - The type to convert to string
 * @returns {string} - A readable representation of the type
 */
function typeToString(type) {
  type = compress(type);

  if (type.kind === "TypeVariable") {
    return type.name;
  } else if (type.kind === "ConcreteType") {
    return type.type;
  } else if (type.kind === "FunctionType") {
    // Parenthesize parameter type if it's a function to avoid ambiguity
    const paramStr =
      compress(type.paramType).kind === "FunctionType"
        ? `(${typeToString(type.paramType)})`
        : typeToString(type.paramType);

    return `${paramStr} -> ${typeToString(type.returnType)}`;
  } else if (type.kind === "ArrayType") {
    return `Array<${typeToString(type.elementType)}>`;
  }

  return "UnknownType";
}

/**
 * Report a type error
 *
 * This records a type error with location information to help
 * the user identify and fix the problem.
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
 * Create a fresh type variable
 *
 * This is used when we need a new type variable, for example
 * when inferring the type of a function parameter.
 *
 * @param {string|null} name - Optional name for the type variable
 * @returns {object} - A new type variable
 */
function freshTypeVariable(name = null) {
  return createTypeVariable(name);
}

/**
 * Create a fresh instance of a type
 *
 * This is used for polymorphic types, where each use of a type
 * should be independent. For example, if a function has type
 * (a -> a), each call to the function should use fresh type variables.
 *
 * @param {object} type - The type to create a fresh instance of
 * @param {Map} mappings - Map to track variables (defaults to new map)
 * @returns {object} - A fresh instance of the type
 */
function freshInstance(type, mappings = new Map()) {
  type = compress(type);

  if (type.kind === "TypeVariable") {
    // If we haven't seen this type variable before, create a fresh copy
    if (!mappings.has(type)) {
      mappings.set(type, createTypeVariable());
    }
    return mappings.get(type);
  } else if (type.kind === "FunctionType") {
    // For function types, recursively freshen parameter and return types
    return createFunctionType(
      freshInstance(type.paramType, mappings),
      freshInstance(type.returnType, mappings),
    );
  } else if (type.kind === "ArrayType") {
    // For array types, recursively freshen element type
    return createArrayType(
      freshInstance(type.elementType, mappings)
    );
  } else {
    // Concrete types don't need to be freshened
    return type;
  }
}

/**
 * Get the type of a variable from the current environment
 *
 * This looks up a variable name in the current scope and returns its type.
 * If the variable is not found, a fresh type variable is created.
 *
 * @param {object} state - Current type inference state
 * @param {string} name - The variable name to look up
 * @returns {object} - The type of the variable
 */
function getType(state, name) {
  // Look up the variable in the current scope
  const type = state.currentScope[name];

  // If not found, create a fresh type variable
  if (!type) {
    const typeVar = freshTypeVariable();
    state.currentScope[name] = typeVar;
    return typeVar;
  }

  // If the type is in the non-generic set, return it as is
  // (this prevents overgeneralization in certain contexts)
  if (state.nonGeneric.has(type)) {
    return type;
  }

  // Otherwise, create a fresh instance to ensure proper polymorphism
  return freshInstance(type);
}

/**
 * Unify two types, making them equal
 *
 * This is the heart of the Hindley-Milner algorithm. Unification
 * takes two types and tries to make them equal by:
 * 1. If one is a type variable, set it to the other type
 * 2. If both are function types, unify parameter and return types
 * 3. If both are array types, unify their element types
 * 4. If both are concrete types, check if they're the same
 *
 * @param {object} state - Current type inference state
 * @param {object} t1 - First type to unify
 * @param {object} t2 - Second type to unify
 * @param {object} node - AST node for error reporting
 */
function unify(state, t1, t2, node) {
  // First, prune both types to get their most specific form
  t1 = compress(t1);
  t2 = compress(t2);

  // Case 1: First type is a variable
  if (t1.kind === "TypeVariable") {
    // If they're not already the same variable
    if (t1 !== t2) {
      // Check for infinite types (which are not allowed)
      if (occursIn(t1, t2)) {
        reportError(
          state.errors,
          `Infinite unification: cannot unify ${typeToString(t1)} with ${typeToString(t2)}`,
          node,
        );
        return;
      }

      // Set the type variable to point to the other type
      t1.instance = t2;
    }
  }
  // Case 2: Both are function types
  else if (t1.kind === "FunctionType" && t2.kind === "FunctionType") {
    // Recursively unify parameter and return types
    unify(state, t1.paramType, t2.paramType, node);
    unify(state, t1.returnType, t2.returnType, node);
  }
  // Case 3: Both are array types
  else if (t1.kind === "ArrayType" && t2.kind === "ArrayType") {
    // Recursively unify element types
    unify(state, t1.elementType, t2.elementType, node);
  }
  // Case 4: Both are concrete types
  else if (t1.kind === "ConcreteType" && t2.kind === "ConcreteType") {
    // Check if they're the same type
    if (t1.type !== t2.type) {
      reportError(
        state.errors,
        `Type mismatch: ${typeToString(t1)} is not compatible with ${typeToString(t2)}`,
        node,
      );
    }
  }
  // Case 5: Second type is a variable (swap and try again)
  else if (t2.kind === "TypeVariable") {
    unify(state, t2, t1, node);
  }
  // Case 6: Types are incompatible
  else {
    reportError(
      state.errors,
      `Cannot unify ${typeToString(t1)} with ${typeToString(t2)}`,
      node,
    );
  }
}

/**
 * Enter a new type scope
 *
 * This is used when entering a new lexical scope like a function.
 * A new scope inherits from its parent but can define new variables
 * or shadow existing ones.
 *
 * @param {object} state - Current type inference state
 * @returns {object} - Updated state with new scope
 */
function enterScope(state) {
  const outerScope = state.currentScope;
  // Create a new scope with the current scope as prototype
  const newScope = Object.create(outerScope);

  return {
    ...state,
    currentScope: newScope,
    previousScope: outerScope,
  };
}

/**
 * Exit the current scope and restore the previous one
 *
 * @param {object} state - Current type inference state
 * @returns {object} - Updated state with restored scope
 */
function exitScope(state) {
  return {
    ...state,
    currentScope: state.previousScope,
  };
}

/**
 * Check if a return statement is in a valid position (last statement)
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Return statement node
 * @param {Array} body - Array of statements to check
 * @returns {boolean} - Whether the return is in a valid position
 */
function checkReturnPosition(state, node, body) {
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
      state.errors,
      `Return statement must be the last statement in a function`,
      body[returnIndex],
    );
    return false;
  }

  return true;
}

/**
 * Analyze an AST node and infer its type
 *
 * This is the main type inference function that dispatches to
 * specialized functions based on the node type.
 *
 * @param {object} state - Current type inference state
 * @param {object} node - AST node to analyze
 * @returns {object} - Tuple of [updated state, inferred type]
 */
function inferType(state, node) {
  // Handle null/undefined or non-object nodes
  if (!node || typeof node !== "object") {
    return [state, freshTypeVariable()];
  }

  // Dispatch based on node type
  switch (node.type) {
    // Program structure
    case "Program":
      return inferTypeProgram(state, node);

    // Literals
    case "NumericLiteral":
      return inferTypeNumericLiteral(state, node);

    case "StringLiteral":
      return inferTypeStringLiteral(state, node);

    case "BooleanLiteral":
      return inferTypeBooleanLiteral(state, node);

    case "ArrayLiteral":
      return inferTypeArrayLiteral(state, node);

    case "Identifier":
      return inferTypeIdentifier(state, node);

    case "BinaryExpression":
      return inferTypeBinaryExpression(state, node);

    case "ConditionalExpression":
      return inferTypeConditionalExpression(state, node);

    case "ArrowFunctionExpression":
      return inferTypeArrowFunction(state, node);

    case "CallExpression":
      return inferTypeCallExpression(state, node);

    case "MemberExpression":
      return inferTypeMemberExpression(state, node);

    case "ConstDeclaration":
      return inferTypeConstDeclaration(state, node);

    case "ReturnStatement":
      return inferTypeReturnStatement(state, node);

    default:
      reportError(state.errors, `Unknown node type: ${node.type}`, node);
      return [state, freshTypeVariable()];
  }
}

/**
 * Infer type for a function call expression
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Call expression node
 * @returns {object} - Tuple of [updated state, inferred type]
 */
function inferTypeCallExpression(state, node) {
  // Infer the type of the function being called
  let [currentState, fnType] = inferType(state, node.callee);

  // Handle the function call and its arguments
  if (fnType.kind !== "FunctionType") {
    // If it's not yet resolved to a function, create a fresh function type
    if (fnType.kind === "TypeVariable") {
      // Create a return type variable
      const returnType = freshTypeVariable();

      if (node.arguments.length === 0) {
        // For zero arguments, create a Unit -> returnType function
        const funcType = createFunctionType(
          createConcreteType(Types.Unit),
          returnType,
        );
        unify(currentState, fnType, funcType, node);
        return [currentState, returnType];
      } else {
        // For each argument, infer its type and create the function type
        let argTypes = [];

        for (const arg of node.arguments) {
          const [newState, argType] = inferType(currentState, arg);
          currentState = newState;
          argTypes.push(argType);
        }

        // Unify the function with a function expecting these argument types
        let funcType = returnType;
        for (let i = argTypes.length - 1; i >= 0; i--) {
          funcType = createFunctionType(argTypes[i], funcType);
        }

        unify(currentState, fnType, funcType, node);
        return [currentState, returnType];
      }
    } else {
      reportError(currentState.errors, "Called value is not a function", node);
      return [currentState, freshTypeVariable()];
    }
  }

  // Handle multi-parameter functions (curried form)
  let currentFnType = fnType;
  let resultType = freshTypeVariable();

  // Check each argument against the expected parameter type
  for (let i = 0; i < node.arguments.length; i++) {
    const arg = node.arguments[i];
    const [newState, argType] = inferType(currentState, arg);
    currentState = newState;

    if (currentFnType.kind !== "FunctionType") {
      reportError(
        currentState.errors,
        `Too many arguments provided to function`,
        node,
      );
      return [currentState, freshTypeVariable()];
    }

    unify(currentState, currentFnType.paramType, argType, arg);
    resultType = currentFnType.returnType;
    currentFnType = compress(resultType);
  }

  return [currentState, resultType];
}

/**
 * Infer types for a program
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Program node
 * @returns {object} - Tuple of [updated state, inferred type]
 */
function inferTypeProgram(state, node) {
  let currentState = state;
  let resultType = createConcreteType(Types.Unknown);

  for (const statement of node.body) {
    const [newState, statementType] = inferType(currentState, statement);
    currentState = newState;
    resultType = statementType;

    // Add type annotations to the AST
    statement.inferredType = statementType;
  }

  return [currentState, resultType];
}

/**
 * Infer type for a numeric literal
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Numeric literal node
 * @returns {object} - Tuple of [state, inferred type]
 */
function inferTypeNumericLiteral(state, node) {
  // Check if the value has a decimal point
  if (Number.isInteger(node.value)) {
    return [state, createConcreteType(Types.Int)];
  } else {
    return [state, createConcreteType(Types.Float)];
  }
}

/**
 * Infer type for a string literal
 *
 * @param {object} state - Current type inference state
 * @param {object} node - String literal node
 * @returns {object} - Tuple of [state, inferred type]
 */
function inferTypeStringLiteral(state, node) {
  return [state, createConcreteType(Types.String)];
}

/**
 * Infer type for a boolean literal
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Boolean literal node
 * @returns {object} - Tuple of [state, inferred type]
 */
function inferTypeBooleanLiteral(state, node) {
  return [state, createConcreteType(Types.Bool)];
}

/**
 * Infer type for an identifier
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Identifier node
 * @returns {object} - Tuple of [state, inferred type]
 */
function inferTypeIdentifier(state, node) {
  return [state, getType(state, node.name)];
}

/**
 * Infer type for a binary expression
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Binary expression node
 * @returns {object} - Tuple of [updated state, inferred type]
 */
function inferTypeBinaryExpression(state, node) {
  let [leftState, leftType] = inferType(state, node.left);
  let [rightState, rightType] = inferType(leftState, node.right);
  let currentState = rightState;

  switch (node.operator) {
    case "+": {
      // Check if both operands are strings for concatenation
      const leftIsString = compress(leftType).kind === "ConcreteType" &&
                          compress(leftType).type === Types.String;
      const rightIsString = compress(rightType).kind === "ConcreteType" &&
                           compress(rightType).type === Types.String;

      if (leftIsString || rightIsString) {
        // String concatenation - both operands must be strings
        unify(currentState, leftType, createConcreteType(Types.String), node.left);
        unify(currentState, rightType, createConcreteType(Types.String), node.right);
        return [currentState, createConcreteType(Types.String)];
      } else {
        // Numeric addition
        const numericType = freshTypeVariable();
        unify(currentState, leftType, numericType, node.left);
        unify(currentState, rightType, numericType, node.right);

        // Try to unify with Int or Float
        try {
          unify(currentState, numericType, createConcreteType(Types.Int), node);
          return [currentState, createConcreteType(Types.Int)];
        } catch (e) {
          try {
            unify(
              currentState,
              numericType,
              createConcreteType(Types.Float),
              node,
            );
            return [currentState, createConcreteType(Types.Float)];
          } catch (e) {
            reportError(
              currentState.errors,
              `The '+' operator requires either numeric operands or string operands`,
              node,
            );
            return [currentState, freshTypeVariable()];
          }
        }
      }
    }
    default:
      reportError(
        currentState.errors,
        `Unsupported binary operator: ${node.operator}`,
        node,
      );
      return [currentState, freshTypeVariable()];
  }
}

/**
 * Infer type for a conditional (ternary) expression
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Conditional expression node
 * @returns {object} - Tuple of [updated state, inferred type]
 */
function inferTypeConditionalExpression(state, node) {
  // condition ? thenBranch : elseBranch

  let [conditionState, conditionType] = inferType(state, node.test);
  unify(conditionState, conditionType, createConcreteType(Types.Bool), node.test);

  let [consState, thenBranchType] = inferType(conditionState, node.thenBranch);
  let [altState, elseBranchType] = inferType(consState, node.elseBranch);

  const answer = freshTypeVariable();
  unify(altState, thenBranchType, answer, node.thenBranch);
  unify(altState, elseBranchType, answer, node.elseBranch);

  return [altState, answer];
}

/**
 * Infer type for an arrow function
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Arrow function node
 * @returns {object} - Tuple of [updated state, inferred type]
 */
function inferTypeArrowFunction(state, node) {
  let currentState = enterScope(state);
  const outerNonGeneric = currentState.nonGeneric;
  currentState = {
    ...currentState,
    nonGeneric: new Set(outerNonGeneric),
  };

  // Validate return statement position
  if (Array.isArray(node.body)) {
    checkReturnPosition(currentState, node, node.body);
  }

  // Create types for parameters, using annotations if available
  const paramTypes = [];
  for (const param of node.params) {
    let paramType;

    // If parameter has a type annotation, use it
    if (param.typeAnnotation) {
      paramType = createTypeFromAnnotation(currentState, param.typeAnnotation);
    } else {
      // Otherwise use a fresh type variable
      paramType = freshTypeVariable();
    }

    currentState.currentScope[param.name] = paramType;
    currentState.nonGeneric.add(paramType);
    paramTypes.push(paramType);
  }

  // Infer the return type
  let returnType;
  let inferredReturnType;

  if (Array.isArray(node.body)) {
    // For block bodies, the return type is the type of the return statement,
    // or Unit if there is no return statement
    const returnStatement = node.body.find(
      (stmt) => stmt.type === "ReturnStatement",
    );

    if (returnStatement) {
      if (returnStatement.argument) {
        let [newState, argType] = inferType(
          currentState,
          returnStatement.argument,
        );
        currentState = newState;
        inferredReturnType = argType;
      } else {
        inferredReturnType = createConcreteType(Types.Unit);
      }

      // Process all statements for side effects and type checking
      for (const statement of node.body) {
        if (statement !== returnStatement) {
          let [newState] = inferType(currentState, statement);
          currentState = newState;
        }
      }
    } else {
      // No return statement, process all statements
      for (const statement of node.body) {
        let [newState] = inferType(currentState, statement);
        currentState = newState;
      }
      inferredReturnType = createConcreteType(Types.Unit);
    }
  } else {
    // For expression bodies, the return type is the type of the expression
    let [newState, bodyType] = inferType(currentState, node.body);
    currentState = newState;
    inferredReturnType = bodyType;
  }

  // If there's a return type annotation, use it and unify with inferred type
  if (node.returnTypeAnnotation) {
    returnType = createTypeFromAnnotation(currentState, node.returnTypeAnnotation);
    unify(currentState, inferredReturnType, returnType, node);
  } else {
    // No annotation, use the inferred type
    returnType = inferredReturnType;
  }

  // Construct the function type
  let functionType;
  if (paramTypes.length === 0) {
    functionType = createFunctionType(
      createConcreteType(Types.Unit),
      returnType,
    );
  } else {
    // For multiple parameters, create a curried function type
    functionType = paramTypes.reduceRight(
      (acc, paramType) => createFunctionType(paramType, acc),
      returnType,
    );
  }

  currentState = exitScope(currentState);
  currentState = {
    ...currentState,
    nonGeneric: outerNonGeneric,
  };

  return [currentState, functionType];
}

/**
 * Infer type for an array literal
 *
 * For array literals, we:
 * 1. Infer the type of each element
 * 2. Unify all element types to ensure homogeneity
 * 3. Create an array type with the unified element type
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Array literal node
 * @returns {object} - Tuple of [updated state, inferred type]
 */
function inferTypeArrayLiteral(state, node) {
  let currentState = state;

  // Handle empty array case
  if (node.elements.length === 0) {
    // For empty arrays, we create a parametric array type
    const elemType = freshTypeVariable();
    return [currentState, createArrayType(elemType)];
  }

  // Get the type of the first element
  let [newState, elementType] = inferType(currentState, node.elements[0]);
  currentState = newState;

  // Unify all remaining elements with the first one to ensure homogeneity
  for (let i = 1; i < node.elements.length; i++) {
    const [nextState, nextElemType] = inferType(currentState, node.elements[i]);
    currentState = nextState;

    // Ensure all elements have the same type
    unify(currentState, elementType, nextElemType, node.elements[i]);
  }

  // Create array type with the element type
  return [currentState, createArrayType(elementType)];
}

/**
 * Infer type for a member expression (array indexing)
 *
 * For array indexing like arr[index], we:
 * 1. Ensure the object is an array type
 * 2. Ensure the index is a numeric type (Int)
 * 3. Return the element type of the array
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Member expression node
 * @returns {object} - Tuple of [updated state, inferred type]
 */
function inferTypeMemberExpression(state, node) {
  // Get the type of the object being indexed
  let [objState, objectType] = inferType(state, node.object);

  // Get the type of the index
  let [idxState, indexType] = inferType(objState, node.index);
  let currentState = idxState;

  // The index should be an Int
  unify(currentState, indexType, createConcreteType(Types.Int), node.index);

  // If object is not already an array type, create a type variable for the element type
  // and unify the object with an array of that element type
  const elementType = freshTypeVariable();
  const arrayType = createArrayType(elementType);

  // Unify the object type with the array type
  unify(currentState, objectType, arrayType, node.object);

  // The result type is the element type of the array
  return [currentState, elementType];
}

/**
 * Convert a type annotation to an internal type representation
 *
 * @param {object} state - Current type inference state
 * @param {object} annotation - Type annotation node
 * @returns {object} - Internal type representation
 */
function createTypeFromAnnotation(state, annotation) {
  if (!annotation) {
    return freshTypeVariable();
  }

  switch (annotation.type) {
    case "TypeAnnotation": {
      // Convert string type names to our internal type system
      switch (annotation.valueType) {
        case "number":
        case "Float":
        case "Int":
          // Treat all numeric types the same for simplicity
          return createConcreteType(Types.Int);

        case "string":
          return createConcreteType(Types.String);

        case "boolean":
        case "Bool":
          return createConcreteType(Types.Bool);

        case "void":
        case "Unit":
          return createConcreteType(Types.Unit);

        case "any":
          // For 'any', use a fresh type variable
          return freshTypeVariable();

        default:
          // For custom/unknown types, use a type variable
          return freshTypeVariable();
      }
    }

    case "ArrayTypeAnnotation": {
      // For Array<T> or T[], create an array type with the element type
      const elementType = createTypeFromAnnotation(state, annotation.elementType);
      return createArrayType(elementType);
    }

    case "FunctionTypeAnnotation": {
      // Build function type from return type and parameter types
      let functionType = createTypeFromAnnotation(state, annotation.returnType);

      // Build the function type from right to left (curried style)
      for (let i = annotation.paramTypes.length - 1; i >= 0; i--) {
        const paramType = createTypeFromAnnotation(state, annotation.paramTypes[i].typeAnnotation);
        functionType = createFunctionType(paramType, functionType);
      }

      return functionType;
    }

    default:
      return freshTypeVariable();
  }
}

/**
 * Infer type for a const declaration
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Const declaration node
 * @returns {object} - Tuple of [updated state, inferred type]
 */
function inferTypeConstDeclaration(state, node) {
  // Infer type from the initializer
  let [currentState, initType] = inferType(state, node.init);

  // If there's a type annotation, create a concrete type from it
  if (node.typeAnnotation) {
    const annotatedType = createTypeFromAnnotation(currentState, node.typeAnnotation);

    // Unify the inferred type with the annotated type
    unify(currentState, initType, annotatedType, node);

    // Use the annotated type
    currentState.currentScope[node.id.name] = annotatedType;

    // Add type information to the AST
    node.inferredType = annotatedType;

    return [currentState, annotatedType];
  }

  // No annotation, use the inferred type
  currentState.currentScope[node.id.name] = initType;

  // Add type information to the AST
  node.inferredType = initType;

  return [currentState, initType];
}

/**
 * Infer type for a return statement
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Return statement node
 * @returns {object} - Tuple of [updated state, inferred type]
 */
function inferTypeReturnStatement(state, node) {
  if (!node.argument) {
    return [state, createConcreteType(Types.Unit)];
  }

  return inferType(state, node.argument);
}

/**
 * Analyze the AST and infer types
 *
 * @param {object} ast - AST to analyze
 * @returns {object} - Result with AST and errors
 */
function infer(ast) {
  // Initialize the typing environment
  const initialState = {
    errors: [],
    currentScope: {},
    previousScope: null,
    nonGeneric: new Set(),
  };

  const [finalState] = inferType(initialState, ast);

  return {
    ast,
    errors: finalState.errors,
  };
}

/**
 * Combined analysis: name resolution + type inference
 *
 * @param {object} ast - AST to analyze
 * @param {Array} nameErrors - Errors from name resolution
 * @returns {object} - Result with AST and all errors
 */
function typecheck(ast, nameErrors = []) {
  // Perform type inference
  const { errors: typeErrors } = infer(ast);

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
  typeToString,
  createArrayType,
};
