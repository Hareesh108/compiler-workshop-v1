// Test array support in our compiler
const { compileWithTypes } = require("./parse");

// Example 1: Basic array literals and type inference
const example1 = `
const emptyArray = [];
const numbers = [1, 2, 3];
const strings = ["hello", "world"];
`;

// Example 2: Array access
const example2 = `
const arr = [10, 20, 30];
const first = arr[0];
`;

// Example 3: Mixing types (should error)
const example3 = `
const mixed = [1, "string", true];
`;

// Example 4: Array indexing with non-integer
const example4 = `
const arr = [1, 2, 3];
const value = arr["index"];
`;

// Example 5: Function that works with arrays
const example5 = `
const getFirstElement = (arr) => {
  return arr[0];
};

const nums = [1, 2, 3];
const firstNum = getFirstElement(nums);

const strings = ["a", "b", "c"];
const firstString = getFirstElement(strings);
`;

// Example 6: Nested arrays
const example6 = `
const matrix = [[1, 2], [3, 4]];
const element = matrix[0][1];
`;

// Example 7: Array in a ternary
const example7 = `
const condition = true;
const result = condition ? [1, 2, 3] : [4, 5, 6];
`;

// Example 8: Empty array with element assignment
const example8 = `
const arr = [];
const newArr = [1, 2, 3];
`;

// Import the typeToString function from typecheck.js
const { typeToString: typecheckToString } = require("./typecheck");

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
          const typeStr = typecheckToString(statement.inferredType);
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
console.log("ARRAY TYPE INFERENCE TESTS");
console.log("==========================");

testTypeCheck("Basic Array Literals", example1);
testTypeCheck("Array Access", example2);
testTypeCheck("Mixed Types Array (Error Expected)", example3);
testTypeCheck("Non-Integer Index (Error Expected)", example4);
testTypeCheck("Polymorphic Array Function", example5);
testTypeCheck("Nested Arrays", example6);
testTypeCheck("Arrays in Ternary", example7);
testTypeCheck("Empty Array with Assignment", example8);
