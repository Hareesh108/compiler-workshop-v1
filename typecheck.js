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
function concreteType(type) {
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
  if (type.kind === "TypeVariable" && type.symlink) {
    // Recursively compress the symlink path
    type.symlink = compress(type.symlink);
    return type.symlink;
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
 * This is used when we need a new type variable, for example
 * when inferring the type of a function parameter.
 *
 * @param {object} state - Current type inference state
 * @param {string|null} name - Optional name for the type variable
 * @returns {object} - A new type variable
 */
function newTypeVar(state, name = null) {
  const id = state.nextTypeVarId;
  state.nextTypeVarId = state.nextTypeVarId + 1;
  return { kind: "TypeVariable", id, name: name || `t${id}`, symlink: null };
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
function freshInstance(state, type, mappings = new Map()) {
  type = compress(type);

  if (type.kind === "TypeVariable") {
    // If we haven't seen this type variable before, create a fresh copy
    if (!mappings.has(type)) {
      mappings.set(type, newTypeVar(state));
    }
    return mappings.get(type);
  } else if (type.kind === "FunctionType") {
    // For function types, recursively freshen parameter and return types
    return createFunctionType(
      freshInstance(state, type.paramType, mappings),
      freshInstance(state, type.returnType, mappings),
    );
  } else if (type.kind === "ArrayType") {
    // For array types, recursively freshen element type
    return createArrayType(
      freshInstance(state, type.elementType, mappings)
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
    const typeVar = newTypeVar(state);
    state.currentScope[name] = typeVar;
    return typeVar;
  }

  // If the type is in the non-generic set, return it as is
  // (this prevents overgeneralization in certain contexts)
  if (state.nonGeneric.has(type)) {
    return type;
  }

  // Otherwise, create a fresh instance to ensure proper polymorphism
  return freshInstance(state, type);
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
      t1.symlink = t2;
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
 */
function enterScope(state) {
  const outerScope = state.currentScope;
  // Create a new scope with the current scope as prototype
  const newScope = Object.create(outerScope);

  state.previousScope = outerScope;
  state.currentScope = newScope;
}

/**
 * Exit the current scope and restore the previous one
 *
 * @param {object} state - Current type inference state
 */
function exitScope(state) {
  state.currentScope = state.previousScope;
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
 * @returns {object} - Inferred type
 */
function infer(state, node) {
  // Handle null/undefined or non-object nodes
  if (!node || typeof node !== "object") {
    return newTypeVar(state);
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
      return inferTernary(state, node);

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
      return newTypeVar(state);
  }
}

/**
 * Infer type for a function call expression
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Call expression node
 * @returns {object} - Inferred type
 */
function inferTypeCallExpression(state, node) {
  // Infer the type of the function being called
  let fnType = infer(state, node.callee);

  // Handle the function call and its arguments
  if (fnType.kind !== "FunctionType") {
    // If it's not yet resolved to a function, create a fresh function type
    if (fnType.kind === "TypeVariable") {
      // Create a return type variable
      const returnType = newTypeVar(state);

      if (node.arguments.length === 0) {
        // For zero arguments, create a Unit -> returnType function
        const funcType = createFunctionType(
          concreteType(Types.Unit),
          returnType,
        );
        unify(state, fnType, funcType, node);
        return returnType;
      } else {
        // For each argument, infer its type and create the function type
        let argTypes = [];

        for (const arg of node.arguments) {
          const argType = infer(state, arg);
          argTypes.push(argType);
        }

        // Unify the function with a function expecting these argument types
        let funcType = returnType;
        for (let i = argTypes.length - 1; i >= 0; i--) {
          funcType = createFunctionType(argTypes[i], funcType);
        }

        unify(state, fnType, funcType, node);
        return returnType;
      }
    } else {
      reportError(state.errors, "Called value is not a function", node);
      return newTypeVar(state);
    }
  }

  // Handle multi-parameter functions (curried form)
  let currentFnType = fnType;
  let resultType = newTypeVar(state);

  // Check each argument against the expected parameter type
  for (let i = 0; i < node.arguments.length; i++) {
    const arg = node.arguments[i];
    const argType = infer(state, arg);

    if (currentFnType.kind !== "FunctionType") {
      reportError(
        state.errors,
        `Too many arguments provided to function`,
        node,
      );
      return newTypeVar(state);
    }

    unify(state, currentFnType.paramType, argType, arg);
    resultType = currentFnType.returnType;
    currentFnType = compress(resultType);
  }

  return resultType;
}

/**
 * Infer types for a program
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Program node
 * @returns {object} - Inferred type
 */
function inferTypeProgram(state, node) {
  let resultType = concreteType(Types.Unknown);

  for (const statement of node.body) {
    resultType = infer(state, statement);

    // Add type annotations to the AST
    statement.inferredType = resultType;
  }

  return resultType;
}

/**
 * Infer type for a numeric literal
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Numeric literal node
 * @returns {object} - Inferred type
 */
function inferTypeNumericLiteral(state, node) {
  // Check if the value has a decimal point
  if (Number.isInteger(node.value)) {
    return concreteType(Types.Int);
  } else {
    return concreteType(Types.Float);
  }
}

/**
 * Infer type for a string literal
 *
 * @param {object} state - Current type inference state
 * @param {object} node - String literal node
 * @returns {object} - Inferred type
 */
function inferTypeStringLiteral(state, node) {
  return concreteType(Types.String);
}

/**
 * Infer type for a boolean literal
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Boolean literal node
 * @returns {object} - Inferred type
 */
function inferTypeBooleanLiteral(state, node) {
  return concreteType(Types.Bool);
}

/**
 * Infer type for an identifier
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Identifier node
 * @returns {object} - Inferred type
 */
function inferTypeIdentifier(state, node) {
  return getType(state, node.name);
}

/**
 * Infer type for a binary expression
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Binary expression node
 * @returns {object} - Inferred type
 */
function inferTypeBinaryExpression(state, node) {
  let leftType = infer(state, node.left);
  let rightType = infer(state, node.right);

  switch (node.operator) {
    case "+": {
      // Check if both operands are strings for concatenation
      const leftIsString = compress(leftType).kind === "ConcreteType" &&
                          compress(leftType).type === Types.String;
      const rightIsString = compress(rightType).kind === "ConcreteType" &&
                           compress(rightType).type === Types.String;

      if (leftIsString || rightIsString) {
        // String concatenation - both operands must be strings
        unify(state, leftType, concreteType(Types.String), node.left);
        unify(state, rightType, concreteType(Types.String), node.right);
        return concreteType(Types.String);
      } else {
        // Numeric addition
        const numericType = newTypeVar(state);
        unify(state, leftType, numericType, node.left);
        unify(state, rightType, numericType, node.right);

        // Try to unify with Int or Float
        try {
          unify(state, numericType, concreteType(Types.Int), node);
          return concreteType(Types.Int);
        } catch (e) {
          try {
            unify(
              state,
              numericType,
              concreteType(Types.Float),
              node,
            );
            return concreteType(Types.Float);
          } catch (e) {
            reportError(
              state.errors,
              `The '+' operator requires either numeric operands or string operands`,
              node,
            );
            return newTypeVar(state);
          }
        }
      }
    }
    default:
      reportError(
        state.errors,
        `Unsupported binary operator: ${node.operator}`,
        node,
      );
      return newTypeVar(state);
  }
}

/**
 * Infer type for a conditional (ternary) expression
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Ternary node with { condition, thenBranch, elseBranch } fields
 * @returns {object} - Inferred type
 */
function inferTernary(state, node) {
  // condition ? thenBranch : elseBranch

  const conditionType = infer(state, node.condition);
  unify(state, conditionType, concreteType(Types.Bool), node.condition);

  const thenBranchType = infer(state, node.thenBranch);
  const elseBranchType = infer(state, node.elseBranch);

  const answer = newTypeVar(state);
  unify(state, thenBranchType, answer, node.thenBranch);
  unify(state, elseBranchType, answer, node.elseBranch);

  return answer;
}

/**
 * Infer type for an arrow function
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Arrow function node
 * @returns {object} - Inferred type
 */
function inferTypeArrowFunction(state, node) {
  enterScope(state);
  const outerNonGeneric = state.nonGeneric;
  state.nonGeneric = new Set(outerNonGeneric);

  // Validate return statement position
  if (Array.isArray(node.body)) {
    checkReturnPosition(state, node, node.body);
  }

  // Create types for parameters, using annotations if available
  const paramTypes = [];
  for (const param of node.params) {
    let paramType;

    // If parameter has a type annotation, use it
    if (param.typeAnnotation) {
      paramType = createTypeFromAnnotation(state, param.typeAnnotation);
    } else {
      // Otherwise use a fresh type variable
      paramType = newTypeVar(state);
    }

    state.currentScope[param.name] = paramType;
    state.nonGeneric.add(paramType);
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
        inferredReturnType = infer(state, returnStatement.argument);
      } else {
        inferredReturnType = concreteType(Types.Unit);
      }

      // Process all statements for side effects and type checking
      for (const statement of node.body) {
        if (statement !== returnStatement) {
          infer(state, statement);
        }
      }
    } else {
      // No return statement, process all statements
      for (const statement of node.body) {
        infer(state, statement);
      }
      inferredReturnType = concreteType(Types.Unit);
    }
  } else {
    // For expression bodies, the return type is the type of the expression
    inferredReturnType = infer(state, node.body);
  }

  // If there's a return type annotation, use it and unify with inferred type
  if (node.returnTypeAnnotation) {
    returnType = createTypeFromAnnotation(state, node.returnTypeAnnotation);
    unify(state, inferredReturnType, returnType, node);
  } else {
    // No annotation, use the inferred type
    returnType = inferredReturnType;
  }

  // Construct the function type
  let functionType;
  if (paramTypes.length === 0) {
    functionType = createFunctionType(
      concreteType(Types.Unit),
      returnType,
    );
  } else {
    // For multiple parameters, create a curried function type
    functionType = paramTypes.reduceRight(
      (acc, paramType) => createFunctionType(paramType, acc),
      returnType,
    );
  }

  exitScope(state);
  state.nonGeneric = outerNonGeneric;

  return functionType;
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
 * @returns {object} - Inferred type
 */
function inferTypeArrayLiteral(state, node) {
  // Handle empty array case
  if (node.elements.length === 0) {
    // For empty arrays, we create a parametric array type
    const elemType = newTypeVar(state);
    return createArrayType(elemType);
  }

  // Get the type of the first element
  let elementType = infer(state, node.elements[0]);

  // Unify all remaining elements with the first one to ensure homogeneity
  for (let i = 1; i < node.elements.length; i++) {
    const nextElemType = infer(state, node.elements[i]);

    // Ensure all elements have the same type
    unify(state, elementType, nextElemType, node.elements[i]);
  }

  // Create array type with the element type
  return createArrayType(elementType);
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
 * @returns {object} - Inferred type
 */
function inferTypeMemberExpression(state, node) {
  // Get the type of the object being indexed
  let objectType = infer(state, node.object);

  // Get the type of the index
  let indexType = infer(state, node.index);

  // The index should be an Int
  unify(state, indexType, concreteType(Types.Int), node.index);

  // If object is not already an array type, create a type variable for the element type
  // and unify the object with an array of that element type
  const elementType = newTypeVar(state);
  const arrayType = createArrayType(elementType);

  // Unify the object type with the array type
  unify(state, objectType, arrayType, node.object);

  // The result type is the element type of the array
  return elementType;
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
    return newTypeVar(state);
  }

  switch (annotation.type) {
    case "TypeAnnotation": {
      // Convert string type names to our internal type system
      switch (annotation.valueType) {
        case "number":
        case "Float":
        case "Int":
          // Treat all numeric types the same for simplicity
          return concreteType(Types.Int);

        case "string":
          return concreteType(Types.String);

        case "boolean":
        case "Bool":
          return concreteType(Types.Bool);

        case "void":
        case "Unit":
          return concreteType(Types.Unit);

        case "any":
          // For 'any', use a fresh type variable
          return newTypeVar(state);

        default:
          // For custom/unknown types, use a type variable
          return newTypeVar(state);
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
      return newTypeVar(state);
  }
}

/**
 * Infer type for a const declaration
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Const declaration node
 * @returns {object} - Inferred type
 */
function inferTypeConstDeclaration(state, node) {
  // Infer type from the initializer
  let initType = infer(state, node.init);

  // If there's a type annotation, create a concrete type from it
  if (node.typeAnnotation) {
    const annotatedType = createTypeFromAnnotation(state, node.typeAnnotation);

    // Unify the inferred type with the annotated type
    unify(state, initType, annotatedType, node);

    // Use the annotated type
    state.currentScope[node.id.name] = annotatedType;

    // Add type information to the AST
    node.inferredType = annotatedType;

    return annotatedType;
  }

  // No annotation, use the inferred type
  state.currentScope[node.id.name] = initType;

  // Add type information to the AST
  node.inferredType = initType;

  return initType;
}

/**
 * Infer type for a return statement
 *
 * @param {object} state - Current type inference state
 * @param {object} node - Return statement node
 * @returns {object} - Inferred type
 */
function inferTypeReturnStatement(state, node) {
  if (!node.argument) {
    return concreteType(Types.Unit);
  }

  return infer(state, node.argument);
}

/**
 * Analyze the AST and infer types
 *
 * @param {object} ast - AST to analyze
 * @returns {object} - Result with AST and errors
 */
function inferAst(ast) {
  // Initialize the typing environment
  const state = {
    errors: [],
    currentScope: {},
    previousScope: null,
    nonGeneric: new Set(),
    // Counter for generating unique IDs for type variables
    nextTypeVarId: 0,
  };

  infer(state, ast);

  return { ast, errors: state.errors };
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
  const { errors: typeErrors } = inferAst(ast);

  // Combine errors from name resolution and type inference
  return {
    ast,
    errors: [...nameErrors, ...typeErrors],
  };
}

module.exports = {
  infer: inferAst,
  typecheck,
  Types,
  typeToString,
  createArrayType,
};
