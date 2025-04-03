/**
 * WebAssembly Code Generation
 *
 * This module generates WebAssembly binary from the parsed and type-checked AST.
 * It supports basic types (numbers as f64, strings, booleans) and conditionals.
 * It will throw errors for unsupported features like polymorphic arrays or functions.
 */

// WebAssembly binary encoding helper functions
const encoder = new TextEncoder();

// WebAssembly sections
const SECTION = {
  TYPE: 1,
  FUNCTION: 3,
  MEMORY: 5,
  EXPORT: 7,
  CODE: 10,
  DATA: 11
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
  LOCAL_GET: 0x20,
  LOCAL_SET: 0x21,
  LOCAL_TEE: 0x22,
  I32_CONST: 0x41,
  F64_CONST: 0x44,
  F64_ADD: 0xa0,
  F64_SUB: 0xa1,
  F64_MUL: 0xa2,
  F64_DIV: 0xa3,
  F64_EQ: 0x61,
  F64_NE: 0x62,
  F64_LT: 0x63,
  F64_GT: 0x64,
  F64_LE: 0x65,
  F64_GE: 0x66,
  F64_CONVERT_I32_U: 0xb8
};

// Keep track of string literals for data section
let stringLiterals = [];
let stringTable = {};
let nextStringPtr = 0;
let functionTable = {};
let functionIndices = {};
let localVars = {};
let currentFunctionLocals = [];
let errors = [];

// Memory constants
const STRING_BUFFER_SIZE = 65536; // 64KB string buffer
const MEMORY_PAGE_SIZE = 1;       // Initial memory size (64KB pages)

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
 * Encodes a 32-bit integer
 */
