// Test WebAssembly code generation in our compiler
const { compileWithTypes } = require("../compiler/parse");
const { generateWasmModule } = require("../compiler/generate-wasm");
const fs = require('fs');
const path = require('path');

// Example 1: Simple numeric operation
const example1 = `
const add = (a, b) => a + b;
`;

// Example 2: Conditional expression
const example2 = `
const max = (a, b) => a > b ? a : b;
`;

// Example 3: Nested function calls
const example3 = `
const double = (x) => x + x;
const quadruple = (x) => double(double(x));
`;

// Example 4: More complex function with conditional logic
const example4 = `
const factorial = (n) => {
  return n <= 1 ? 1 : n * factorial(n - 1);
};
`;

// Function to run the WebAssembly generation and save the output
function testWasmGeneration(name, code) {
  console.log(`\n== ${name} ==`);
  console.log(code);

  try {
    // Compile and type check
    const result = compileWithTypes(code);
    
    if (result.errors.length > 0) {
      console.log("\nCompilation errors:");
      result.errors.forEach((error) => {
        console.log(`  - ${error.message}`);
      });
      return;
    }
    
    // Generate WebAssembly
    const wasmBinary = generateWasmModule(result.ast);
    const outputFile = path.join(__dirname, `${name.replace(/\s+/g, '_').toLowerCase()}.wasm`);
    
    // Save the binary to a file
    fs.writeFileSync(outputFile, Buffer.from(wasmBinary));
    console.log(`\nWASM binary saved to: ${outputFile}`);
    console.log(`WASM size: ${wasmBinary.byteLength} bytes`);
    
  } catch (error) {
    console.log(`\nError during WebAssembly generation: ${error.message}`);
    console.error(error.stack);
  }
}

// Run all test cases
console.log("WEBASSEMBLY CODE GENERATION TESTS");
console.log("=================================");

testWasmGeneration("Simple Addition", example1);
testWasmGeneration("Max Function", example2);
testWasmGeneration("Nested Function Calls", example3);
testWasmGeneration("Factorial Function", example4);