const { compileToWasm } = require('./wasm');
const { assert, assertEqual } = require('../test');

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

// Helper function to create a promise with a setTimeout
function createTimedPromise(callback, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeout}ms`));
    }, timeout);

    try {
      // Call the callback and capture its result
      const result = callback();

      // If the callback returns a promise, handle it properly
      if (result && typeof result.then === 'function') {
        result.then(value => {
          clearTimeout(timer);
          resolve(value);
        }).catch(error => {
          clearTimeout(timer);
          reject(error);
        });
      } else {
        // If it's not a promise, resolve immediately
        clearTimeout(timer);
        resolve(result);
      }
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

// Store test functions instead of registering them immediately
const asyncTests = [];

// Adapter function to run async tests with the synchronous test framework
function runAsyncTest(name, testFn) {
  // Just store the test for later
  asyncTests.push({ name, testFn });
}

// Run all async tests and report results
async function runAsyncTestsAndSummarize() {
  console.log("Running WebAssembly tests...");

  // Track test results
  let allTestsPassed = true;
  const testResults = [];

  // Run each test asynchronously
  for (const { name, testFn } of asyncTests) {
    console.log(`Running test: ${name}`);

    try {
      // Run the test with a timeout
      await createTimedPromise(() => testFn(), 5000);
      console.log(`✅ ${name}`);
      testResults.push({ name, passed: true });
    } catch (error) {
      console.error(`❌ ${name}`);
      console.error(`   Error: ${error.message}`);
      testResults.push({ name, passed: false, error: error.message });
      allTestsPassed = false;
    }
  }

  // Print summary
  console.log("\n=== WebAssembly Test Results ===\n");

  for (const result of testResults) {
    if (result.passed) {
      console.log(`✅ ${result.name}`);
    } else {
      console.log(`❌ ${result.name}`);
      console.log(`   Error: ${result.error}`);
    }
  }

  console.log("\n=== Summary ===\n");
  console.log(`${testResults.filter(r => r.passed).length} passing, ${testResults.filter(r => !r.passed).length} failing`);

  if (allTestsPassed) {
    console.log("All tests passed!");
  } else {
    console.log("Some tests failed.");
    process.exit(1); // Exit with error code
  }
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

// Run the async tests and then summarize
runAsyncTestsAndSummarize();
