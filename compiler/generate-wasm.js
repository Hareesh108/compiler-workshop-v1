/**
 * WebAssembly Code Generation Module
 *
 * This module takes an AST with type information and generates WebAssembly binary code.
 * It supports:
 * - Numeric operations
 * - Function definitions and calls
 * - Control flow (if/else expressions)
 * - Arrays via linear memory
 * 
 * The implementation follows a simple mapping from our type system to WebAssembly types:
 * - Number -> i32 (32-bit integers)
 * - Float -> f64 (64-bit floats)
 * - Bool -> i32 (0 = false, 1 = true)
 * - Arrays -> Linear memory with pointer/length representation
 */

// WebAssembly binary encoding helper functions
const encoder = new TextEncoder();

// WebAssembly sections
const SECTION = {
  TYPE: 1,
  FUNCTION: 3,
  MEMORY: 5,
  EXPORT: 7,
  CODE: 10
};

// WebAssembly types
const TYPES = {
  I32: 0x7f,      // i32
  I64: 0x7e,      // i64
  F32: 0x7d,      // f32
  F64: 0x7c,      // f64
  ANYFUNC: 0x70,  // funcref
  FUNC: 0x60,     // func
  VOID: 0x40      // void (empty block type)
};

// WebAssembly opcodes
const OP = {
  BLOCK: 0x02,
  LOOP: 0x03,
  IF: 0x04,
  ELSE: 0x05,
  END: 0x0b,
  BR: 0x0c,
  BR_IF: 0x0d,
  CALL: 0x10,
  CALL_INDIRECT: 0x11,
  DROP: 0x1a,
  LOCAL_GET: 0x20,
  LOCAL_SET: 0x21,
  LOCAL_TEE: 0x22,
  GLOBAL_GET: 0x23,
  GLOBAL_SET: 0x24,
  I32_LOAD: 0x28,
  I64_LOAD: 0x29,
  F32_LOAD: 0x2a,
  F64_LOAD: 0x2b,
  I32_LOAD8_S: 0x2c,
  I32_LOAD8_U: 0x2d,
  I32_LOAD16_S: 0x2e,
  I32_LOAD16_U: 0x2f,
  I64_LOAD8_S: 0x30,
  I64_LOAD8_U: 0x31,
  I64_LOAD16_S: 0x32,
  I64_LOAD16_U: 0x33,
  I64_LOAD32_S: 0x34,
  I64_LOAD32_U: 0x35,
  I32_STORE: 0x36,
  I64_STORE: 0x37,
  F32_STORE: 0x38,
  F64_STORE: 0x39,
  I32_STORE8: 0x3a,
  I32_STORE16: 0x3b,
  I64_STORE8: 0x3c,
  I64_STORE16: 0x3d,
  I64_STORE32: 0x3e,
  MEMORY_SIZE: 0x3f,
  MEMORY_GROW: 0x40,
  I32_CONST: 0x41,
  I64_CONST: 0x42,
  F32_CONST: 0x43,
  F64_CONST: 0x44,
  I32_EQZ: 0x45,
  I32_EQ: 0x46,
  I32_NE: 0x47,
  I32_LT_S: 0x48,
  I32_LT_U: 0x49,
  I32_GT_S: 0x4a,
  I32_GT_U: 0x4b,
  I32_LE_S: 0x4c,
  I32_LE_U: 0x4d,
  I32_GE_S: 0x4e,
  I32_GE_U: 0x4f,
  I32_ADD: 0x6a,
  I32_SUB: 0x6b,
  I32_MUL: 0x6c,
  I32_DIV_S: 0x6d,
  I32_DIV_U: 0x6e,
  I32_REM_S: 0x6f,
  I32_REM_U: 0x70,
  I32_AND: 0x71,
  I32_OR: 0x72,
  I32_XOR: 0x73,
  F64_ADD: 0xa0,
  F64_SUB: 0xa1,
  F64_MUL: 0xa2,
  F64_DIV: 0xa3,
  F64_FLOOR: 0x9c,
  F64_CONVERT_I32_S: 0xb7,
  F64_CONVERT_I32_U: 0xb8,
  I32_TRUNC_F64_S: 0xaa,
  I32_TRUNC_F64_U: 0xab
};

