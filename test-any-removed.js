const { compileWithTypes } = require("./parse");

function runTest(testName, sourceCode) {
  try {
    const result = compileWithTypes(sourceCode);
    console.log(`❌ ${testName} failed: 'any' type was accepted`);
  } catch (error) {
    console.log(`✅ ${testName} passed: 'any' type was rejected`);
    // console.log(error.message);
  }
}

// Test 1: Basic variable with any type
runTest("Variable declaration", `
  const x: any = 5;
`);

// Test 2: Function parameter with any type
runTest("Function parameter", `
  const func = (x: any) => x;
`);

// Test 3: Function return type with any
runTest("Function return type", `
  const func = (): any => 42;
`);

// Test 4: Array of any
runTest("Array of any", `
  const arr: Array<any> = [1, "string", true];
`);

// Test 5: Nested any in complex type
runTest("Nested any", `
  const nested: Array<Array<any>> = [[1, 2], ["a", "b"]];
`);

console.log("\nAll tests completed!");