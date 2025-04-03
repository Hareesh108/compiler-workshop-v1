/**
 * Simple Compiler Frontend
 *
 * This module parses a tiny subset of JavaScript and generates an Abstract Syntax Tree (AST).
 * It serves as the foundation for our compiler pipeline, which includes:
 *
 * 1. Lexical Analysis (Tokenization)
 * 2. Parsing (AST Generation)
 * 3. Name Resolution (Variable Scoping)
 * 4. Type Checking (Hindley-Milner Type Inference)
 *
 * Supported language features:
 * - Primitive types: strings, numbers, and booleans
 * - Variable declarations with `const`
 * - Arrow functions with single-parameter and multi-parameter forms
 * - Return statements (must be the last statement in a function body)
 * - Ternary expressions (condition ? then : else)
 * - Binary expressions (+ operator for numeric values)
 * - Function calls
 */

// Single source of truth for token patterns and whitespace regex
// Defined at the top level of the file
const WHITESPACE_REGEX = /^\s+/;
const TOKEN_PATTERNS = [
  // Comments
  { type: "COMMENT", regex: /^\/\/.*?(?:\n|$)/ }, // Single-line comments
  { type: "COMMENT", regex: /^\/\*[\s\S]*?\*\// }, // Multi-line comments

  // Keywords
  { type: "CONST", regex: /^const\b/ }, // const keyword
  { type: "RETURN", regex: /^return\b/ }, // return keyword

  // Type annotation keywords (must come before other identifiers)
  { type: "TYPE_NUMBER", regex: /^number\b/ }, // TypeScript's number type
  { type: "TYPE_STRING", regex: /^string\b/ }, // TypeScript's string type
  { type: "TYPE_BOOLEAN", regex: /^boolean\b/ }, // TypeScript's boolean type
  { type: "TYPE_ARRAY", regex: /^Array\b/ }, // Array type
  { type: "TYPE_VOID", regex: /^void\b/ }, // Void type
  { type: "TYPE_INT", regex: /^Void\b/ }, // Our Void type
  { type: "TYPE_FLOAT", regex: /^Float\b/ }, // Our Float type
  { type: "TYPE_BOOL", regex: /^Bool\b/ }, // Our Bool type
  { type: "TYPE_UNIT", regex: /^Unit\b/ }, // Our Unit type

  // Operators and punctuation
  { type: "ARROW", regex: /^=>/ }, // => for arrow functions
  { type: "TERNARY", regex: /^\?/ }, // ? for ternary expressions
  { type: "COLON", regex: /^:/ }, // : for ternary expressions and type annotations
  { type: "EQUAL", regex: /^=/ }, // = for assignments
  { type: "PIPE", regex: /^\|/ }, // | for union types
  { type: "LESS_THAN", regex: /^</ }, // < for generic types
  { type: "GREATER_THAN", regex: /^>/ }, // > for generic types
  { type: "PLUS", regex: /^\+/ }, // + for addition
  { type: "LEFT_PAREN", regex: /^\(/ }, // (
  { type: "RIGHT_PAREN", regex: /^\)/ }, // )
  { type: "LEFT_CURLY", regex: /^\{/ }, // {
  { type: "RIGHT_CURLY", regex: /^\}/ }, // }
  { type: "LEFT_BRACKET", regex: /^\[/ }, // [
  { type: "RIGHT_BRACKET", regex: /^\]/ }, // ]
  { type: "COMMA", regex: /^,/ }, // , for function arguments
  { type: "SEMICOLON", regex: /^;/ }, // ; for statement endings

  // Literals and identifiers
  { type: "BOOLEAN", regex: /^(true|false)\b/ }, // Boolean literals
  { type: "IDENTIFIER", regex: /^[a-zA-Z_][a-zA-Z0-9_]*/ }, // Variable and function names
  { type: "NUMBER", regex: /^[0-9]+(\.[0-9]+)?/ }, // Numeric literals
  { type: "STRING", regex: /^"([^"\\]|\\.)*("|$)/ }, // String literals with double quotes
  { type: "STRING", regex: /^'([^'\\]|\\.)*(\'|$)/ }, // String literals with single quotes
];

// Initialize the global CompilerModule in browser environment
if (typeof window !== "undefined") {
  if (!window.CompilerModule) {
    window.CompilerModule = {};
  }

  // Make patterns available in browser
  window.CompilerModule.TOKEN_PATTERNS = TOKEN_PATTERNS;
  window.CompilerModule.WHITESPACE_REGEX = WHITESPACE_REGEX;
}

/**
 * Lexical Analysis (Tokenization)
 *
 * The first phase of compilation is breaking the source code into tokens.
 * A token is a minimal, meaningful unit of code like a keyword, identifier,
 * or punctuation.
 *
 * @param {string} sourceCode - The raw source code to tokenize
 * @param {Object} [options] - Optional configuration
 * @param {Function} [options.onToken] - Callback function triggered when a token is produced
 * @returns {Array} - A list of token objects
 */
function tokenize(sourceCode, options = {}) {
  const tokens = [];
  let position = 0; // Current position in the source code
  const onToken = options.onToken || (() => {}); // Default to no-op if no callback provided

  /**
   * Helper function to skip over whitespace characters
   * Whitespace doesn't affect the program's meaning, so we ignore it
   * Using the global WHITESPACE_REGEX constant
   */
  function skipWhitespace() {
    const match = sourceCode.slice(position).match(WHITESPACE_REGEX);
    if (match) {
      const whitespaceText = match[0];
      onToken({
        type: "WHITESPACE",
        value: whitespaceText,
        position,
        length: whitespaceText.length,
        consumedText: whitespaceText,
      });
      position += whitespaceText.length;
    }
  }

  // Main tokenization loop: process the source code until the end
  while (position < sourceCode.length) {
    // Skip any whitespace before the next token
    skipWhitespace();

    // If we've reached the end after skipping whitespace, exit the loop
    if (position >= sourceCode.length) {
      break;
    }

    let matched = false;

    // Try to match the source code against each token pattern
    for (const pattern of TOKEN_PATTERNS) {
      // We use .slice() to get the remaining source code from our current position
      // Then try to match it against the pattern's regex
      const match = sourceCode.slice(position).match(pattern.regex);

      if (match) {
        const value = match[0];
        const startPosition = position;

        // Skip comments, don't add them to the token stream
        if (pattern.type === "COMMENT") {
          // Emit comment event before changing position
          onToken({
            type: "COMMENT",
            value,
            position: startPosition,
            length: value.length,
            consumedText: value,
          });

          position += value.length;
          matched = true;
          break;
        }

        // Create a token object with:
        // - type: the category of token (e.g., "IDENTIFIER", "NUMBER")
        // - value: the actual text from the source code
        // - position: where in the source this token appears
        const token = {
          type: pattern.type,
          value,
          position: startPosition,
        };

        tokens.push(token);

        // Emit token event before changing position
        onToken({
          ...token,
          length: value.length,
          consumedText: value,
        });

        // Advance our position by the length of the matched token
        position += value.length;
        matched = true;
        break;
      }
    }

    // If no token pattern matches, we have an error in the source code
    if (!matched) {
      throw new Error(
        `Unexpected character at position ${position}: "${sourceCode.charAt(position)}"`,
      );
    }
  }

  // Add a special End-Of-File token to mark the end of the source
  // This simplifies the parser logic by avoiding special cases for the end
  const eofToken = { type: "EOF", position };
  tokens.push(eofToken);

  // Emit EOF token event
  onToken({
    ...eofToken,
    length: 0,
    consumedText: "",
  });

  return tokens;
}

/**
 * Syntax Analysis (Parsing)
 *
 * The second phase of compilation is parsing the token stream into an Abstract Syntax Tree (AST).
 * The AST represents the structure of the code, with nodes for different syntax constructs.
 *
 * @param {Array} tokens - A list of tokens from the tokenizer
 * @param {Object} [options] - Optional configuration
 * @param {Function} [options.onNode] - Callback function triggered when an AST node is produced
 * @returns {Object} - The root node of the Abstract Syntax Tree
 */
function parse(tokens, options = {}) {
  let current = 0; // Current token index
  const onNode = options.onNode || (() => {}); // Default to no-op if no callback provided

  /**
   * Look at the current token without consuming it
   * This is useful for making decisions about how to parse without advancing
   */
  function peek() {
    return tokens[current];
  }

  /**
   * Consume the current token and advance to the next one
   * We use this when we've decided a token belongs to what we're parsing
   */
  function next() {
    return tokens[current++];
  }

  /**
   * Check if the current token is of a specific type
   * This helps us decide which parsing rule to apply
   */
  function check(type) {
    return peek().type === type;
  }

  /**
   * Expect the current token to be of a specific type
   * If it is, consume it and return it; otherwise, throw an error
   * This is used when the grammar requires a specific token at a certain position
   */
  function expect(type, message) {
    if (check(type)) {
      return next();
    }
    // If we don't find what we expect, report a syntax error
    throw new Error(
      message ||
        `Expected ${type} but got ${peek().type} at position ${peek().position}`,
    );
  }

  /**
   * Parse an entire program
   * A program is a sequence of statements
   */
  function parseProgram() {
    const statements = [];

    // Emit an event for the program start
    onNode({
      type: "ProgramStart",
      position: peek().position,
    });

    while (!check("EOF")) {
      try {
        statements.push(parseStatement());
      } catch (error) {
        // Skip to the next statement on error
        console.error("Parse error:", error);
        while (
          current < tokens.length &&
          !check("SEMICOLON") &&
          !check("EOF")
        ) {
          next();
        }
        if (check("SEMICOLON")) next();
      }
    }

    // Create the program node
    const programNode = {
      type: "Program",
      body: statements,
    };

    // Emit an event for the completed program
    onNode({
      type: "ProgramComplete",
      node: programNode,
      position: tokens[tokens.length - 1].position,
    });

    return programNode;
  }

  /**
   * Parse a statement
   * In our simple language, statements are:
   * - const declarations (const x = ...)
   * - return statements (return ...)
   * - expressions (anything that produces a value)
   */
  function parseStatement() {
    // Emit an event for statement start
    onNode({
      type: "StatementStart",
      position: peek().position,
    });

    let statement;
    if (check("CONST")) {
      statement = parseConstDeclaration();
    } else if (check("RETURN")) {
      statement = parseReturnStatement();
    } else {
      throw new Error(`Unexpected token type: ${peek().type}`);
    }

    // Eat the semicolon if present
    if (check("SEMICOLON")) {
      next();
    }

    // Emit an event for statement complete
    onNode({
      type: "StatementComplete",
      node: statement,
      position: tokens[current - 1].position,
    });

    return statement;
  }

  /**
   * Parse a return statement
   *
   * return;          // Return without a value
   * return expression;  // Return with a value
   */
  function parseReturnStatement() {
    // Emit an event for return statement start
    const startPosition = peek().position;
    onNode({
      type: "ReturnStatementStart",
      position: startPosition,
    });

    // Consume the 'return' keyword
    expect("RETURN", "Expected 'return' keyword");

    let argument = parseExpression();

    const returnStatement = {
      type: "ReturnStatement",
      argument,
    };

    // Emit an event for return statement complete
    onNode({
      type: "ReturnStatementComplete",
      node: returnStatement,
      position: peek() ? peek().position : tokens[current - 1].position,
    });

    return returnStatement;
  }

  /**
   * Parse a const declaration
   *
   * const identifier = expression;
   * const identifier: Type = expression;
   */
  function parseConstDeclaration() {
    // Emit event for const declaration start
    const startPosition = peek().position;
    onNode({
      type: "ConstDeclarationStart",
      position: startPosition,
    });

    // Consume the 'const' keyword
    expect("CONST", "Expected 'const' keyword");

    // Get the variable name
    const id = {
      type: "Identifier",
      name: expect("IDENTIFIER", "Expected variable name").value,
    };

    // Emit event for identifier
    onNode({
      type: "Identifier",
      node: id,
      position: tokens[current - 1].position,
    });

    // Parse type annotation if present (with colon)
    let typeAnnotation = null;
    if (check("COLON")) {
      next(); // Consume the colon
      typeAnnotation = parseTypeAnnotation();
    }

    // Consume the equals sign
    expect("EQUAL", "Expected '=' after variable name");

    // Parse the initializer expression
    const init = parseExpression();

    // Create the const declaration node
    const constDeclaration = {
      type: "ConstDeclaration",
      id,
      init,
      typeAnnotation,
    };

    // Emit event for const declaration complete
    onNode({
      type: "ConstDeclarationComplete",
      node: constDeclaration,
      position: peek() ? peek().position : tokens[current - 1].position,
    });

    return constDeclaration;
  }

  /**
   * Parse an expression (anything that produces a value)
   * This function delegates to more specific expression parsers
   * based on a precedence hierarchy
   */
  function parseExpression() {
    // Emit event for expression start
    const startPosition = peek().position;
    onNode({
      type: "ExpressionStart",
      position: startPosition,
    });

    const expression = parseTernary();

    // Emit event for expression complete
    onNode({
      type: "ExpressionComplete",
      node: expression,
      position: peek() ? peek().position : tokens[current - 1].position,
    });

    return expression;
  }

  /**
   * Parse a ternary (conditional) expression
   *
   * condition ? trueValue : falseValue
   *
   * This has lower precedence than binary expressions
   */
  function parseTernary() {
    // Parse the condition (which may be any expression)
    const condition = parseBinaryExpression();

    // If we see a question mark, this is a ternary expression
    if (check("TERNARY")) {
      // Emit event for ternary start
      onNode({
        type: "TernaryStart",
        position: peek().position,
      });

      // Consume the question mark
      next();

      // Parse the expression to use if condition is true
      const consequent = parseExpression();

      // Consume the colon
      expect("COLON", "Expected ':' in ternary expression");

      // Parse the expression to use if condition is false
      const alternate = parseExpression();

      // Create the ternary expression node
      const ternary = {
        type: "ConditionalExpression",
        test: condition,
        consequent,
        alternate,
      };

      // Emit event for ternary complete
      onNode({
        type: "TernaryComplete",
        node: ternary,
        position: peek() ? peek().position : tokens[current - 1].position,
      });

      return ternary;
    }

    // If no question mark, just return the binary expression
    return condition;
  }

  /**
   * Parse binary expressions like a + b + c
   *
   * This implementation handles chains of the same operator (a + b + c)
   * by building left-associative trees.
   */
  function parseBinaryExpression() {
    // Parse the left-hand side of the expression
    let left = parsePrimary();

    // If we see a plus sign, this is a binary expression
    while (check("PLUS")) {
      // Emit event for binary expression start
      onNode({
        type: "BinaryExpressionStart",
        position: peek().position,
      });

      // Get the operator
      const operator = next().value;

      // Parse the right-hand side
      const right = parsePrimary();

      // Create the binary expression node
      left = {
        type: "BinaryExpression",
        left,
        operator,
        right,
      };

      // Emit event for binary expression complete
      onNode({
        type: "BinaryExpressionComplete",
        node: left,
        position: peek() ? peek().position : tokens[current - 1].position,
      });
    }

    return left;
  }

  /**
   * Parse a function expression
   *
   * Only supports block statement bodies with return statements:
   * (param1, param2) => { statements }
   *
   * Also handles TypeScript-style type annotations:
   * (param: Type): ReturnType => { statements }
   */
  function parseFunction() {
    // Emit event for function start
    const startPosition = peek().position;
    onNode({
      type: "FunctionStart",
      position: startPosition,
    });

    // Start with a left parenthesis
    expect("LEFT_PAREN", "Expected '(' at start of arrow function");

    const params = [];

    do {
      // Parse the parameter name
      const paramToken = expect("IDENTIFIER", "Expected parameter name");

      // Start with a parameter without a type annotation
      let param = {
        type: "Identifier",
        name: paramToken.value,
      };

      // Emit event for parameter identifier
      onNode({
        type: "Identifier",
        node: param,
        position: tokens[current - 1].position,
      });

      // Check for type annotation (with colon)
      if (check("COLON")) {
        next(); // Consume the colon

        // Parse the type annotation
        const typeAnnotation = parseTypeAnnotation();

        // Add the type annotation to the parameter
        param.typeAnnotation = typeAnnotation;
      }

      // Add this parameter to the list
      params.push(param);

      // Continue if we see a comma
    } while (check("COMMA") && next());

    // End with a right parenthesis
    expect("RIGHT_PAREN", "Expected ')' after parameters");

    // Parse the return type annotation if present
    let returnType = null;
    if (check("COLON")) {
      next(); // Consume the colon
      returnType = parseTypeAnnotation();
    }

    // Expect the arrow token
    expect("ARROW", "Expected '=>' after parameters");

    // Parse the function body, which can be an expression or a block
    let body;
    let expression = false;

    if (check("LEFT_CURLY")) {
      // Block body with curly braces - parse as block statement
      next(); // Consume the {

      const blockStatements = [];
      while (!check("RIGHT_CURLY") && !check("EOF")) {
        try {
          blockStatements.push(parseStatement());
        } catch (error) {
          // Skip to the next statement on error
          console.error("Parse error in function body:", error);
          while (
            current < tokens.length &&
            !check("SEMICOLON") &&
            !check("RIGHT_CURLY") &&
            !check("EOF")
          ) {
            next();
          }
          if (check("SEMICOLON")) next();
        }
      }

      expect("RIGHT_CURLY", "Expected '}' at end of function body");

      body = {
        type: "BlockStatement",
        body: blockStatements,
      };

      // Emit event for block statement
      onNode({
        type: "BlockStatement",
        node: body,
        position: tokens[current - 1].position,
      });
    } else {
      // Always require block statement with return
      throw new Error(`Functions require a block body with explicit return statements`);
    }

    // Create the function node
    const functionNode = {
      type: "ArrowFunctionExpression",
      params,
      body,
      expression, // true if body is an expression, false if it's a block
      returnType,
    };

    // Emit event for function complete
    onNode({
      type: "FunctionComplete",
      node: functionNode,
      position: peek() ? peek().position : tokens[current - 1].position,
    });

    return functionNode;
  }

  /**
   * Parse array literals
   *
   * @returns {Object} - ArrayLiteral node with elements
   */
  function parseArrayLiteral() {
    const elements = [];
    const position = peek().position;

    next(); // consume LEFT_BRACKET

    // Empty array case: []
    if (check("RIGHT_BRACKET")) {
      next(); // consume RIGHT_BRACKET
      return {
        type: "ArrayLiteral",
        elements,
        position,
      };
    }

    // Parse elements until we hit the closing bracket
    do {
      // Parse an element (expression)
      elements.push(parseExpression());

      // If we see a comma, expect another element
      if (check("COMMA")) {
        next(); // consume comma
      } else {
        break;
      }
    } while (!check("RIGHT_BRACKET") && !check("EOF"));

    expect("RIGHT_BRACKET", "Expected closing bracket for array literal");

    return {
      type: "ArrayLiteral",
      elements,
      position,
    };
  }

  /**
   * Parse array member access expression (e.g. arr[0])
   *
   * @param {Object} object - The array object being accessed
   * @returns {Object} - MemberExpression node
   */
  function parseMemberExpression(object) {
    next(); // consume LEFT_BRACKET

    // Parse the index expression
    const index = parseExpression();

    expect("RIGHT_BRACKET", "Expected closing bracket for array access");

    const node = {
      type: "MemberExpression",
      object,
      index,
      position: object.position,
    };

    // Handle chained access like arr[0][1]
    if (check("LEFT_BRACKET")) {
      return parseMemberExpression(node);
    }

    // Handle function call on array element like arr[0]()
    if (check("LEFT_PAREN")) {
      return parseCallExpression(node);
    }

    return node;
  }

  /**
   * Parse a type annotation
   *
   * This parses TypeScript-style type annotations like `: number`, `: string[]`,
   * or `: Array<number>`.
   *
   * @returns {Object} - A type annotation node
   */
  function parseTypeAnnotation() {
    next(); // consume COLON

    // Parse the type
    if (check("TYPE_NUMBER") || check("TYPE_FLOAT")) {
      const token = next().type;
      const typeName = token === "TYPE_NUMBER" ? "number" : "Float";
      return {
        type: "TypeAnnotation",
        valueType: typeName,
      };
    }

    if (check("TYPE_INT")) {
      next();
      return {
        type: "TypeAnnotation",
        valueType: "Void",
      };
    }

    if (check("TYPE_STRING")) {
      next();
      return {
        type: "TypeAnnotation",
        valueType: "string",
      };
    }

    if (check("TYPE_BOOLEAN") || check("TYPE_BOOL")) {
      const token = next().type;
      const typeName = token === "TYPE_BOOLEAN" ? "boolean" : "Bool";
      return {
        type: "TypeAnnotation",
        valueType: typeName,
      };
    }

    // Explicitly reject 'any' type
    if (check("IDENTIFIER") && peek().value === "any") {
      throw new Error(
        `'any' type is not supported at position ${peek().position}`,
      );
    }

    if (check("TYPE_VOID") || check("TYPE_UNIT")) {
      const token = next().type;
      const typeName = token === "TYPE_VOID" ? "void" : "Unit";
      return {
        type: "TypeAnnotation",
        valueType: typeName,
      };
    }

    // Array<T> syntax
    if (check("TYPE_ARRAY")) {
      next(); // consume TYPE_ARRAY

      // Check for generic parameter
      if (check("LESS_THAN")) {
        next(); // consume "<"

        // Parse the element type between the < >
        if (check("TYPE_NUMBER")) {
          next(); // consume TYPE_NUMBER
          expect("GREATER_THAN", "Expected > to close Array type");

          return {
            type: "ArrayTypeAnnotation",
            elementType: { type: "TypeAnnotation", valueType: "number" },
          };
        }

        if (check("TYPE_STRING")) {
          next(); // consume TYPE_STRING
          expect("GREATER_THAN", "Expected > to close Array type");

          return {
            type: "ArrayTypeAnnotation",
            elementType: { type: "TypeAnnotation", valueType: "string" },
          };
        }

        if (check("TYPE_BOOLEAN")) {
          next(); // consume TYPE_BOOLEAN
          expect("GREATER_THAN", "Expected > to close Array type");

          return {
            type: "ArrayTypeAnnotation",
            elementType: { type: "TypeAnnotation", valueType: "boolean" },
          };
        }

        if (check("IDENTIFIER")) {
          // Check for 'any' type before consuming it
          if (peek().value === "any") {
            throw new Error(
              `'any' type is not supported at position ${peek().position}`,
            );
          }

          const baseType = next().value;
          expect("GREATER_THAN", "Expected > to close Array type");

          return {
            type: "ArrayTypeAnnotation",
            elementType: { type: "TypeAnnotation", valueType: baseType },
          };
        }

        // More complex element type
        const elementType = parseTypeAnnotation();
        expect("GREATER_THAN", "Expected > to close Array type");

        return {
          type: "ArrayTypeAnnotation",
          elementType,
        };
      }

      // Just "Array" without generic parameter
      return {
        type: "TypeAnnotation",
        valueType: "Array",
      };
    }

    // T[] syntax
    if (check("IDENTIFIER")) {
      const baseType = {
        type: "TypeAnnotation",
        valueType: next().value,
      };

      // Check for array bracket notation
      if (check("LEFT_BRACKET")) {
        next(); // consume LEFT_BRACKET
        expect("RIGHT_BRACKET", "Expected closing bracket for array type");
        return {
          type: "ArrayTypeAnnotation",
          elementType: baseType,
        };
      }

      return baseType;
    }

    // Function type syntax: (param: Type) => ReturnType
    if (check("LEFT_PAREN")) {
      const paramTypes = parseParameterTypeList();
      expect("ARROW", "Expected => in function type");
      const returnType = parseTypeAnnotation();

      return {
        type: "FunctionTypeAnnotation",
        paramTypes,
        returnType,
      };
    }

    throw new Error(`Expected type annotation at position ${peek().position}`);
  }

  /**
   * Parse a list of parameter types for function type annotations
   *
   * @returns {Array} - Array of parameter type objects
   */
  function parseParameterTypeList() {
    next(); // consume LEFT_PAREN
    const params = [];

    // Empty parameter list: ()
    if (check("RIGHT_PAREN")) {
      next();
      return params;
    }

    // Parse parameters with types
    do {
      const paramName = expect("IDENTIFIER", "Expected parameter name").value;
      expect("COLON", "Expected : after parameter name in type annotation");
      const paramType = parseTypeAnnotation();

      params.push({
        name: paramName,
        typeAnnotation: paramType,
      });

      if (check("COMMA")) {
        next(); // consume COMMA
      } else {
        break;
      }
    } while (!check("RIGHT_PAREN") && !check("EOF"));

    expect(
      "RIGHT_PAREN",
      "Expected closing parenthesis in parameter type list",
    );
    return params;
  }

  /**
   * Parse primary expressions - the most basic building blocks like:
   * - identifiers (variable names)
   * - literals (numbers, strings, booleans, arrays)
   * - function calls
   * - array access expressions
   * - parenthesized expressions
   */
  function parsePrimary() {
    // Emit event for primary expression start
    const startPosition = peek().position;
    onNode({
      type: "PrimaryStart",
      position: startPosition,
    });

    let node;

    // Check what kind of primary expression this is
    if (check("LEFT_PAREN")) {
      // This could be a parenthesized expression or an arrow function

      // Look ahead to see if this is an arrow function
      // We check by looking for ')' followed by '=>'
      let isArrowFunction = false;

      // Save the current position so we can rewind
      const savedPosition = current;

      try {
        // Skip the '('
        next();

        // Check for empty parameter list
        if (check("RIGHT_PAREN")) {
          next(); // Skip the ')'
          if (check("ARROW")) {
            isArrowFunction = true;
          }
        } else {
          // Skip an identifier (potential parameter)
          if (check("IDENTIFIER")) {
            next();

            // Check for type annotation
            if (check("COLON")) {
              next(); // Skip the colon
              // Skip the type
              if (
                check("TYPE_NUMBER") ||
                check("TYPE_STRING") ||
                check("TYPE_BOOLEAN") ||
                check("TYPE_VOID") ||
                check("TYPE_ARRAY") ||
                check("IDENTIFIER")
              ) {
                next();
              }
            }

            // Skip comma and more parameters if present
            while (check("COMMA")) {
              next(); // Skip the comma

              // Skip another parameter
              if (check("IDENTIFIER")) {
                next();

                // Skip type annotation if present
                if (check("COLON")) {
                  next(); // Skip the colon
                  // Skip the type
                  if (
                    check("TYPE_NUMBER") ||
                    check("TYPE_STRING") ||
                    check("TYPE_BOOLEAN") ||
                    check("TYPE_VOID") ||
                    check("TYPE_ARRAY") ||
                    check("IDENTIFIER")
                  ) {
                    next();
                  }
                }
              }
            }

            // Now check for ')' followed by '=>'
            if (check("RIGHT_PAREN")) {
              next(); // Skip the ')'

              // Check for optional return type
              if (check("COLON")) {
                next(); // Skip the colon
                // Skip the type
                if (
                  check("TYPE_NUMBER") ||
                  check("TYPE_STRING") ||
                  check("TYPE_BOOLEAN") ||
                  check("TYPE_VOID") ||
                  check("TYPE_ARRAY") ||
                  check("IDENTIFIER")
                ) {
                  next();
                }
              }

              if (check("ARROW")) {
                isArrowFunction = true;
              }
            }
          }
        }
      } catch (e) {
        // If we hit an error, it's not an arrow function
      }

      // Reset to where we started
      current = savedPosition;

      if (isArrowFunction) {
        // Parse as a function
        node = parseFunction();
      } else {
        // Parse as a parenthesized expression
        next(); // Skip the '('
        node = parseExpression();
        expect("RIGHT_PAREN", "Expected ')' after expression");
      }
    } else if (check("STRING")) {
      // String literal
      const token = next();
      node = {
        type: "StringLiteral",
        value: token.value.slice(1, -1), // Remove the quotes
      };

      // Emit event for string literal
      onNode({
        type: "StringLiteral",
        node,
        position: tokens[current - 1].position,
      });
    } else if (check("NUMBER")) {
      // Number literal
      const token = next();
      const value = parseFloat(token.value);

      node = {
        type: "NumericLiteral",
        value,
      };

      // Emit event for number literal
      onNode({
        type: "NumericLiteral",
        node,
        position: tokens[current - 1].position,
      });
    } else if (check("BOOLEAN")) {
      // Boolean literal
      const token = next();
      node = {
        type: "BooleanLiteral",
        value: token.value === "true",
      };

      // Emit event for boolean literal
      onNode({
        type: "BooleanLiteral",
        node,
        position: tokens[current - 1].position,
      });
    } else if (check("IDENTIFIER")) {
      // Variable reference or function call
      const token = next();
      node = {
        type: "Identifier",
        name: token.value,
      };

      // Emit event for identifier
      onNode({
        type: "Identifier",
        node,
        position: tokens[current - 1].position,
      });

      // If the next token is a '(', this is a function call
      if (check("LEFT_PAREN")) {
        node = parseCallExpression(node);
      }
    } else if (check("LEFT_BRACKET")) {
      // Array literal
      node = parseArrayLiteral();
    } else {
      throw new Error(
        `Unexpected token type in expression: ${peek().type} at position ${peek().position}`,
      );
    }

    // Check for member expressions with dot notation
    while (check("DOT")) {
      node = parseMemberExpression(node);
    }

    // Emit event for primary expression complete
    onNode({
      type: "PrimaryComplete",
      node,
      position: peek() ? peek().position : tokens[current - 1].position,
    });

    return node;
  }

  /**
   * Parse a function call expression: callee(arg1, arg2, ...)
   *
   * @param {Object} callee - The AST node of the function being called
   * @returns {Object} - A CallExpression AST node
   */
  function parseCallExpression(callee) {
    expect("LEFT_PAREN", "Expected '(' after function name");

    const args = [];

    // Parse arguments
    do {
      args.push(parseExpression());

      // If we see a comma, continue to the next argument
    } while (check("COMMA") && next());

    expect("RIGHT_PAREN", "Expected ')' after function arguments");

    return {
      type: "CallExpression",
      callee,
      arguments: args,
    };
  }

  // Reset the token index
  current = 0;

  // Run the parser
  return parseProgram();
}

/**
 * Main compilation function that combines lexing and parsing
 *
 * This function takes source code and produces an Abstract Syntax Tree (AST)
 * without performing any semantic analysis.
 *
 * @param {string} sourceCode - The source code to compile
 * @returns {Object} - The AST representing the program
 */
function compile(sourceCode) {
  // Step 1: Tokenize the source code (lexical analysis)
  const tokens = tokenize(sourceCode);

  // Step 2: Parse the tokens into an AST (syntax analysis)
  const ast = parse(tokens);

  return ast;
}

/**
 * Compile and analyze code for static name resolution and type checking
 *
 * This function represents the full compilation pipeline:
 * 1. Lexical analysis (tokenization)
 * 2. Syntax analysis (parsing)
 * 3. Name resolution (static scoping)
 * 4. Type checking (Hindley-Milner type inference)
 *
 * @param {string} sourceCode - The source code to compile and analyze
 * @param {object} options - Analysis options
 * @returns {object} - The AST and any errors found during analysis
 */
function compileAndAnalyze(sourceCode, options = {}) {
  // Handle both object options and backward-compatible boolean option
  const { skipAnalysis = false, skipTypeCheck = false } =
    typeof options === "boolean" ? { skipAnalysis: options } : options;

  // Parse the source code into an AST
  const ast = compile(sourceCode);

  // Skip analysis if requested
  if (skipAnalysis) {
    return { ast, errors: [] };
  }

  try {
    // Step 3: Perform name resolution (analyze variable scopes)
    // This confirms all variables are declared before use and checks for duplicates
    const { analyze } = require("./analyze");
    const { ast: analyzedAst, errors: nameErrors } = analyze(ast);

    // Step 4: Perform type checking if requested
    if (!skipTypeCheck) {
      try {
        // Apply Hindley-Milner type inference algorithm
        const { typecheck } = require("./typecheck");
        return typecheck(analyzedAst, nameErrors);
      } catch (error) {
        // If typechecking fails, return just the name resolution results
        console.error("Type checking error:", error);
        return { ast: analyzedAst, errors: nameErrors };
      }
    }

    return { ast: analyzedAst, errors: nameErrors };
  } catch (error) {
    // If analysis fails entirely, return the AST without analysis
    console.error("Analysis error:", error);
    return { ast, errors: [] };
  }
}

/**
 * Full compilation pipeline: parse, analyze, and typecheck
 *
 * This is a convenience function that always performs type checking.
 *
 * @param {string} sourceCode - The source code to compile
 * @returns {object} - The AST with type annotations and any errors
 */
function compileWithTypes(sourceCode) {
  return compileAndAnalyze(sourceCode, { skipTypeCheck: false });
}

// Function to get the token patterns - can be called in browser or Node environment
function getTokenPatterns() {
  return TOKEN_PATTERNS;
}

// Function to get the whitespace regex - can be called in browser or Node environment
function getWhitespaceRegex() {
  return WHITESPACE_REGEX;
}

// Add the compiler functions to browser environment (after they're defined)
if (typeof window !== "undefined") {
  window.CompilerModule.tokenize = tokenize;
  window.CompilerModule.parse = parse;
}

// Export for Node.js environment
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    // Main compilation functions
    compile, // Just parse to AST
    compileAndAnalyze, // Parse + optional analysis
    compileWithTypes, // Parse + full analysis with types

    // Individual compiler phases for educational purposes
    tokenize, // Lexical analysis
    parse, // Syntax analysis

    // Token patterns and utilities for visualization and educational tools
    getTokenPatterns, // Function to get token patterns
    getWhitespaceRegex, // Function to get whitespace regex
    TOKEN_PATTERNS, // Direct access to token patterns
    WHITESPACE_REGEX, // Direct access to whitespace regex
  };
}