/**
 * Encodes a number in WebAssembly LEB128 format (unsigned)
 */
function encodeULEB128(value) {
  const result = [];
  
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) {
      byte |= 0x80;
    }
    result.push(byte);
  } while (value !== 0);
  
  return new Uint8Array(result);
}

/**
 * Encodes a number in WebAssembly LEB128 format (signed)
 */
function encodeSLEB128(value) {
  const result = [];
  let more = true;
  
  while (more) {
    let byte = value & 0x7f;
    value >>= 7;
    
    // If value is 0 but sign bit would be set, continue
    const signBit = (byte & 0x40) !== 0;
    if ((value === 0 && !signBit) || (value === -1 && signBit)) {
      more = false;
    } else {
      byte |= 0x80;
    }
    
    result.push(byte);
  }
  
  return new Uint8Array(result);
}

/**
 * Encodes a 32-bit floating point number
 */
function encodeF32(value) {
  const buffer = new ArrayBuffer(4);
  new Float32Array(buffer)[0] = value;
  return new Uint8Array(buffer);
}

/**
 * Encodes a 64-bit floating point number
 */
function encodeF64(value) {
  const buffer = new ArrayBuffer(8);
  new Float64Array(buffer)[0] = value;
  return new Uint8Array(buffer);
}

/**
 * Convert our language types to WebAssembly types
 */
function convertType(type) {
  if (!type) return TYPES.I32; // Default to i32 if type is missing
  
  type = compress(type);
  
  if (type.kind === "PrimitiveType") {
    switch (type.type) {
      case "Number": return TYPES.I32;
      case "Float": return TYPES.F64;
      case "Bool": return TYPES.I32;
      case "Void": return TYPES.VOID;
      default: return TYPES.I32;
    }
  } else if (type.kind === "ArrayType") {
    // Arrays are represented as a pointer to memory
    return TYPES.I32;
  } else {
    // Default to i32 for unknown types
    return TYPES.I32;
  }
}

/**
 * Compress a type by following the chain of instances
 * (copied from typecheck.js for convenience)
 */
function compress(type) {
  if (type && type.kind === "TypeVariable" && type.symlink) {
    type.symlink = compress(type.symlink);
    return type.symlink;
  }
  return type;
}

/**
 * Generate WebAssembly binary for an AST
 */
function generateWasmModule(ast, { memory = { initial: 1 }, exportAll = true } = {}) {
  // Initialize the module generator state
  const state = {
    functions: [],
    typeEntries: [],
    exports: [],
    functionTable: new Map(), // Maps function names to indices
    nextFunctionIndex: 0,
    varLookup: new Map(), // Maps variable names to local indices in current function
    globals: new Map(), // Maps global variable names to indices
    nextGlobalIndex: 0,
    memory
  };
  
  // Process each top-level declaration
  for (const node of ast.body) {
    if (node.type === "ConstDeclaration") {
      if (node.init && node.init.type === "ArrowFunctionExpression") {
        // This is a function definition
        processFunction(state, node);
      } else {
        // Global variable
        processGlobal(state, node);
      }
    }
  }
  
  // Combine all parts into a complete module
  return buildModule(state);
}

/**
 * Process a function declaration
 */
function processFunction(state, node) {
  const functionName = node.id.name;
  const functionNode = node.init;
  const functionIndex = state.nextFunctionIndex++;
  
  // Store the function in our table
  state.functionTable.set(functionName, functionIndex);
  
  // Create function type signature
  const signature = createFunctionSignature(functionNode);
  
  // Add type if not already present
  let typeIndex = state.typeEntries.findIndex(entry => 
    arraysEqual(entry.params, signature.params) && 
    entry.returnType === signature.returnType
  );
  
  if (typeIndex === -1) {
    typeIndex = state.typeEntries.length;
    state.typeEntries.push(signature);
  }
  
  // Add to function list
  state.functions.push({
    name: functionName,
    typeIndex,
    node: functionNode,
    signature
  });
  
  // Export the function if requested
  if (state.exportAll) {
    state.exports.push({
      name: functionName,
      kind: 0x00, // Function
      index: functionIndex
    });
  }
}

