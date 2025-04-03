const fs = require('fs');
const { compileToWasm } = require('./wasm');
const { test, assert, assertEqual, summarize } = require('../test');

// WebAssembly testing utilities
async function instantiateWasm(wasmBinary) {
  const importObject = {
    console: {
      log: (value) => console.log(value)
    }
  };
  
  try {
    const module = await WebAssembly.compile(wasmBinary);
    const instance = await WebAssembly.instantiate(module, importObject);
    return { module, instance, exports: instance.exports };
  } catch (error) {
    throw new Error(`Failed to instantiate WebAssembly module: ${error.message}`);
  }
}

async function compileAndRunWasm(sourceCode) {
  // Compile source to WASM binary
  const result = compileToWasm(sourceCode);
  
  if (result.errors && result.errors.length > 0) {
    console.error("Compilation errors:", result.errors);
    return { success: false, errors: result.errors };
  }
  
  try {
    // Instantiate the WebAssembly module
    const { exports } = await instantiateWasm(result.wasm);
    return { success: true, exports };
  } catch (error) {
    return { success: false, error };
  }
}

// Adapter function to run async tests with the synchronous test framework
function runAsyncTest(name, testFn) {
  test(name, () => {
    // Create a promise that will be resolved by the test
    const promise = testFn();
    
    // Since our test framework doesn't support async, we need to make this synchronous
    // We'll throw if the test fails, which the test framework will catch
    let resolved = false;
    let testPassed = false;
    let errorMsg = '';
    
    promise.then(() => {
      resolved = true;
      testPassed = true;
    }).catch(error => {
      resolved = true;
      errorMsg = error.message;
    });
    
    // Hacky synchronous wait - in a real app, never do this!
    const start = Date.now();
    while (!resolved && Date.now() - start < 5000) {
      // Busy wait - this is a terrible practice but necessary for our simple test framework
    }
    
    if (!resolved) {
      throw new Error("Test timed out after 5 seconds");
    }
    
    if (!testPassed) {
      throw new Error(errorMsg);
    }
  });
}

// WASM binary testing

runAsyncTest("Simple numeric constant", async () => {
  const sourceCode = `
    const main = () => {
      return 42.5;
    };
  `;
  
  const { success, exports, error } = await compileAndRunWasm(sourceCode);
  assert(success, `WebAssembly compilation/instantiation failed: ${error?.message || "unknown error"}`);
  assertEqual(exports.main(), 42.5, "Function should return 42.5");
});

runAsyncTest("Simple numeric addition", async () => {
  const sourceCode = `
    const main = () => {
      return 20 + 22.5;
    };
  `;
  
  const { success, exports, error } = await compileAndRunWasm(sourceCode);
  assert(success, `WebAssembly compilation/instantiation failed: ${error?.message || "unknown error"}`);
  assertEqual(exports.main(), 42.5, "Function should return 42.5");
});

runAsyncTest("Function with parameters", async () => {
  const sourceCode = `
    const add = (a, b) => {
      return a + b;
    };
    
    const main = () => {
      return add(40, 2.5);
    };
  `;
  
  const { success, exports, error } = await compileAndRunWasm(sourceCode);
  assert(success, `WebAssembly compilation/instantiation failed: ${error?.message || "unknown error"}`);
  assertEqual(exports.main(), 42.5, "Function should return 42.5");
});

runAsyncTest("Boolean constants", async () => {
  const sourceCode = `
    const returnTrue = () => {
      return true;
    };
    
    const returnFalse = () => {
      return false;
    };
    
    const main = () => {
      const t = returnTrue();
      const f = returnFalse();
      // In our implementation, true = 1.0, false = 0.0
      return t + f;
    };
  `;
  
  const { success, exports, error } = await compileAndRunWasm(sourceCode);
  assert(success, `WebAssembly compilation/instantiation failed: ${error?.message || "unknown error"}`);
  assertEqual(exports.main(), 1, "Function should return 1 (true + false = 1 + 0)");
});

runAsyncTest("Conditional expressions", async () => {
  const sourceCode = `
    const main = () => {
      return true ? 42.5 : 10;
    };
  `;
  
  const { success, exports, error } = await compileAndRunWasm(sourceCode);
  assert(success, `WebAssembly compilation/instantiation failed: ${error?.message || "unknown error"}`);
  assertEqual(exports.main(), 42.5, "Function should return 42.5");
});

runAsyncTest("Local variables", async () => {
  const sourceCode = `
    const main = () => {
      const x = 40;
      const y = 2.5;
      return x + y;
    };
  `;
  
  const { success, exports, error } = await compileAndRunWasm(sourceCode);
  assert(success, `WebAssembly compilation/instantiation failed: ${error?.message || "unknown error"}`);
  assertEqual(exports.main(), 42.5, "Function should return 42.5");
});

runAsyncTest("Multiplication", async () => {
  const sourceCode = `
    const main = () => {
      return 8.5 * 5;
    };
  `;
  
  const { success, exports, error } = await compileAndRunWasm(sourceCode);
  assert(success, `WebAssembly compilation/instantiation failed: ${error?.message || "unknown error"}`);
  assertEqual(exports.main(), 42.5, "Function should return 42.5");
});

// Run the tests
summarize();