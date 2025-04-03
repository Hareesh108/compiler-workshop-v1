const { compile } = require("./parse");
const { nameCheck } = require("./naming");
const { typecheck, Types, typeToString, createArrayType } = require("./typecheck");
const {
  test,
  assert,
  assertEqual,
  summarize: reportTestFailures,
} = require("../test");

/**
 * Helper function to compile and typecheck a code string
 *
 * @param {string} code - Source code to test
 * @returns {object} - Typecheck result with AST and errors
 */
function compileAndTypecheck(code) {
  const statements = compile(code);
  const nameErrors = nameCheck(statements).errors;
  return typecheck(statements, nameErrors);
}

test("Typecheck simple literals", () => {
  // Check numeric literals
  let result = compileAndTypecheck("const x = 42;");
  assertEqual(result.errors.length, 0, "Integer should have no type errors");

  // Check string literals
  result = compileAndTypecheck("const s = \"hello\";");
  assertEqual(result.errors.length, 0, "String should have no type errors");

  // Check boolean literals
  result = compileAndTypecheck("const b = true;");
  assertEqual(result.errors.length, 0, "Boolean should have no type errors");
});

test("Typecheck numeric operations", () => {
  // Addition of two numbers
  let result = compileAndTypecheck("const x = 5 + 10;");
  assertEqual(result.errors.length, 0, "Adding two numbers should have no type errors");

  // Type mismatch in addition
  result = compileAndTypecheck("const x = 5 + true;");
  assert(result.errors.length > 0, "Adding number and boolean should have type errors");
  assert(
    result.errors.some(err => err.message.includes("Type mismatch") ||
                         err.message.includes("operands")),
    "Error should indicate type mismatch for operands"
  );
});

test("Typecheck string operations", () => {
  // String concatenation
  let result = compileAndTypecheck("const x = \"hello\" + \" world\";");
  assertEqual(result.errors.length, 0, "String concatenation should have no type errors");

  // String + number (should coerce to string)
  result = compileAndTypecheck("const x = \"value: \" + 42;");
  assert(result.errors.length > 0, "String + number should have type errors in this implementation");
});

// test("Typecheck ternary expressions", () => {
//   // Valid ternary with boolean condition
//   let result = compileAndTypecheck("const x = true ? 1 : 2;");
//   assertEqual(result.errors.length, 0, "Valid ternary should have no type errors");

//   // Invalid condition type
//   result = compileAndTypecheck("const x = 42 ? 1 : 2;");
//   assert(result.errors.length > 0, "Non-boolean condition should have type errors");

//   // Inconsistent result types
//   result = compileAndTypecheck("const x = true ? 1 : \"hello\";");
//   assert(result.errors.length > 0, "Inconsistent branch types should have type errors");
// });

test("Typecheck array literals", () => {
  // Homogeneous array
  let result = compileAndTypecheck("const arr = [1, 2, 3];");
  assertEqual(result.errors.length, 0, "Homogeneous array should have no type errors");

  // Empty array (should be ok, element type will be a type variable)
  result = compileAndTypecheck("const arr = [];");
  assertEqual(result.errors.length, 0, "Empty array should have no type errors");

  // Heterogeneous array
  result = compileAndTypecheck("const arr = [1, \"hello\", true];");
  assert(result.errors.length > 0, "Heterogeneous array should have type errors");
});

// test("Typecheck array access", () => {
//   // Valid array access
//   let result = compileAndTypecheck(`
//     const arr = [1, 2, 3];
//     const x = arr[0];
//   `);
//   assertEqual(result.errors.length, 0, "Valid array access should have no type errors");

//   // Invalid index type
//   result = compileAndTypecheck(`
//     const arr = [1, 2, 3];
//     const x = arr["hello"];
//   `);
//   assert(result.errors.length > 0, "Non-numeric index should have type errors");

//   // Accessing non-array
//   result = compileAndTypecheck(`
//     const val = 42;
//     const x = val[0];
//   `);
//   assert(result.errors.length > 0, "Accessing non-array should have type errors");
// });

// test("Typecheck function declarations and calls", () => {
//   // Simple function without parameters
//   let result = compileAndTypecheck(`
//     const fn = () => { return 42; };
//     const x = fn();
//   `);
//   assertEqual(result.errors.length, 0, "Simple function should have no type errors");