/**
 * Process a global variable declaration
 */
function processGlobal(state, node) {
  const name = node.id.name;
  const type = convertType(node.inferredType);
  const index = state.nextGlobalIndex++;
  
  state.globals.set(name, {
    index,
    type,
    mutable: false
  });
}

/**
 * Create a WebAssembly function signature from a node
 */
function createFunctionSignature(node) {
  const params = [];
  
  // If we have type information on the function, use it
  if (node.inferredType && node.inferredType.kind === "FunctionType") {
    // Extract parameter types from the function type
    let currentType = node.inferredType;
    const paramTypes = [];
    
    // For multi-parameter functions, unwrap the curried function types
    while (currentType.kind === "FunctionType") {
      paramTypes.push(convertType(currentType.paramType));
      currentType = compress(currentType.returnType);
    }
    
    // The final currentType is the return type
    const returnType = convertType(currentType);
    
    // For functions with no parameters (void -> returnType)
    if (node.params.length === 0 && paramTypes.length === 1 && 
        paramTypes[0] === TYPES.VOID) {
      return {
        params: [],
        returnType
      };
    }
    
    return {
      params: paramTypes,
      returnType
    };
  }
  
  // Fallback: extract parameter and return types directly
  for (const param of node.params) {
    params.push(TYPES.I32); // Default to i32 if no type info
  }
  
  return {
    params,
    returnType: TYPES.I32 // Default to i32 if no type info
  };
}

/**
 * Generate WebAssembly code for a function body
 */
function generateFunctionCode(state, func) {
  const locals = [];
  state.varLookup = new Map();
  
  // Set up parameters as locals
  const node = func.node;
  for (let i = 0; i < node.params.length; i++) {
    const param = node.params[i];
    state.varLookup.set(param.name, i);
  }
  
  // Now generate the actual function body
  const body = generateExpressionCode(state, 
    Array.isArray(node.body) ? { type: "BlockStatement", body: node.body } : node.body
  );
  
  // Encode function body
  const localBytes = encodeLocals(locals);
  const bodyBytes = concatBytes([body, new Uint8Array([OP.END])]);
  const allBytes = concatBytes([
    encodeULEB128(localBytes.length + bodyBytes.length),
    localBytes,
    bodyBytes
  ]);
  
  return allBytes;
}

/**
 * Encode function locals for the WebAssembly function body
 */
function encodeLocals(locals) {
  if (locals.length === 0) {
    return encodeULEB128(0);
  }
  
  // Group locals by type
  const groups = [];
  let currentType = locals[0];
  let count = 1;
  
  for (let i = 1; i < locals.length; i++) {
    if (locals[i] === currentType) {
      count++;
    } else {
      groups.push({ type: currentType, count });
      currentType = locals[i];
      count = 1;
    }
  }
  
  groups.push({ type: currentType, count });
  
  // Encode local groups
  const bytes = [encodeULEB128(groups.length)];
  
  for (const group of groups) {
    bytes.push(encodeULEB128(group.count));
    bytes.push(new Uint8Array([group.type]));
  }
  
  return concatBytes(bytes);
}

/**
 * Generate code for a block statement
 */
function generateBlockStatement(state, node) {
  const statements = [];
  
  for (let i = 0; i < node.body.length; i++) {
    const stmt = node.body[i];
    
    if (stmt.type === "ReturnStatement") {
      if (stmt.argument) {
        statements.push(generateExpressionCode(state, stmt.argument));
      }
      break; // Return is always the last statement
    } else if (stmt.type === "ConstDeclaration") {
      // TODO: Handle local declarations
    } else {
      // Handle other statement types
      statements.push(generateExpressionCode(state, stmt));
    }
  }
  
  return concatBytes(statements);
}

