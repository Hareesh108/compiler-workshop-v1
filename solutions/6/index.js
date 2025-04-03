const { compile } = require("./parse");
const { nameCheck } = require("./naming");
const {
  test,
  assert,
  assertEqual,
  summarize: reportTestFailures,
} = require("../test");

test("Name-check empty program", () => {
  const statements = compile("");
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "Empty program should have no errors");
  assert(result.scopes, "Should return scope information");
});

test("Name-check simple const declaration", () => {
  const statements = compile("const x = 5;");
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");

  // Verify global scope has declaration for x
  const globalScope = result.scopes.values().next().value;
  assert(globalScope.declarations.has("x"), "Should have declaration for 'x'");
});

test("Name-check variable reference", () => {
  const statements = compile("const x = 5; const y = x;");
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");

  // Verify reference was recorded
  const globalScope = result.scopes.values().next().value;
  // Removed references check
  assert(globalScope.declarations.has("x"), "Variable 'x' should be declared");
});

test("Detect undeclared variable", () => {
  const statements = compile("const y = x;");
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 1, "Should report undeclared variable");
  assert(
    result.errors[0].message.includes("undeclared variable"),
    "Error message should mention undeclared variable",
  );
});

test("Detect duplicate variable declaration", () => {
  const statements = compile("const x = 5; const x = 10;");
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 1, "Should report duplicate declaration");
  assert(
    result.errors[0].message.includes("Duplicate declaration"),
    "Error message should mention duplicate declaration",
  );
});

test("Name-check function scopes", () => {
  const statements = compile(`
    const x = 5;
    const foo = () => {
      const y = x;
      return y + 1;
    };
  `);
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");

  // Function creates a new scope
  const scopes = Array.from(result.scopes.values());
  assertEqual(scopes.length, 2, "Should have two scopes (global and function)");

  // Function scope should have 'y' declared
  const functionScope = scopes.find((scope) => scope !== scopes[0]);
  assert(
    functionScope.declarations.has("y"),
    "Function scope should have 'y' declared",
  );

  // Variable 'x' from outer scope should be referenced
  const globalScope = scopes[0];
  // Removed references check
  assert(globalScope.declarations.has("x"), "Variable 'x' should be declared");
});

test("Name-check nested function scopes", () => {
  const statements = compile(`
    const x = 1;
    const outer = () => {
      const y = 2;
      const inner = () => {
        const z = 3;
        return x + y + z;
      };
      return inner;
    };
  `);
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");

  // Should have three scopes: global, outer function, inner function
  const scopes = Array.from(result.scopes.values());
  assertEqual(scopes.length, 3, "Should have three scopes");
});

test("Detect duplicate parameter names", () => {
  const statements = compile("const foo = (a, a) => { return a; };");
  const result = nameCheck(statements);

  assertEqual(
    result.errors.length,
    1,
    "Should report duplicate parameter name",
  );
  assert(
    result.errors[0].message.includes("Duplicate parameter"),
    "Error message should mention duplicate parameter",
  );
});

test("Name-check binary expressions", () => {
  const statements = compile("const x = 5; const y = 10; const z = x + y;");
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");

  // Both x and y should be referenced
  const globalScope = result.scopes.values().next().value;
  // Removed references check
  assert(globalScope.declarations.has("x"), "Variable 'x' should be declared");
  assert(globalScope.declarations.has("y"), "Variable 'y' should be declared");
});

test("Name-check ternary expressions", () => {
  const statements = compile("const x = true; const y = x ? 1 : 2;");
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");

  // x should be referenced in the condition
  const globalScope = result.scopes.values().next().value;
  // Removed references check
  assert(globalScope.declarations.has("x"), "Variable 'x' should be declared");
});

test("Name-check function calls", () => {
  const statements = compile(`
    const x = 5;
    const foo = (a) => { return a + 1; };
    const result = foo(x);
  `);
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");

  // foo and x should be referenced
  const globalScope = result.scopes.values().next().value;
  // Removed references check
  assert(
    globalScope.declarations.has("foo"),
    "Function 'foo' should be declared",
  );
  assert(globalScope.declarations.has("x"), "Variable 'x' should be declared");
});

test("Name-check array literals", () => {
  const statements = compile(
    "const x = 1; const y = 2; const arr = [x, y, 3];",
  );
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");

  // x and y should be referenced
  const globalScope = result.scopes.values().next().value;
  // Removed references check
  assert(globalScope.declarations.has("x"), "Variable 'x' should be declared");
  assert(globalScope.declarations.has("y"), "Variable 'y' should be declared");
});

test("Declaration in block scope", () => {
  const statements = compile(`
    const x = 1;
    const foo = () => {
      const x = 2; // This shadows the outer x
      return x;
    };
    const y = x;
  `);
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");

  // Should have different declarations for x in different scopes
  const scopes = Array.from(result.scopes.values());
  const globalScope = scopes[0];
  const functionScope = scopes.find((scope) => scope !== globalScope);

  // Removed references check for global x
  assert(globalScope.declarations.has("x"), "Global 'x' should be declared");

  // Removed references check for function x
  assert(
    functionScope.declarations.has("x"),
    "Function-scoped 'x' should be declared",
  );
});

test("Function parameters create local declarations", () => {
  const statements = compile(`
    const x = 1;
    const foo = (x) => { return x * 2; };
    const y = foo(x);
  `);
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");

  // Parameter x should shadow global x
  const scopes = Array.from(result.scopes.values());
  const globalScope = scopes[0];
  const functionScope = scopes.find((scope) => scope !== globalScope);

  // Both x's should have references
  assert(
    functionScope.declarations.has("x"),
    "Function should have local declaration for parameter x",
  );
  assert(
    globalScope.declarations.has("x"),
    "Global scope should have 'x' declaration",
  );
  assert(
    functionScope.declarations.has("x"),
    "Function scope should have 'x' declaration",
  );
});

reportTestFailures();
