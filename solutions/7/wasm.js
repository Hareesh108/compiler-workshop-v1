/**
 * WebAssembly Code Generation
 *
 * This module generates WebAssembly code from the parsed and type-checked AST.
 * It supports basic types (numbers as f64, strings, booleans) and conditionals.
 * It will throw errors for unsupported features like polymorphic arrays or functions.
 */

// Keep track of string literals for data section
let stringLiterals = [];
let stringTable = {};
let nextStringPtr = 0;
let functionTable = {};
let localVars = {};
let currentFunctionLocals = new Set();
let errors = [];

// Memory constants
const STRING_BUFFER_SIZE = 65536; // 64KB string buffer
const MEMORY_PAGE_SIZE = 1;       // Initial memory size (64KB pages)

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
  localVars = {};
  errors = [];

  // Build the module
  const watCode = generateModule(ast);

  return {
    wat: watCode,
    errors,
  };
}

/**
 * Generate the WebAssembly module structure
 *
 * @param {Array} ast - The typed and checked abstract syntax tree
 * @returns {string} - WebAssembly text format code
 */
function generateModule(ast) {
  // First pass: collect function declarations and string literals
  collectFunctions(ast);
  collectStringLiterals(ast);

  // Build the data section for string literals
  const dataSection = generateDataSection();

  // Generate function declarations
  const functionDeclarations = Object.keys(functionTable)
    .map(funcName => generateFunctionDeclaration(funcName, functionTable[funcName]))
    .join('\n\n');

  // Build the complete module
  return `(module
  ;; Import the JavaScript console.log function
  (import "console" "log" (func $log (param i32)))
  
  ;; Memory section with initial size
  (memory (export "memory") ${MEMORY_PAGE_SIZE})
  
  ;; Data section for string literals
  ${dataSection}
  
  ;; Function declarations
  ${functionDeclarations}
  
  ;; Export main function if it exists
  ${functionTable.main ? '(export "main" (func $main))' : ''}
)`;
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
 * Generate the data section for string literals
 */
function generateDataSection() {
  if (stringLiterals.length === 0) {
    return '';
  }
  
  return stringLiterals.map(({ value, ptr }) => {
    const bytes = [];
    const lengthBytes = encodeInt32(value.length);
    
    // Add the length prefix (4 bytes)
    bytes.push(...lengthBytes);
    
    // Add the string bytes
    for (let i = 0; i < value.length; i++) {
      bytes.push(value.charCodeAt(i));
    }
    
    return `(data (i32.const ${ptr}) "${escapeString(bytes)}")`;
  }).join('\n  ');
}

/**
 * Encode a 32-bit integer to its byte representation
 * 
 * @param {number} value - The integer to encode
 * @returns {Array} - Array of bytes representing the integer
 */
function encodeInt32(value) {
  return [
    value & 0xFF,
    (value >> 8) & 0xFF,
    (value >> 16) & 0xFF,
    (value >> 24) & 0xFF
  ];
}

/**
 * Escape a byte array for use in WAT data section
 * 
 * @param {Array} bytes - Array of byte values
 * @returns {string} - Escaped string for WAT format
 */
function escapeString(bytes) {
  return bytes.map(b => {
    if (b >= 32 && b <= 126 && b !== 34 && b !== 92) {
      return String.fromCharCode(b);
    } else {
      return `\\${b.toString(16).padStart(2, '0')}`;
    }
  }).join('');
}

/**
 * Generate a WebAssembly function declaration
 *
 * @param {string} name - Function name
 * @param {Object} node - Function AST node
 * @returns {string} - WebAssembly function declaration
 */
function generateFunctionDeclaration(name, node) {
  // Reset function state
  localVars = {};
  currentFunctionLocals = new Set();
  let localIndex = 0;
  
  // Process parameters
  const params = node.params.map(param => {
    localVars[param.name] = { index: localIndex++, type: getWasmType(param) };
    return `(param $${param.name} ${getWasmType(param)})`;
  }).join(' ');
  
  // Determine return type
  let returnType = 'f64'; // Default to f64 for simplicity
  if (node.returnType) {
    returnType = getWasmTypeFromAnnotation(node.returnType);
  }
  
  // Generate function body
  const body = generateNode(node.body);
  
  // Generate local variable declarations
  const locals = Array.from(currentFunctionLocals)
    .map(local => `(local $${local} f64)`)
    .join('\n    ');
  
  return `(func $${name} ${params} (result ${returnType})
    ${locals}
    ${body}
  )`;
}

/**
 * Generate WebAssembly code for a node
 *
 * @param {Object} node - AST node
 * @returns {string} - WebAssembly instructions
 */
function generateNode(node) {
  switch (node.type) {
    case 'BlockStatement':
      return generateBlockStatement(node);
    case 'ReturnStatement':
      return generateReturnStatement(node);
    case 'ConstDeclaration':
      return generateConstDeclaration(node);
    case 'BinaryExpression':
      return generateBinaryExpression(node);
    case 'ConditionalExpression':
      return generateConditionalExpression(node);
    case 'CallExpression':
      return generateCallExpression(node);
    case 'Identifier':
      return generateIdentifier(node);
    case 'StringLiteral':
      return generateStringLiteral(node);
    case 'NumericLiteral':
      return generateNumericLiteral(node);
    case 'BooleanLiteral':
      return generateBooleanLiteral(node);
    case 'ArrowFunctionExpression':
      reportError('Nested function declarations are not supported in this WASM generator', node);
      return '(unreachable)';
    case 'ArrayLiteral':
      reportError('Array literals are not supported in this WASM generator', node);
      return '(unreachable)';
    default:
      reportError(`Unsupported node type: ${node.type}`, node);
      return '(unreachable)';
  }
}

/**
 * Generate code for a block statement
 *
 * @param {Object} node - BlockStatement node
 * @returns {string} - WebAssembly instructions
 */
function generateBlockStatement(node) {
  // Process each statement in the block
  const statements = node.body.map(statement => generateNode(statement)).join('\n    ');
  return statements;
}

/**
 * Generate code for a return statement
 *
 * @param {Object} node - ReturnStatement node
 * @returns {string} - WebAssembly instructions
 */
function generateReturnStatement(node) {
  if (!node.argument) {
    return '(f64.const 0)'; // Return 0 for void returns
  }
  
  return generateNode(node.argument);
}

/**
 * Generate code for a const declaration
 *
 * @param {Object} node - ConstDeclaration node
 * @returns {string} - WebAssembly instructions
 */
function generateConstDeclaration(node) {
  // Skip function declarations - they're handled separately
  if (node.init.type === 'ArrowFunctionExpression') {
    return '';
  }
  
  // Add local variable if not already in scope
  const varName = node.id.name;
  if (!localVars[varName]) {
    currentFunctionLocals.add(varName);
    localVars[varName] = { 
      index: Object.keys(localVars).length,
      type: 'f64' // Default to f64 for simplicity
    };
  }
  
  // Generate code to initialize the variable
  return `${generateNode(node.init)}
    local.set $${varName}`;
}

/**
 * Generate code for a binary expression
 *
 * @param {Object} node - BinaryExpression node
 * @returns {string} - WebAssembly instructions
 */
function generateBinaryExpression(node) {
  const left = generateNode(node.left);
  const right = generateNode(node.right);
  
  // Handle different operators
  switch (node.operator) {
    case '+':
      return `${left}
    ${right}
    f64.add`;
    case '*':
      return `${left}
    ${right}
    f64.mul`;
    default:
      reportError(`Unsupported binary operator: ${node.operator}`, node);
      return '(unreachable)';
  }
}

/**
 * Generate code for a conditional expression
 *
 * @param {Object} node - ConditionalExpression node
 * @returns {string} - WebAssembly instructions
 */
function generateConditionalExpression(node) {
  const test = generateNode(node.test);
  const consequent = generateNode(node.consequent);
  const alternate = generateNode(node.alternate);
  
  return `${test}
    f64.const 0
    f64.ne
    (if (result f64)
      (then
        ${consequent}
      )
      (else
        ${alternate}
      )
    )`;
}

/**
 * Generate code for a function call
 *
 * @param {Object} node - CallExpression node
 * @returns {string} - WebAssembly instructions
 */
function generateCallExpression(node) {
  // Check if the function is a built-in
  if (node.callee.type === 'Identifier') {
    const funcName = node.callee.name;
    
    // Check if it's a user-defined function
    if (functionTable[funcName]) {
      // Generate code for each argument
      const args = node.arguments.map(arg => generateNode(arg)).join('\n    ');
      return `${args}
    call $${funcName}`;
    }
  }
  
  reportError(`Call to undefined function: ${node.callee.name || 'anonymous'}`, node);
  return '(unreachable)';
}

/**
 * Generate code for an identifier reference
 *
 * @param {Object} node - Identifier node
 * @returns {string} - WebAssembly instructions
 */
function generateIdentifier(node) {
  const varName = node.name;
  
  if (localVars[varName]) {
    return `local.get $${varName}`;
  }
  
  reportError(`Reference to undefined variable: ${varName}`, node);
  return '(unreachable)';
}

/**
 * Generate code for a string literal
 *
 * @param {Object} node - StringLiteral node
 * @returns {string} - WebAssembly instructions
 */
function generateStringLiteral(node) {
  const { ptr } = stringTable[node.value];
  
  // Return the pointer to the string in memory
  // In WebAssembly, we'll represent strings as pointers (i32)
  // and cast to f64 for consistency with our type system
  return `(f64.convert_i32_u (i32.const ${ptr}))`;
}

/**
 * Generate code for a numeric literal
 *
 * @param {Object} node - NumericLiteral node
 * @returns {string} - WebAssembly instructions
 */
function generateNumericLiteral(node) {
  return `(f64.const ${node.value})`;
}

/**
 * Generate code for a boolean literal
 *
 * @param {Object} node - BooleanLiteral node
 * @returns {string} - WebAssembly instructions
 */
function generateBooleanLiteral(node) {
  // In WebAssembly, represent boolean as 1.0 (true) or 0.0 (false)
  return `(f64.const ${node.value ? 1 : 0})`;
}

/**
 * Get the WebAssembly type for a node based on its concrete type
 *
 * @param {Object} node - AST node with type information
 * @returns {string} - WebAssembly type
 */
function getWasmType(node) {
  // Default to f64 for most types, for simplicity
  return 'f64';
}

/**
 * Get the WebAssembly type from a type annotation
 *
 * @param {Object} typeAnnotation - Type annotation node
 * @returns {string} - WebAssembly type
 */
function getWasmTypeFromAnnotation(typeAnnotation) {
  if (!typeAnnotation) return 'f64';
  
  if (typeAnnotation.type === 'TypeAnnotation') {
    switch (typeAnnotation.valueType) {
      case 'number':
      case 'Float':
      case 'Boolean':
      case 'Bool':
      case 'string':
        return 'f64';
      case 'void':
      case 'Void':
      case 'Unit':
        return 'f64'; // Using f64 for void returns too
      default:
        return 'f64';
    }
  }
  
  if (typeAnnotation.type === 'ArrayTypeAnnotation') {
    reportError('Array types are not supported in this WASM generator', typeAnnotation);
  }
  
  if (typeAnnotation.type === 'FunctionTypeAnnotation') {
    reportError('Function types are not supported in this WASM generator', typeAnnotation);
  }
  
  return 'f64';
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