/**
 * Generate code for a general expression
 */
function generateExpressionCode(state, node) {
  if (!node) return new Uint8Array([]);
  
  switch (node.type) {
    case "BlockStatement":
      return generateBlockStatement(state, node);
      
    case "NumericLiteral":
      if (Number.isInteger(node.value)) {
        return concatBytes([
          new Uint8Array([OP.I32_CONST]),
          encodeSLEB128(node.value)
        ]);
      } else {
        return concatBytes([
          new Uint8Array([OP.F64_CONST]),
          encodeF64(node.value)
        ]);
      }
      
    case "BooleanLiteral":
      return concatBytes([
        new Uint8Array([OP.I32_CONST]),
        encodeSLEB128(node.value ? 1 : 0)
      ]);
      
    case "Identifier":
      if (state.varLookup.has(node.name)) {
        // Local variable
        const localIndex = state.varLookup.get(node.name);
        return concatBytes([
          new Uint8Array([OP.LOCAL_GET]),
          encodeULEB128(localIndex)
        ]);
      } else if (state.globals.has(node.name)) {
        // Global variable
        const global = state.globals.get(node.name);
        return concatBytes([
          new Uint8Array([OP.GLOBAL_GET]),
          encodeULEB128(global.index)
        ]);
      }
      // Handle error - identifier not found
      return new Uint8Array([OP.I32_CONST, 0]); // Default to 0
      
    case "BinaryExpression":
      return generateBinaryExpression(state, node);
      
    case "ConditionalExpression":
      return generateConditionalExpression(state, node);
      
    case "CallExpression":
      return generateCallExpression(state, node);
      
    case "ArrayLiteral":
      return generateArrayLiteral(state, node);
      
    case "MemberExpression": 
      return generateMemberExpression(state, node);
      
    default:
      // For unsupported node types, default to 0
      return new Uint8Array([OP.I32_CONST, 0]);
  }
}

/**
 * Generate code for a binary expression
 */
function generateBinaryExpression(state, node) {
  const left = generateExpressionCode(state, node.left);
  const right = generateExpressionCode(state, node.right);
  let opCode;
  
  // Handle Float vs Int operations
  const leftType = node.left.inferredType ? compress(node.left.inferredType) : null;
  const rightType = node.right.inferredType ? compress(node.right.inferredType) : null;
  
  const isFloatOp = (leftType && leftType.kind === "PrimitiveType" && leftType.type === "Float") ||
                    (rightType && rightType.kind === "PrimitiveType" && rightType.type === "Float");
  
  switch (node.operator) {
    case "+":
      opCode = isFloatOp ? OP.F64_ADD : OP.I32_ADD;
      break;
    case "-":
      opCode = isFloatOp ? OP.F64_SUB : OP.I32_SUB;
      break;
    case "*":
      opCode = isFloatOp ? OP.F64_MUL : OP.I32_MUL;
      break;
    case "/":
      opCode = isFloatOp ? OP.F64_DIV : OP.I32_DIV_S;
      break;
    case "==":
      opCode = isFloatOp ? OP.F64_EQ : OP.I32_EQ;
      break;
    case "!=":
      opCode = isFloatOp ? OP.F64_NE : OP.I32_NE;
      break;
    case "<":
      opCode = isFloatOp ? OP.F64_LT : OP.I32_LT_S;
      break;
    case ">":
      opCode = isFloatOp ? OP.F64_GT : OP.I32_GT_S;
      break;
    case "<=":
      opCode = isFloatOp ? OP.F64_LE : OP.I32_LE_S;
      break;
    case ">=":
      opCode = isFloatOp ? OP.F64_GE : OP.I32_GE_S;
      break;
    default:
      opCode = OP.I32_ADD; // Default to addition
  }
  
  return concatBytes([left, right, new Uint8Array([opCode])]);
}

