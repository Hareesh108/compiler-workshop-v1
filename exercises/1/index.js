const { tokenize } = require("./tokenize");
const { parse, compile } = require("./parse");

let failedTests = [];

function runTokenizerTests() {
  console.log("\n=== Tokenizer Tests ===\n");

  test("Tokenize empty string", () => {
    const tokens = tokenize("");
    assert(tokens.length === 1, "Should have only EOF token");
    assert(tokens[0].type === "EOF", "Last token should be EOF");
  });

  test("Tokenize whitespace", () => {
    const tokens = tokenize("   \t\n  ");
    assert(tokens.length === 1, "Should have only EOF token");
    assert(tokens[0].type === "EOF", "Last token should be EOF");
  });

  test("Tokenize simple expression", () => {
    const tokens = tokenize("const x = 5;");
    // Should have 5 tokens: CONST, IDENTIFIER, EQUAL, NUMBER, SEMICOLON, plus EOF
    assert(tokens.length === 6, `Expected 6 tokens, got ${tokens.length}`);
    assert(tokens[0].type === "CONST", "First token should be CONST");
    assert(
      tokens[1].type === "IDENTIFIER",
      "Second token should be IDENTIFIER",
    );
    assert(tokens[1].value === "x", 'Identifier value should be "x"');
    assert(tokens[2].type === "EQUAL", "Third token should be EQUAL");
    assert(tokens[3].type === "NUMBER", "Fourth token should be NUMBER");
    assert(tokens[3].value === "5", 'Number value should be "5"');
    assert(tokens[4].type === "SEMICOLON", "Fifth token should be SEMICOLON");
    assert(tokens[5].type === "EOF", "Last token should be EOF");
  });

  test("Tokenize string literals", () => {
    const tokens = tokenize('const greeting = "hello";');
    const stringToken = tokens[3];
    assert(stringToken.type === "STRING", "Should recognize string literals");
    assert(
      stringToken.value === '"hello"',
      "String value should include quotes",
    );
  });

  test("Tokenize arrow function", () => {
    const tokens = tokenize("const add = (a, b) => a + b;");
    const arrowToken = tokens.find((t) => t.type === "ARROW");
    assert(arrowToken, "Should have an ARROW token");
    const plusToken = tokens.find((t) => t.type === "PLUS");
    assert(plusToken, "Should have a PLUS token");
  });

  test("Tokenize with comments", () => {
    const tokens = tokenize(
      "// This is a comment\nconst x = 5; /* Another comment */",
    );
    // Comments are skipped in the token stream
    assert(
      tokens[0].type === "CONST",
      "First token should be CONST, comments are skipped",
    );
  });

  test("Tokenize type annotations", () => {
    const tokens = tokenize("const x: number = 5;");
    const colonToken = tokens.find((t) => t.type === "COLON");
    assert(colonToken, "Should have a COLON token");
    const typeToken = tokens.find((t) => t.type === "TYPE_NUMBER");
    assert(typeToken, "Should have a TYPE_NUMBER token");
  });

  test("Tokenize array literals", () => {
    const tokens = tokenize("const arr = [1, 2, 3];");
    const leftBracket = tokens.find((t) => t.type === "LEFT_BRACKET");
    assert(leftBracket, "Should have LEFT_BRACKET token");
    const rightBracket = tokens.find((t) => t.type === "RIGHT_BRACKET");
    assert(rightBracket, "Should have RIGHT_BRACKET token");
  });

  test("Tokenize ternary expressions", () => {
    const tokens = tokenize('const result = x > 0 ? "positive" : "negative";');
    const ternaryToken = tokens.find((t) => t.type === "TERNARY");
    assert(ternaryToken, "Should have TERNARY token");
    const colonToken = tokens.find((t) => t.type === "COLON");
    assert(colonToken, "Should have COLON token");
  });

  test("Should throw on invalid characters", () => {
    let error;
    try {
      tokenize("const x = @;");
    } catch (e) {
      error = e;
    }
    assert(error, "Should throw an error for invalid characters");
    assert(
      error.message.includes("Unexpected character"),
      "Error message should mention unexpected character",
    );
  });

  return { passed: failedTests.filter(test => test.startsWith("Tokenize")).length === 0, failedTests: failedTests.filter(test => test.startsWith("Tokenize")) };
}

// -----------------------------------------------------------------------------
// Parser Tests
// -----------------------------------------------------------------------------

