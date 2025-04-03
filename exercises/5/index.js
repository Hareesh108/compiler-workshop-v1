const { compile } = require("./parse");
const { nameCheck } = require("./naming");
const { typeCheck } = require("./typecheck");
const {
  test,
  assert,
  assertEqual,
  summarize: reportTestFailures,
} = require("../test");

test("Type-check empty program", () => {
  const statements = compile("");
  const result = typeCheck(statements);

  assertEqual(result.errors, [], "Empty program should have no type errors");
});

test("Type-check simple numeric declaration", () => {
  const statements = compile("const x = 5;");
  const result = typeCheck(statements);

  assertEqual(result.errors, [], "No type errors expected");
});

test("Type-check variable reference with same type", () => {
  const statements = compile("const x = 5; const y = x;");
  const result = typeCheck(statements);

  assertEqual(result.errors, [], "No type errors expected");
});

test("Type-check string declaration and concatenation", () => {
  const statements = compile(
    'const x = "hello"; const y = "world"; const z = x + y;',
  );
  const result = typeCheck(statements);

  assertEqual(
    result.errors,
    [],
    "No type errors expected for string concatenation",
  );
});

test("Type-check numeric operations", () => {
  const statements = compile("const x = 5; const y = 10; const z = x + y;");
  const result = typeCheck(statements);

  assertEqual(
    result.errors,
    [],
    "No type errors expected for numeric addition",
  );
});

test("Detect type mismatch in binary operation", () => {
  const statements = compile(
    'const x = 5; const y = "hello"; const z = x + y;',
  );
  const result = typeCheck(statements);

  assert(
    result.errors.length === 1 &&
      result.errors[0].message.includes("Type mismatch"),
    "Should report type mismatch error",
  );
});

test("Type-check multiplication operation", () => {
  const statements = compile("const x = 5; const y = 10; const z = x * y;");
  const result = typeCheck(statements);

  assertEqual(
    result.errors,
    [],
    "No type errors expected for numeric multiplication",
  );
});

test("Detect type mismatch in multiplication", () => {
  const statements = compile(
    'const x = 5; const y = "hello"; const z = x * y;',
  );
  const result = typeCheck(statements);

  assert(
    result.errors.length === 1 &&
      result.errors[0].message.includes("Type mismatch"),
    "Should report type mismatch error",
  );
});

test("Type-check ternary expression with matching types", () => {
  const statements = compile("const x = true; const y = x ? 1 : 2;");
  const result = typeCheck(statements);

  assertEqual(
    result.errors,
    [],
    "No type errors expected for ternary with matching types",
  );
});

test("Detect type mismatch in ternary condition", () => {
  const statements = compile("const x = 5; const y = x ? 1 : 2;");
  const result = typeCheck(statements);

  assert(
    result.errors.length === 1 &&
      result.errors[0].message.includes("condition"),
    "Error message should mention condition must be Boolean",
  );
});

test("Detect type mismatch in ternary branches", () => {
  const statements = compile('const x = true; const y = x ? 1 : "hello";');
  const result = typeCheck(statements);

  assert(
    result.errors.length === 1 && result.errors[0].message.includes("branches"),
    "Error message should mention branches must have same type",
  );
});

test("Type-check array literals with consistent types", () => {
  const statements = compile(
    "const x = 1; const y = 2; const arr = [x, y, 3];",
  );
  const result = typeCheck(statements);

  assertEqual(
    result.errors,
    [],
    "No type errors expected for array with consistent types",
  );
});

test("Detect type mismatch in array literals", () => {
  const statements = compile(
    'const x = 1; const y = "hello"; const arr = [x, y, 3];',
  );
  const result = typeCheck(statements);

  assert(
    result.errors.length === 1 && result.errors[0].message.includes("array"),
    "Error message should mention array element type consistency",
  );
});

test("Type-check function with compatible argument types", () => {
  const statements = compile(`
    const add = (x) => { return x + 1; };
    const result = add(5);
  `);
  const result = typeCheck(statements);

  assertEqual(
    result.errors,
    [],
    "No type errors expected for function with compatible arg",
  );
});

test("Type-check named function call stored in scope with type verification", () => {
  const statements = compile(`
    const processNumber = (x) => { return x * 2; };
    const storeFunction = processNumber;
    const result = storeFunction(10);
    // This will fail if return type inference doesn't work
    const checkType = result + 5;
  `);
  const result = typeCheck(statements);

  assertEqual(
    result.errors,
    [],
    "No type errors expected when calling a named function from scope with correct return type",
  );

  // Now verify with a type mismatch to ensure branch is working
  const statementsWithMismatch = compile(`
    const processString = (x) => { return "string result"; };
    const storeFunction = processString;
    const result = storeFunction("hello");
    // This should fail if the branch is working correctly
    const checkType = result * 10;
  `);
  const resultWithMismatch = typeCheck(statementsWithMismatch);

  assert(
    resultWithMismatch.errors.length === 1 &&
      resultWithMismatch.errors[0].message.includes("Type mismatch"),
    "Should report type mismatch when using string return value in numeric operation",
  );
});

reportTestFailures();
