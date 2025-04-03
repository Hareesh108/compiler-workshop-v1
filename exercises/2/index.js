const { compile } = require("./parse");
const { nameCheck } = require("./naming");
const {
  test,
  assert,
  assertEqual,
  summarize: reportTestFailures,
} = require("../test");

// Naming tests
test("Name-check empty program", () => {
  const statements = compile("");
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "Empty program should have no errors");
});

test("Name-check simple const declaration", () => {
  const statements = compile("const x = 5;");
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");
});

test("Name-check variable reference", () => {
  const statements = compile("const x = 5; const y = x;");
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");
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
    result.errors[0].message.includes("Duplicate"),
    "Error message should mention duplicate parameter",
  );
});

test("Name-check binary expressions", () => {
  const statements = compile("const x = 5; const y = 10; const z = x + y;");
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");
});

test("Name-check ternary expressions", () => {
  const statements = compile("const x = true; const y = x ? 1 : 2;");
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");
});

test("Name-check function calls", () => {
  const statements = compile(`
    const x = 5;
    const foo = (a) => { return a + 1; };
    const result = foo(x);
  `);
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");
});

test("Name-check array literals", () => {
  const statements = compile(
    "const x = 1; const y = 2; const arr = [x, y, 3];",
  );
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");
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
});

test("Function parameters create local declarations", () => {
  const statements = compile(`
    const x = 1;
    const foo = (x) => { return x * 2; };
    const y = foo(x);
  `);
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected");
});

// Additional tests that verify no naming errors in valid situations
test("Variables in different scopes with same name", () => {
  const statements = compile(`
    const x = 1;
    const foo = () => {
      const x = 2;
      return x;
    };
    const bar = () => {
      const x = 3;
      return x;
    };
  `);
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected when variables with same name are in different scopes");
});

test("Nested function accessing variables from multiple outer scopes", () => {
  const statements = compile(`
    const a = 1;
    const outer = () => {
      const b = 2;
      const middle = () => {
        const c = 3;
        const inner = () => {
          return a + b + c;
        };
        return inner();
      };
      return middle();
    };
  `);
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected when accessing variables from multiple outer scopes");
});

test("Function parameters should not conflict with outer scope", () => {
  const statements = compile(`
    const calculate = (x, y) => {
      return x + y;
    };
    const x = 10;
    const y = 20;
    const result = calculate(x, y);
  `);
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected when function parameters have same names as outer variables");
});

test("Array access with valid variable names", () => {
  const statements = compile(`
    const arr = [1, 2, 3];
    const i = 1;
    const value = arr;
  `);
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected when using valid variable names in array access");
});

test("Complex nested expressions with valid variables", () => {
  const statements = compile(`
    const a = 1;
    const b = 2;
    const c = 3;
    const result = a + b * c;
  `);
  const result = nameCheck(statements);

  assertEqual(result.errors.length, 0, "No errors expected with complex nested expressions using valid variables");
});

reportTestFailures();
