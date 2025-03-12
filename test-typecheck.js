// Test our Hindley-Milner type inference system
const { compileWithTypes } = require("./parse");

// Example 1: Type inference with numbers
const example1 = `
const x = 5;
const y = 10;
const sum = x + y;
`;

// Example 2: Function type inference
const example2 = `
const identity = (x) => x;
const five = identity(5);
`;

// Example 3: Return statement position check
const example3 = `
const badFunc = () => {
  return 5;
  const x = 10;
};
`;

// Example 4: Return statement only at the end
const example4 = `
const goodFunc = () => {
  const x = 10;
  return x;
};
`;

// Example 5: Arithmetic operator with non-numeric operands
const example5 = `
const num = 42;
const str = "hello";
const bad = num + str;
`;

// Example 6: Nested functions and closures
const example6 = `
const createAdder = (x) => {
  return (y) => {
    return x + y;
  };
};

const add5 = createAdder(5);
const result = add5(10);
`;

// Example 7: Type error in conditional
const example7 = `
const condition = 42;
const result = condition ? "yes" : "no";
`;

// Example 8: Polymorphic function
const example8 = `
const applyTwice = (f, x) => {
  return f(f(x));
};

const double = (n) => n + n;
const num = applyTwice(double, 3);
`;

// Function to run the type checking and format results
function testTypeCheck(name, code) {
  console.log(`\n== ${name} ==`);
  console.log(code);

  try {
    const result = compileWithTypes(code);

    if (result.errors.length === 0) {
      console.log("\nResult: ✅ No type errors found");

      // Show inferred types for top-level declarations
      console.log("\nInferred types:");
      for (const statement of result.ast.body) {
        if (statement.type === "ConstDeclaration") {
          const typeStr = statement.inferredType?.toString() || "unknown";
          console.log(`  ${statement.id.name}: ${typeStr}`);
        }
      }
    } else {
      console.log("\nResult: ❌ Errors found:");
      result.errors.forEach((error) => {
        console.log(`  - ${error.message}`);
      });
    }
  } catch (error) {
    console.log(`\nError during type checking: ${error.message}`);
  }
}

// Run all test cases
console.log("HINDLEY-MILNER TYPE INFERENCE TESTS");
console.log("==================================");

testTypeCheck("Basic Type Inference", example1);
testTypeCheck("Function Type Inference", example2);
testTypeCheck("Return Statement Position Check (Invalid)", example3);
testTypeCheck("Return Statement Position Check (Valid)", example4);
testTypeCheck("Arithmetic with Non-Numeric Operands", example5);
testTypeCheck("Nested Functions and Closures", example6);
testTypeCheck("Type Error in Conditional", example7);
testTypeCheck("Polymorphic Function", example8);