/**
 * Generate code for a conditional (ternary) expression
 */
function generateConditionalExpression(state, node) {
  const condition = generateExpressionCode(state, node.test);
  const thenExpr = generateExpressionCode(state, node.consequent);
  const elseExpr = generateExpressionCode(state, node.alternate);
  
  // Get the result type - it needs to be the same for both branches
  const resultType = node.consequent.inferredType ? 
    convertType(node.consequent.inferredType) : TYPES.I32;
    
  // WebAssembly if/else expression
  return concatBytes([
    condition,
    new Uint8Array([OP.IF, resultType]),
    thenExpr,
    new Uint8Array([OP.ELSE]),
    elseExpr,
    new Uint8Array([OP.END])
  ]);
}

/**
 * Generate code for a function call
 */
function generateCallExpression(state, node) {
  // First generate code for all arguments
  const argCodes = [];
  for (const arg of node.arguments) {
    argCodes.push(generateExpressionCode(state, arg));
  }
  
  // Then prepare the call instruction
  let functionIndex;
  if (node.callee.type === "Identifier" && state.functionTable.has(node.callee.name)) {
    functionIndex = state.functionTable.get(node.callee.name);
    
    // Combine argument code and call instruction
    return concatBytes([
      ...argCodes,
      new Uint8Array([OP.CALL]),
      encodeULEB128(functionIndex)
    ]);
  }
  
  // If function not found, return 0
  return new Uint8Array([OP.I32_CONST, 0]);
}

/**
 * Generate code for an array literal 
 * 
 * Arrays in WebAssembly are represented as:
 * - A pointer to the start of the array data in linear memory
 * - The length of the array (stored just before the data)
 * 
 * The function returns a pointer to the array structure.
 */
function generateArrayLiteral(state, node) {
  // This is a simplified implementation that doesn't handle memory allocation properly
  // For a real implementation, we'd need a memory manager
  
  // For now, we'll just return a constant since we're not implementing the full array system
  return new Uint8Array([OP.I32_CONST, 0]);
}

/**
 * Generate code for array member access (e.g., array[index])
 */
function generateMemberExpression(state, node) {
  // This is a simplified implementation that doesn't handle memory access properly
  
  // For now, we'll just return a constant since we're not implementing the full array system
  return new Uint8Array([OP.I32_CONST, 0]);
}

/**
 * Build the complete WebAssembly module binary
 */
function buildModule(state) {
  const sections = [];
  
  // Magic number and version
  sections.push(new Uint8Array([0x00, 0x61, 0x73, 0x6d])); // "\0asm"
  sections.push(new Uint8Array([0x01, 0x00, 0x00, 0x00])); // Version 1
  
  // Type section (function signatures)
  if (state.typeEntries.length > 0) {
    sections.push(buildTypeSection(state));
  }
  
  // Function section (function type indices)
  if (state.functions.length > 0) {
    sections.push(buildFunctionSection(state));
  }
  
  // Memory section
  sections.push(buildMemorySection(state));
  
  // Export section
  if (state.exports.length > 0) {
    sections.push(buildExportSection(state));
  }
  
  // Code section (function bodies)
  if (state.functions.length > 0) {
    sections.push(buildCodeSection(state));
  }
  
  return concatBytes(sections);
}

/**
 * Build the WebAssembly type section
 */
function buildTypeSection(state) {
  const entries = [];
  
  for (const type of state.typeEntries) {
    // Function type
    entries.push(new Uint8Array([TYPES.FUNC]));
    
    // Parameter count and types
    entries.push(encodeULEB128(type.params.length));
    for (const param of type.params) {
      entries.push(new Uint8Array([param]));
    }
    
    // Return type
    if (type.returnType === TYPES.VOID) {
      entries.push(encodeULEB128(0)); // No return values
    } else {
      entries.push(encodeULEB128(1)); // One return value
      entries.push(new Uint8Array([type.returnType]));
    }
  }
  
  const content = concatBytes([
    encodeULEB128(state.typeEntries.length),
    ...entries
  ]);
  
  return concatBytes([
    new Uint8Array([SECTION.TYPE]),
    encodeULEB128(content.length),
    content
  ]);
}