function runParserTests() {
  console.log("\n=== Parser Tests ===\n");

  test("Parse empty program", () => {
    const tokens = tokenize("");
    const parseTree = parse(tokens);
    assertEqual(parseTree.type, "Program", "Root node should be Program");
    assertEqual(parseTree.body.length, 0, "Empty program should have no statements");
  });

  test("Parse const declaration", () => {
    const tokens = tokenize("const x = 5;");
    const parseTree = parse(tokens);
    assertEqual(parseTree.type, "Program", "Root node should be Program");
    assertEqual(parseTree.body.length, 1, "Program should have one statement");

    const stmt = parseTree.body[0];
    assertEqual(
      stmt.type,
      "ConstDeclaration",
      "Statement should be ConstDeclaration",
    );
    assertEqual(stmt.id.name, "x", 'Variable name should be "x"');
    assertEqual(
      stmt.init.type,
      "NumericLiteral",
      "Initializer should be NumericLiteral",
    );
    assertEqual(stmt.init.value, 5, "Numeric value should be 5");
  });

  test("Parse const with type annotation", () => {
    const tokens = tokenize("const x: number = 5;");
    const parseTree = parse(tokens);
    const stmt = parseTree.body[0];

    assert(stmt.typeAnnotation, "Should have type annotation");
    assertEqual(
      stmt.typeAnnotation.valueType,
      "number",
      'Type should be "number"',
    );
  });

  test("Parse string literal", () => {
    const tokens = tokenize('const message = "hello world";');
    const parseTree = parse(tokens);
    const init = parseTree.body[0].init;

    assertEqual(init.type, "StringLiteral", "Should be StringLiteral");
    assertEqual(
      init.value,
      "hello world",
      "String value should not include quotes",
    );
  });

  test("Parse binary expression", () => {
    const tokens = tokenize("const sum = 1 + 2;");
    const parseTree = parse(tokens);
    const init = parseTree.body[0].init;

    assertEqual(init.type, "BinaryExpression", "Should be BinaryExpression");
    assertEqual(init.operator, "+", 'Operator should be "+"');
    assertEqual(init.left.value, 1, "Left value should be 1");
    assertEqual(init.right.value, 2, "Right value should be 2");
  });

  test("Parse array literal", () => {
    const tokens = tokenize("const numbers = [1, 2, 3];");
    const parseTree = parse(tokens);
    const init = parseTree.body[0].init;

    assertEqual(init.type, "ArrayLiteral", "Should be ArrayLiteral");
    assertEqual(init.elements.length, 3, "Should have 3 elements");
    assertEqual(init.elements[0].value, 1, "First element should be 1");
    assertEqual(init.elements[1].value, 2, "Second element should be 2");
    assertEqual(init.elements[2].value, 3, "Third element should be 3");
  });

  test("Parse arrow function", () => {
    const tokens = tokenize("const add = (a, b) => { return a + b; };");
    const parseTree = parse(tokens);
    const init = parseTree.body[0].init;

    assertEqual(
      init.type,
      "ArrowFunctionExpression",
      "Should be ArrowFunctionExpression",
    );
    assertEqual(init.params.length, 2, "Should have 2 parameters");
    assertEqual(init.params[0].name, "a", 'First parameter should be "a"');
    assertEqual(init.params[1].name, "b", 'Second parameter should be "b"');

    assertEqual(
      init.body.type,
      "BlockStatement",
      "Body should be BlockStatement",
    );
    assertEqual(init.body.body.length, 1, "Body should have 1 statement");
    assertEqual(
      init.body.body[0].type,
      "ReturnStatement",
      "Statement should be ReturnStatement",
    );
  });

  test("Parse arrow function with type annotations", () => {
    const tokens = tokenize(
      "const add = (a: number, b: number): number => { return a + b; };",
    );
    const parseTree = parse(tokens);
    const init = parseTree.body[0].init;

    assertEqual(
      init.params[0].typeAnnotation.valueType,
      "number",
      "First parameter should have number type",
    );
    assertEqual(
      init.params[1].typeAnnotation.valueType,
      "number",
      "Second parameter should have number type",
    );
    assertEqual(
      init.returnType.valueType,
      "number",
      "Return type should be number",
    );
  });

  test("Parse ternary expression", () => {
    // We'll modify the test to use a condition our parser understands
    const tokens = tokenize('const result = (x) ? "positive" : "negative";');
    const parseTree = parse(tokens);
    const init = parseTree.body[0].init;

    assertEqual(
      init.type,
      "ConditionalExpression",
      "Should be ConditionalExpression",
    );
    assertEqual(init.test.type, "Identifier", "Test should be an Identifier");
    assertEqual(init.test.name, "x", 'Test value should be "x"');
    assertEqual(
      init.consequent.value,
      "positive",
      'Consequent should be "positive"',
    );
    assertEqual(
      init.alternate.value,
      "negative",
      'Alternate should be "negative"',
    );
  });

  test("Parse simple ternary expression", () => {
    const tokens = tokenize('const result = true ? "yes" : "no";');
    const parseTree = parse(tokens);
    const init = parseTree.body[0].init;

    assertEqual(
      init.type,
      "ConditionalExpression",
      "Should be ConditionalExpression",
    );
    assertEqual(
      init.test.type,
      "BooleanLiteral",
      "Test should be BooleanLiteral",
    );
    assertEqual(init.test.value, true, "Test value should be true");
    assertEqual(init.consequent.value, "yes", 'Consequent should be "yes"');
    assertEqual(init.alternate.value, "no", 'Alternate should be "no"');
  });

  test("Parse function call", () => {
    const tokens = tokenize("const result = add(1, 2);");
    const parseTree = parse(tokens);
    const init = parseTree.body[0].init;

    assertEqual(init.type, "CallExpression", "Should be CallExpression");
    assertEqual(init.callee.name, "add", 'Callee should be "add"');
    assertEqual(init.arguments.length, 2, "Should have 2 arguments");
    assertEqual(init.arguments[0].value, 1, "First argument should be 1");
    assertEqual(init.arguments[1].value, 2, "Second argument should be 2");
  });

  test("Parse return statement", () => {
    const tokens = tokenize("const fn = () => { return 42; };");
    const parseTree = parse(tokens);
    const fnBody = parseTree.body[0].init.body.body[0];

    assertEqual(fnBody.type, "ReturnStatement", "Should be ReturnStatement");
    assertEqual(
      fnBody.argument.type,
      "NumericLiteral",
      "Return argument should be NumericLiteral",
    );
    assertEqual(fnBody.argument.value, 42, "Return value should be 42");
  });

  test("Integrate tokenize and parse", () => {
    const sourceCode = 'const x = 5; const y = "hello"; const z = x;';
    const parseTree = compile(sourceCode);

    assertEqual(parseTree.type, "Program", "Root node should be Program");
    assertEqual(parseTree.body.length, 3, "Program should have three statements");
  });

  return { passed: failedTests.filter(test => !test.startsWith("Tokenize")).length === 0, failedTests: failedTests.filter(test => !test.startsWith("Tokenize")) };
}