function encodeI32(value) {
  const buffer = new ArrayBuffer(4);
  new Int32Array(buffer)[0] = value;
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
 * Report a code generation error
 *
 * @param {string} message - Error message
 * @param {object} node - AST node where the error occurred
 */
function reportError(message, node) {
  errors.push({ message, node });
}

/**
 * Generate WebAssembly code for an AST
 *
 * @param {Array} ast - The typed and checked abstract syntax tree
 * @returns {Object} - The generated WebAssembly module and any errors
 */
function generateWasm(ast) {
  // Reset module state
  stringLiterals = [];
  stringTable = {};
  nextStringPtr = 0;
  functionTable = {};
  functionIndices = {};
  localVars = {};
  errors = [];

  // Build the module
  const wasmBinary = generateModule(ast);

  return {
    wasm: wasmBinary,
    errors,
  };
}

/**
 * Generate the WebAssembly module binary
 *
 * @param {Array} ast - The typed and checked abstract syntax tree
 * @returns {Uint8Array} - WebAssembly binary module
 */
function generateModule(ast) {
  // First pass: collect function declarations and string literals
  collectFunctions(ast);
  collectStringLiterals(ast);

  // Initialize sections
  const sections = [];

  // Magic number and version
  sections.push(new Uint8Array([0x00, 0x61, 0x73, 0x6d])); // "\0asm"
  sections.push(new Uint8Array([0x01, 0x00, 0x00, 0x00])); // Version 1

  // Build import section (for console.log)
  sections.push(buildImportSection());

  // Build type section
  sections.push(buildTypeSection());

  // Build function section
  sections.push(buildFunctionSection());

  // Build memory section
  sections.push(buildMemorySection());

  // Build export section
  sections.push(buildExportSection());

  // Build code section
  sections.push(buildCodeSection());

  // Build data section for string literals
  if (stringLiterals.length > 0) {
    sections.push(buildDataSection());
  }

  // Concatenate all sections
  return concatBytes(sections);
}

/**
 * Build the WebAssembly import section
 */
function buildImportSection() {
  // Import the JavaScript console.log function
  const moduleName = encoder.encode("console");
  const fieldName = encoder.encode("log");
  
  const content = concatBytes([
    encodeULEB128(1), // Number of imports
    encodeULEB128(moduleName.length),
    moduleName,
    encodeULEB128(fieldName.length),
    fieldName,
    new Uint8Array([0x00]), // Import kind: function
    encodeULEB128(0) // Type index 0 (i32) -> void
  ]);

  return concatBytes([
    new Uint8Array([0x02]), // Import section code
    encodeULEB128(content.length),
    content
  ]);
}

/**
 * Build the WebAssembly type section
 */
function buildTypeSection() {
  const entries = [];
  
  // Type for console.log (i32) -> void
  entries.push(concatBytes([
    new Uint8Array([TYPES.FUNC]),
    encodeULEB128(1), // 1 parameter
    new Uint8Array([TYPES.I32]),
    encodeULEB128(0)  // 0 results
  ]));
  
  // Types for user functions
  const functionNames = Object.keys(functionTable);
  for (let i = 0; i < functionNames.length; i++) {
    const func = functionTable[functionNames[i]];
    
    // Build function type (all params are f64, result is f64)
    const params = new Array(func.params.length).fill(TYPES.F64);
    
    entries.push(concatBytes([
      new Uint8Array([TYPES.FUNC]),
      encodeULEB128(params.length),
      ...params.map(type => new Uint8Array([type])),
      encodeULEB128(1), // 1 result
      new Uint8Array([TYPES.F64])
    ]));
  }
  
  const content = concatBytes([
    encodeULEB128(entries.length),
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
function buildFunctionSection() {
  const functionNames = Object.keys(functionTable);
  const functionTypeIndices = [];
  
  // Console.log is index 0, then user functions
  for (let i = 0; i < functionNames.length; i++) {
    functionIndices[functionNames[i]] = i + 1; // +1 because console.log is index 0
    functionTypeIndices.push(encodeULEB128(i + 1)); // +1 because console.log type is index 0
  }
  
  const content = concatBytes([
    encodeULEB128(functionNames.length),
    ...functionTypeIndices
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
function buildMemorySection() {
  const content = concatBytes([
    encodeULEB128(1), // 1 memory definition
    new Uint8Array([0x00]), // No maximum (flags = 0)
    encodeULEB128(MEMORY_PAGE_SIZE)
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
function buildExportSection() {
  const exports = [];
  
  // Export memory
  const memoryName = encoder.encode("memory");
  exports.push(concatBytes([
    encodeULEB128(memoryName.length),
    memoryName,
    new Uint8Array([0x02]), // Export kind: memory
    encodeULEB128(0) // Memory index
  ]));
  
  // Export main function if it exists
  if (functionIndices.main !== undefined) {
    const mainName = encoder.encode("main");
    exports.push(concatBytes([
      encodeULEB128(mainName.length),
      mainName,
      new Uint8Array([0x00]), // Export kind: function
      encodeULEB128(functionIndices.main)
    ]));
  }
  
  const content = concatBytes([
    encodeULEB128(exports.length),
    ...exports
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
function buildCodeSection() {
  const functionBodies = [];
  const functionNames = Object.keys(functionTable);
  
  for (let i = 0; i < functionNames.length; i++) {
    const funcBody = generateFunctionBody(functionNames[i], functionTable[functionNames[i]]);
    functionBodies.push(funcBody);
  }
  
  const content = concatBytes([
    encodeULEB128(functionBodies.length),
    ...functionBodies
  ]);
  
  return concatBytes([
    new Uint8Array([SECTION.CODE]),
    encodeULEB128(content.length),
    content
  ]);
}

/**
 * Build the WebAssembly data section for string literals
 */
function buildDataSection() {
  const dataEntries = [];
  
  for (const { value, ptr } of stringLiterals) {
    const bytes = [];
    
    // Add length prefix (4 bytes)
    const length = value.length;
    bytes.push(...[
      length & 0xFF,
      (length >> 8) & 0xFF,
      (length >> 16) & 0xFF,
      (length >> 24) & 0xFF
    ]);
    
    // Add the string bytes
    for (let i = 0; i < value.length; i++) {
      bytes.push(value.charCodeAt(i));
    }
    
    const dataBytes = new Uint8Array(bytes);
    
    dataEntries.push(concatBytes([
      new Uint8Array([0x00]), // Memory index 0
      new Uint8Array([OP.I32_CONST]),
      encodeSLEB128(ptr),
      new Uint8Array([OP.END]),
      encodeULEB128(dataBytes.length),
      dataBytes
    ]));
  }
  
  const content = concatBytes([
    encodeULEB128(dataEntries.length),
    ...dataEntries
  ]);
  
  return concatBytes([
    new Uint8Array([SECTION.DATA]),
    encodeULEB128(content.length),
    content
  ]);
}

/**
 * Collect all function declarations from the AST
 *
 * @param {Array} ast - The program AST
 */
function collectFunctions(ast) {
  for (const node of ast) {
    if (node.type === 'ConstDeclaration' && node.init.type === 'ArrowFunctionExpression') {
      functionTable[node.id.name] = node.init;
    }
  }
}

/**
 * Recursively collect all string literals from the AST
 *
 * @param {Array|Object} node - An AST node or array of nodes
 */
function collectStringLiterals(node) {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectStringLiterals(item);
    }
    return;
  }
  
  if (!node || typeof node !== 'object') return;
  
  // Check for string literals
  if (node.type === 'StringLiteral') {
    // Store each string literal only once
    if (stringTable[node.value] === undefined) {
      const ptr = nextStringPtr;
      const length = node.value.length;
      
      stringTable[node.value] = { ptr, length };
      stringLiterals.push({ value: node.value, ptr });
      
      // Advance pointer for next string (ptr + length + 4 bytes for length prefix)
      nextStringPtr += length + 4;
    }
  }
  
  // Recursively check all properties
  for (const key in node) {
    if (typeof node[key] === 'object' && node[key] !== null) {
      collectStringLiterals(node[key]);
    }
  }
}

/**
 * Generate a WebAssembly function body
 *
 * @param {string} name - Function name
 * @param {Object} node - Function AST node
 * @returns {Uint8Array} - WebAssembly function body bytes
 */
function generateFunctionBody(name, node) {
  // Reset function state
  localVars = {};
  currentFunctionLocals = [];
  let localIndex = 0;
  
  // Process parameters
  for (const param of node.params) {
    localVars[param.name] = { index: localIndex++, type: TYPES.F64 };
  }
  
  // Generate function body instructions
  const body = generateNodeBinary(node.body);
  
  // Encode locals declaration
  const localDeclarations = encodeLocals(currentFunctionLocals);
  
  // Add the end opcode to the function body
  const bodyWithEnd = concatBytes([body, new Uint8Array([OP.END])]);
  
  // Combine locals and body with size prefix
  const functionBody = concatBytes([
    encodeULEB128(localDeclarations.length + bodyWithEnd.length),
    localDeclarations,
    bodyWithEnd
  ]);
  
  return functionBody;
}

/**
 * Encode local variables for WebAssembly function
 */
function encodeLocals(locals) {
  if (locals.length === 0) {
    return encodeULEB128(0);
  }
  
  // Group locals by type (all are f64 in this case)
  const localCount = locals.length;
  
  return concatBytes([
    encodeULEB128(1), // 1 group of locals
    encodeULEB128(localCount),
    new Uint8Array([TYPES.F64])
  ]);
}

/**
 * Generate WebAssembly binary code for a node
 *
 * @param {Object} node - AST node
 * @returns {Uint8Array} - WebAssembly instructions
 */
function generateNodeBinary(node) {
  switch (node.type) {
    case 'BlockStatement':
      return generateBlockStatementBinary(node);
    case 'ReturnStatement':
      return generateReturnStatementBinary(node);
    case 'ConstDeclaration':
      return generateConstDeclarationBinary(node);
    case 'BinaryExpression':
      return generateBinaryExpressionBinary(node);
    case 'ConditionalExpression':
      return generateConditionalExpressionBinary(node);
    case 'CallExpression':
      return generateCallExpressionBinary(node);
    case 'Identifier':
      return generateIdentifierBinary(node);
    case 'StringLiteral':
      return generateStringLiteralBinary(node);
    case 'NumericLiteral':
      return generateNumericLiteralBinary(node);
    case 'BooleanLiteral':
      return generateBooleanLiteralBinary(node);
    case 'ArrowFunctionExpression':
      reportError('Nested function declarations are not supported in this WASM generator', node);
      return new Uint8Array([]); // Empty
    case 'ArrayLiteral':
      reportError('Array literals are not supported in this WASM generator', node);
      return new Uint8Array([]); // Empty
    default:
      reportError(`Unsupported node type: ${node.type}`, node);
      return new Uint8Array([]); // Empty
  }
}

/**
 * Generate binary code for a block statement
 *
 * @param {Object} node - BlockStatement node
 * @returns {Uint8Array} - WebAssembly instructions
 */
function generateBlockStatementBinary(node) {
  const statements = [];
  
  for (const statement of node.body) {
    statements.push(generateNodeBinary(statement));
  }
  
  return concatBytes(statements);
}

/**
 * Generate binary code for a return statement
 *
 * @param {Object} node - ReturnStatement node
 * @returns {Uint8Array} - WebAssembly instructions
 */
function generateReturnStatementBinary(node) {
  if (!node.argument) {
    // Return 0 for void returns
    return concatBytes([
      new Uint8Array([OP.F64_CONST]),
      encodeF64(0)
    ]);
  }
  
  return generateNodeBinary(node.argument);
}

/**
 * Generate binary code for a const declaration
 *
 * @param {Object} node - ConstDeclaration node
 * @returns {Uint8Array} - WebAssembly instructions
 */
function generateConstDeclarationBinary(node) {
  // Skip function declarations - they're handled separately
  if (node.init.type === 'ArrowFunctionExpression') {
    return new Uint8Array([]);
  }
  
  // Add local variable if not already in scope
  const varName = node.id.name;
  if (!localVars[varName]) {
    // Create new local variable
    const localIndex = Object.keys(localVars).length;
    localVars[varName] = { index: localIndex, type: TYPES.F64 };
    currentFunctionLocals.push(TYPES.F64);
  }
  
  // Generate initialization code
  const valueCode = generateNodeBinary(node.init);
  
  return concatBytes([
    valueCode,
    new Uint8Array([OP.LOCAL_SET]),
    encodeULEB128(localVars[varName].index)
  ]);
}

/**
 * Generate binary code for a binary expression
 *
 * @param {Object} node - BinaryExpression node
 * @returns {Uint8Array} - WebAssembly instructions
 */
function generateBinaryExpressionBinary(node) {
  const left = generateNodeBinary(node.left);
  const right = generateNodeBinary(node.right);
  
  // Handle different operators
  let opCode;
  switch (node.operator) {
    case '+':
      opCode = OP.F64_ADD;
      break;
    case '*':
      opCode = OP.F64_MUL;
      break;
    default:
      reportError(`Unsupported binary operator: ${node.operator}`, node);
      return new Uint8Array([]);
  }
  
  return concatBytes([
    left,
    right,
    new Uint8Array([opCode])
  ]);
}

/**
 * Generate binary code for a conditional expression
 *
 * @param {Object} node - ConditionalExpression node
 * @returns {Uint8Array} - WebAssembly instructions
 */
function generateConditionalExpressionBinary(node) {
  const test = generateNodeBinary(node.test);
  const consequent = generateNodeBinary(node.consequent);
  const alternate = generateNodeBinary(node.alternate);
  
  // Compare condition with 0 to get boolean
  const comparison = concatBytes([
    test,
    new Uint8Array([OP.F64_CONST]),
    encodeF64(0),
    new Uint8Array([OP.F64_NE])
  ]);
  
  // if/else construct
  return concatBytes([
    comparison,
    new Uint8Array([OP.IF, TYPES.F64]),
    consequent,
    new Uint8Array([OP.ELSE]),
    alternate,
    new Uint8Array([OP.END])
  ]);
}

/**
 * Generate binary code for a function call
 *
 * @param {Object} node - CallExpression node
 * @returns {Uint8Array} - WebAssembly instructions
 */
function generateCallExpressionBinary(node) {
  // Check if the function is a user-defined one
  if (node.callee.type === 'Identifier') {
    const funcName = node.callee.name;
    
    if (functionIndices[funcName] !== undefined) {
      // Generate code for each argument
      const args = [];
      for (const arg of node.arguments) {
        args.push(generateNodeBinary(arg));
      }
      
      // Generate the call
      return concatBytes([
        ...args,
        new Uint8Array([OP.CALL]),
        encodeULEB128(functionIndices[funcName])
      ]);
    }
  }
  
  reportError(`Call to undefined function: ${node.callee.name || 'anonymous'}`, node);
  return new Uint8Array([]);
}

/**
 * Generate binary code for an identifier reference
 *
 * @param {Object} node - Identifier node
 * @returns {Uint8Array} - WebAssembly instructions
 */
function generateIdentifierBinary(node) {
  const varName = node.name;
  
  if (localVars[varName]) {
    return concatBytes([
      new Uint8Array([OP.LOCAL_GET]),
      encodeULEB128(localVars[varName].index)
    ]);
  }
  
  reportError(`Reference to undefined variable: ${varName}`, node);
  return new Uint8Array([]);
}

/**
 * Generate binary code for a string literal
 *
 * @param {Object} node - StringLiteral node
 * @returns {Uint8Array} - WebAssembly instructions
 */
function generateStringLiteralBinary(node) {
  const { ptr } = stringTable[node.value];
  
  // Return the pointer to the string in memory and convert to f64
  return concatBytes([
    new Uint8Array([OP.I32_CONST]),
    encodeSLEB128(ptr),
    new Uint8Array([OP.F64_CONVERT_I32_U])
  ]);
}

/**
 * Generate binary code for a numeric literal
 *
 * @param {Object} node - NumericLiteral node
 * @returns {Uint8Array} - WebAssembly instructions
 */
function generateNumericLiteralBinary(node) {
  return concatBytes([
    new Uint8Array([OP.F64_CONST]),
    encodeF64(node.value)
  ]);
}

/**
 * Generate binary code for a boolean literal
 *
 * @param {Object} node - BooleanLiteral node
 * @returns {Uint8Array} - WebAssembly instructions
 */
function generateBooleanLiteralBinary(node) {
  // In WebAssembly, represent boolean as 1.0 (true) or 0.0 (false)
  return concatBytes([
    new Uint8Array([OP.F64_CONST]),
    encodeF64(node.value ? 1 : 0)
  ]);
}

/**
 * Compile source code to WebAssembly
 *
 * @param {string} sourceCode - Source code to compile
 * @returns {Object} - WebAssembly module info and any errors
 */
function compileToWasm(sourceCode) {
  const { compile } = require('./parse');
  const { nameCheck } = require('./naming');
  const { typeCheck } = require('./typecheck');
  
  // Parse the source code
  const ast = compile(sourceCode);
  
  // Check names and types
  const nameResult = nameCheck(ast);
  if (nameResult.errors.length > 0) {
    return { errors: nameResult.errors };
  }
  
  const typeResult = typeCheck(ast);
  if (typeResult.errors.length > 0) {
    return { errors: typeResult.errors };
  }
  
  // Generate WebAssembly
  return generateWasm(ast);
}

module.exports = {
  generateWasm,
  compileToWasm,
};