//   // Function with parameters
//   result = compileAndTypecheck(`
//     const add = (a, b) => { return a + b; };
//     const x = add(1, 2);
//   `);
//   assertEqual(result.errors.length, 0, "Function with parameters should have no type errors");

//   // Wrong number of arguments
//   result = compileAndTypecheck(`
//     const add = (a, b) => { return a + b; };
//     const x = add(1);
//   `);
//   assert(result.errors.length > 0, "Wrong argument count should have type errors");
//   assert(
//     result.errors.some(err => err.message.includes("Expected 2 arguments")),
//     "Error should indicate wrong argument count"
//   );

//   // Type mismatch in arguments
//   result = compileAndTypecheck(`
//     const concat = (a, b) => { return a + b; };
//     const x = concat("hello", "world");
//     const y = concat(1, true); // This should fail
//   `);
//   assert(result.errors.length > 0, "Type mismatch in arguments should have type errors");
// });

// test("Typecheck type annotations", () => {
//   // Explicit annotation matching the initializer
//   let result = compileAndTypecheck(`
//     const x: number = 42;
//   `);
//   assertEqual(result.errors.length, 0, "Matching annotation should have no type errors");

//   // Mismatched type annotation
//   result = compileAndTypecheck(`
//     const s: number = "hello";
//   `);
//   assert(result.errors.length > 0, "Mismatched annotation should have type errors");

//   // Array type annotation
//   result = compileAndTypecheck(`
//     const arr: Array<number> = [1, 2, 3];
//   `);
//   assertEqual(result.errors.length, 0, "Array type annotation should have no type errors");

//   // Function with return type annotation
//   result = compileAndTypecheck(`
//     const fn = (): number => { return 42; };
//   `);
//   assertEqual(result.errors.length, 0, "Function return type annotation should have no type errors");

//   // Function with parameter type annotations
//   result = compileAndTypecheck(`
//     const add = (a: number, b: number): number => { return a + b; };
//     const x = add(1, 2);
//   `);
//   assertEqual(result.errors.length, 0, "Function parameter type annotations should have no type errors");

//   // Mismatched return type
//   result = compileAndTypecheck(`
//     const fn = (): string => { return 42; };
//   `);
//   assert(result.errors.length > 0, "Mismatched return type should have type errors");
// });

// test("Typecheck polymorphic functions", () => {
//   // Identity function
//   let result = compileAndTypecheck(`
//     const identity = (x) => { return x; };
//     const a = identity(42);
//     const b = identity("hello");
//   `);
//   assertEqual(result.errors.length, 0, "Polymorphic identity function should have no type errors");

//   // First element function for arrays
//   result = compileAndTypecheck(`
//     const first = (arr) => { return arr[0]; };
//     const a = first([1, 2, 3]);
//     const b = first(["hello", "world"]);
//   `);
//   assertEqual(result.errors.length, 0, "Polymorphic array function should have no type errors");
// });

// test("Typecheck const declarations with inference", () => {
//   // Infer from simple literals
//   let result = compileAndTypecheck(`
//     const a = 1;
//     const b = "hello";
//     const c = true;
//   `);
//   assertEqual(result.errors.length, 0, "Simple inferences should have no type errors");

//   // Infer from expressions
//   result = compileAndTypecheck(`
//     const a = 1 + 2;
//     const b = "hello" + " world";
//     const c = true ? 1 : 2;
//   `);
//   assertEqual(result.errors.length, 0, "Expression inferences should have no type errors");

//   // Infer from other variables
//   result = compileAndTypecheck(`
//     const a = 42;
//     const b = a;
//     const c = b + 10;
//   `);
//   assertEqual(result.errors.length, 0, "Variable reference inferences should have no type errors");
// });

// test("Typecheck with complex expressions", () => {
//   // Complex expression with multiple types
//   let result = compileAndTypecheck(`
//     const a = 10;
//     const b = 20;
//     const c = true;
//     const result = c ? a + b : a - b;
//   `);
//   assertEqual(result.errors.length, 0, "Complex expression should have no type errors");

//   // Function returning complex expression
//   result = compileAndTypecheck(`
//     const compute = (a, b, c) => {
//       return c ? a + b : a - b;
//     };
//     const result = compute(10, 20, true);
//   `);
//   assertEqual(result.errors.length, 0, "Function with complex expression should have no type errors");
// });

reportTestFailures();
