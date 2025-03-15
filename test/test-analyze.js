// Test our static name resolution
const { compileAndAnalyze } = require("./parse");

// Example 1: Valid variable usage
const example1 = `
const greeting = "Hello";
const message = greeting + " world";
`;

// Example 2: Invalid reference to undeclared variable
const example2 = `
const result = undeclaredVar + 10;
`;

// Example 3: Duplicate declaration in the same scope
const example3 = `
const value = 42;
const value = 100;
`;

// Example 4: Valid nested scopes with arrow functions
const example4 = `
const outer = 100;
const func = () => {
  const inner = outer + 50;
  return inner;
};
`;

// Example 5: Valid parameter usage in functions
const example5 = `
const greet = (name, message) => {
  return message + " " + name;
};
`;

// Example 6: Reference to undeclared variable in function
const example6 = `
const calculate = () => {
  return unknownVariable;
};
`;

// Example 7: Duplicate parameter names
const example7 = `
const badFunc = (name, name) => {
  return name;
};
`;

// Example 8: Complex example with multiple scopes
const example8 = `
const outer = "outside";
const first = () => {
  const middle = "middle";
  const inner = () => {
    const innermost = "inside";
    return outer + middle + innermost;
  };
  return inner;
};

const second = () => {
  return firstValue;
};
`;

// Example 9: Shadow variables in nested scopes - without function call
const example9 = `
const x = 10;
const outer = () => {
  const x = 20;
  const inner = () => {
    const x = 30;
    return x;
  };
  return x;
};
`;

// Function to run the analysis and format results
function testAnalysis(name, code) {
  console.log(`\n== ${name} ==`);
  console.log(code);

  try {
    const result = compileAndAnalyze(code);

    if (result.errors.length === 0) {
      console.log("\nResult: ✅ No errors found");
    } else {
      console.log("\nResult: ❌ Errors found:");
      result.errors.forEach((error) => {
        console.log(`  - ${error.message}`);
      });
    }
  } catch (error) {
    console.log(`\nError during analysis: ${error.message}`);
  }
}

// Run all test cases
console.log("STATIC NAME RESOLUTION TESTS");
console.log("===========================");

testAnalysis("Valid Variable Usage", example1);
testAnalysis("Reference to Undeclared Variable", example2);
testAnalysis("Duplicate Declaration", example3);
testAnalysis("Nested Scopes with Arrow Functions", example4);
testAnalysis("Parameter Usage in Functions", example5);
testAnalysis("Undeclared Variable in Function", example6);
testAnalysis("Duplicate Parameter Names", example7);
testAnalysis("Complex Example with Multiple Scopes", example8);
testAnalysis("Shadow Variables in Nested Scopes", example9);
