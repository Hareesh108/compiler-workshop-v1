// Test type annotations in our compiler
const { compileWithTypes } = require("./parse");
const { typeToString } = require("./typecheck");

// Example 1: Basic type annotations
const example1 = `
const x: number = 5;
const y: string = "hello";
const z = 10; // No annotation, should infer
`;

// Example 2: Array type annotations
const example2 = `
const numbers: Array<number> = [1, 2, 3];
const strings: Array<string> = ["a", "b", "c"];
const emptyArray: Array<number> = [];
`;

// Example 3: Function parameter and return type annotations
const example3 = `
const add = (x: number, y: number): number => x + y;
const greet = (name: string): string => "Hello, " + name;
`;

// Example 4: Arrow function with type annotations (without generics for now)
const example4 = `
const identity = (x) => x;
const five = identity(5);
const hello = identity("hello");
`;

// Example 5: Type mismatch with annotation
const example5 = `
const x: number = "string"; // Should cause type error
`;

// Example 6: Empty array with annotation
const example6 = `
const emptyNumbers: Array<number> = [];
const first = emptyNumbers[0];
`;

// Example 7: Partial type annotations
const example7 = `
const add = (x: number, y) => x + y;
const result = add(5, 10);
`;

// Example 8: Arrow function with return type
const example8 = `
const createGreeter = (prefix: string) => (name: string): string => prefix + ", " + name;
const greetHello = createGreeter("Hello");
const greeting = greetHello("world");
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
          const typeStr = typeToString(statement.inferredType);
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
console.log("TYPE ANNOTATION TESTS");
console.log("=====================");

testTypeCheck("Basic Type Annotations", example1);
testTypeCheck("Array Type Annotations", example2);
testTypeCheck("Function Parameter and Return Types", example3);
testTypeCheck("Polymorphic Arrow Function", example4);
testTypeCheck("Type Mismatch with Annotation", example5);
testTypeCheck("Empty Array with Annotation", example6);
testTypeCheck("Partial Type Annotations", example7);
testTypeCheck("Arrow Function with Return Type", example8);