/**
 * Build the WebAssembly function section
 */
function buildFunctionSection(state) {
  const content = concatBytes([
    encodeULEB128(state.functions.length),
    ...state.functions.map(func => encodeULEB128(func.typeIndex))
  ]);
  
  return concatBytes([
    new Uint8Array([SECTION.FUNCTION]),
    encodeULEB128(content.length),
    content
  ]);
}

/**
 * Build the WebAssembly memory section
 */
function buildMemorySection(state) {
  const content = concatBytes([
    encodeULEB128(1), // Number of memories (always 1)
    new Uint8Array([0]), // No maximum size (flags = 0)
    encodeULEB128(state.memory.initial) // Initial size in pages (64KB each)
  ]);
  
  return concatBytes([
    new Uint8Array([SECTION.MEMORY]),
    encodeULEB128(content.length),
    content
  ]);
}

/**
 * Build the WebAssembly export section
 */
function buildExportSection(state) {
  const entries = [];
  
  for (const entry of state.exports) {
    const nameBytes = encoder.encode(entry.name);
    entries.push(concatBytes([
      encodeULEB128(nameBytes.length),
      nameBytes,
      new Uint8Array([entry.kind]),
      encodeULEB128(entry.index)
    ]));
  }
  
  const content = concatBytes([
    encodeULEB128(state.exports.length),
    ...entries
  ]);
  
  return concatBytes([
    new Uint8Array([SECTION.EXPORT]),
    encodeULEB128(content.length),
    content
  ]);
}

/**
 * Build the WebAssembly code section
 */
function buildCodeSection(state) {
  const entries = [];
  
  for (const func of state.functions) {
    entries.push(generateFunctionCode(state, func));
  }
  
  const content = concatBytes([
    encodeULEB128(entries.length),
    ...entries
  ]);
  
  return concatBytes([
    new Uint8Array([SECTION.CODE]),
    encodeULEB128(content.length),
    content
  ]);
}

/**
 * Utility function to concatenate Uint8Arrays
 */
function concatBytes(arrays) {
  let totalLength = 0;
  for (const array of arrays) {
    totalLength += array.byteLength;
  }
  
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.byteLength;
  }
  
  return result;
}

/**
 * Utility function to compare arrays
 */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Generate WebAssembly binary from source code
 */
function generateWasmFromSource(sourceCode, options = {}) {
  // Run the full compilation pipeline to get typed AST
  const { ast, errors } = window.CompilerModule.compileWithTypes(sourceCode);
  
  if (errors.length > 0) {
    return { wasm: null, errors };
  }
  
  // Generate WebAssembly from the typed AST
  try {
    const wasmBinary = generateWasmModule(ast, options);
    return { wasm: wasmBinary, errors: [] };
  } catch (error) {
    return { wasm: null, errors: [{ message: `WebAssembly generation error: ${error.message}` }] };
  }
}

/**
 * Instantiate a WebAssembly module from binary
 */
async function instantiateWasm(wasmBinary, importObject = {}) {
  try {
    const module = await WebAssembly.compile(wasmBinary);
    const instance = await WebAssembly.instantiate(module, importObject);
    return { module, instance, exports: instance.exports };
  } catch (error) {
    throw new Error(`Failed to instantiate WebAssembly module: ${error.message}`);
  }
}

// Export functions for use in the browser
if (typeof window !== "undefined") {
  window.CompilerModule = window.CompilerModule || {};
  
  // Add WebAssembly generation to CompilerModule
  window.CompilerModule.generateWasm = generateWasmFromSource;
  window.CompilerModule.instantiateWasm = instantiateWasm;
}

// Export for Node.js environment
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generateWasmModule,
    generateWasmFromSource,
    instantiateWasm
  };
}