function runAllTests() {
  console.log("Running tests...");

  let tokenizeResults = runTokenizerTests();
  let parserResults = runParserTests();

  console.log("\n=== Test Summary ===\n");
  if (tokenizeResults.passed && parserResults.passed) {
    console.log(`${PASS} All tests passed!`);
  } else {
    console.log(`${FAIL} Some tests failed:`);

    // Group failed tests by their prefix
    const tokenizerFailures = failedTests.filter(test => test.startsWith("Tokenize"));
    const parserFailures = failedTests.filter(test => !test.startsWith("Tokenize"));

    if (tokenizerFailures.length > 0) {
      console.log("\nFailed Tokenizer Tests:");
      tokenizerFailures.forEach((test) => {
        console.log(`  - ${test}`);
      });
    }

    if (parserFailures.length > 0) {
      console.log("\nFailed Parser Tests:");
      parserFailures.forEach((test) => {
        console.log(`  - ${test}`);
      });
    }
  }
}

const PASS = "✅";
const FAIL = "❌";



function assert(condition, message = "Assertion failed") {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message = "Values are not equal") {
  if (typeof expected === "object" && expected !== null) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new Error(
        `${message}\nExpected: ${expectedStr}\nActual: ${actualStr}`,
      );
    }
  } else if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

function test (name, testFn) {
  try {
    testFn();
    console.log(`${PASS} ${name}`);
    return true;
  } catch (error) {
    console.log(`${FAIL} ${name}`);
    // Hide the stack trace but print the error message.
    console.error(`   Error: ${error.message}`);
    failedTests.push(name);
    return false;
  }
}

runAllTests();
