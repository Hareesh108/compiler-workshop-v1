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

/**
 * Lexical Analysis (Tokenization)
 *
 * The first phase of compilation is breaking the source code into tokens.
 * A token is a minimal, meaningful unit of code like a keyword, identifier,
 * or punctuation.
 *
 * @param {string} sourceCode - The raw source code to tokenize
 * @returns {Array} - A list of token objects
 */
function tokenize(sourceCode) {
  const tokens = [];
  let position = 0; // Current position in the source code

  // Regular expression to identify whitespace (spaces, tabs, newlines)
  // Expose it as a module constant for reuse in other tools
  const WHITESPACE_REGEX = /^\s+/;

  // Token patterns in order of precedence
  // ORDER MATTERS: Keywords must come before identifiers!
  // Expose these as a module constant for reuse in other tools
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

  /**
   * Helper function to skip over whitespace characters
   * Whitespace doesn't affect the program's meaning, so we ignore it
   */
  function skipWhitespace() {
    const match = sourceCode.slice(position).match(WHITESPACE_REGEX);
    if (match) {
      position += match[0].length;
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

        // Skip comments, don't add them to the token stream
        if (pattern.type === "COMMENT") {
          position += value.length;
          matched = true;
          break;
        }

        // Create a token object with:
        // - type: the category of token (e.g., "IDENTIFIER", "NUMBER")
        // - value: the actual text from the source code
        // - position: where in the source this token appears
        tokens.push({
          type: pattern.type,
          value,
          position,
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
  tokens.push({ type: "EOF", position });

  return tokens;
}

/**
 * Syntax Analysis (Parsing)
 *
 * The second phase of compilation converts tokens into an Abstract Syntax Tree (AST).
 * An AST is a tree-like data structure that represents the structure and meaning of the code.
 * Each node in the tree represents a construct in the source code.
 *
 * This is a recursive descent parser, which uses a set of mutually recursive functions
 * to build the AST according to the grammar rules of our language.
 *
 * @param {Array} tokens - The tokens produced by the lexer
 * @returns {Object} - The AST representing the program
 */
function parse(tokens) {
  // Current position in the token array
  let current = 0;

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
    const body = [];

    // Keep parsing statements until we reach the end of the file
    while (!check("EOF")) {
      body.push(parseStatement());
    }

    // Return a Program node with the list of statements
    return {
      type: "Program",
      body,
    };
  }

  /**
   * Parse a statement
   * In our simple language, statements are:
   * - const declarations (const x = ...)
   * - return statements (return ...)
   * - expressions (anything that produces a value)
   */
  function parseStatement() {
    if (check("CONST")) {
      return parseConstDeclaration();
    }

    if (check("RETURN")) {
      return parseReturnStatement();
    }

    // If it's not a const or return, it must be an expression
    return parseExpression();
  }

  /**
   * Parse a return statement
   *
   * return;          // Return without a value
   * return expression;  // Return with a value
   */
  function parseReturnStatement() {
    next(); // consume 'return' keyword

    // Handle empty return statement (e.g., "return;")
    if (check("SEMICOLON")) {
      next(); // consume semicolon
      return {
        type: "ReturnStatement",
        argument: null,
      };
    }

    // Handle return immediately followed by a closing brace (e.g., "return }")
    // This is a convenient feature for returns without semicolons
    if (check("RIGHT_CURLY")) {
      return {
        type: "ReturnStatement",
        argument: null,
      };
    }

    // Parse the expression being returned
    const argument = parseExpression();

    // Semicolons are optional in our language
    if (check("SEMICOLON")) {
      next(); // consume semicolon if present
    }

    return {
      type: "ReturnStatement",
      argument,
    };
  }

  /**
   * Parse a const declaration
   *
   * const identifier = expression;
   * const identifier: Type = expression;
   */
  function parseConstDeclaration() {
    next(); // consume 'const' keyword

    // Get the variable name (identifier)
    const id = expect("IDENTIFIER", "Expected identifier after const").value;

    // Check for optional type annotation
    let typeAnnotation = null;
    if (check("COLON")) {
      typeAnnotation = parseTypeAnnotation();
    }

    // Expect an equals sign
    expect("EQUAL", "Expected = after identifier in const declaration");

    // Parse the initializer expression
    const init = parseExpression();

    // Semicolons are optional
    if (check("SEMICOLON")) {
      next(); // consume semicolon if present
    }

    // Return a ConstDeclaration node with optional type annotation
    return {
      type: "ConstDeclaration",
      id: {
        type: "Identifier",
        name: id,
      },
      typeAnnotation,
      init,
    };
  }

  /**
   * Parse an expression (anything that produces a value)
   * This function delegates to more specific expression parsers
   * based on a precedence hierarchy
   */
  function parseExpression() {
    // Start with the highest precedence expression type
    return parseTernary();
  }

  /**
   * Parse a ternary (conditional) expression
   *
   * condition ? trueValue : falseValue
   *
   * This has lower precedence than binary expressions
   */
  function parseTernary() {
    // First parse a binary expression as the condition
    let test = parseBinaryExpression();

    // If we see a question mark, this is a ternary expression
    if (check("TERNARY")) {
      next(); // consume '?'

      // Parse the "true" branch
      const consequent = parseExpression();

      // Expect a colon separating the branches
      expect("COLON", "Expected : in ternary expression");

      // Parse the "false" branch
      const alternate = parseExpression();

      // Return a ConditionalExpression node
      return {
        type: "ConditionalExpression",
        test,
        consequent,
        alternate,
      };
    }

    // If there's no ?, just return what we parsed
    return test;
  }

  /**
   * Parse binary expressions like a + b + c
   *
   * This implementation handles chains of the same operator (a + b + c)
   * by building left-associative trees.
   */
  function parseBinaryExpression() {
    // First parse a primary expression or arrow function as the left side
    let left = parseArrowFunction();

    // Keep consuming + operators and building a larger expression
    // This creates left-associative binary expressions: ((a + b) + c)
    while (check("PLUS")) {
      next(); // consume '+' operator

      // Parse the right side of the binary expression
      const right = parseArrowFunction();

      // Create a new BinaryExpression node, using the previous result as the left side
      left = {
        type: "BinaryExpression",
        operator: "+",
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse an arrow function expression
   *
   * Handles both formats:
   * 1. Parameter => expression
   * 2. (param1, param2) => { statements }
   *
   * Also handles TypeScript-style type annotations:
   * 1. (param: Type) => expression
   * 2. (param): ReturnType => expression
   * 3. (param: Type): ReturnType => { statements }
   */
  function parseArrowFunction() {
    // Check if we're at the start of an arrow function (a left parenthesis)
    if (check("LEFT_PAREN")) {
      // Save our current position in case this turns out not to be an arrow function
      const backup = current;

      next(); // consume '('

      const params = []; // List to hold function parameters

      // Case: No parameters - () => ...
      if (check("RIGHT_PAREN")) {
        next(); // consume ')'

        // Check for return type annotation
        let returnTypeAnnotation = null;
        if (check("COLON")) {
          returnTypeAnnotation = parseTypeAnnotation();
        }

        // If we see the arrow, it's an arrow function
        if (check("ARROW")) {
          next(); // consume '=>'

          // Parse the function body
          let body;

          // Block body: () => { statements }
          if (check("LEFT_CURLY")) {
            next(); // consume '{'
            body = [];

            // Parse statements in the block until we hit the closing brace
            while (!check("RIGHT_CURLY") && !check("EOF")) {
              // Skip any explicit semicolons between statements
              while (check("SEMICOLON")) {
                next(); // consume semicolon
              }

              // If we've reached the end of the block, break
              if (check("RIGHT_CURLY")) {
                break;
              }

              // Parse a statement and add it to the body
              body.push(parseStatement());
            }

            next(); // consume '}'
          }
          // Expression body: () => expression
          else {
            body = parseExpression();
          }

          // Return the completed ArrowFunctionExpression node
          return {
            type: "ArrowFunctionExpression",
            params: [], // Empty parameters array
            body,
            returnTypeAnnotation,
            expression: !Array.isArray(body), // Is this an expression or block body?
          };
        }
      }
      // Case: With parameters - (a, b) => ...
      else if (check("IDENTIFIER")) {
        let isArrowFunction = false;

        // Parse parameters
        while (true) {
          // Get parameter name
          const paramName = expect(
            "IDENTIFIER",
            "Expected parameter name",
          ).value;

          // Check for parameter type annotation
          let paramTypeAnnotation = null;
          if (check("COLON")) {
            paramTypeAnnotation = parseTypeAnnotation();
          }

          // Create the parameter node
          const param = {
            type: "Identifier",
            name: paramName,
            typeAnnotation: paramTypeAnnotation,
          };

          params.push(param);

          // If we hit the closing parenthesis
          if (check("RIGHT_PAREN")) {
            next(); // consume ')'

            // Check for return type annotation
            let returnTypeAnnotation = null;
            if (check("COLON")) {
              returnTypeAnnotation = parseTypeAnnotation();
            }

            // Check if the next token is an arrow
            if (check("ARROW")) {
              next(); // consume '=>'
              isArrowFunction = true;

              // Store the return type annotation for later
              if (returnTypeAnnotation) {
                returnTypeAnnotation = returnTypeAnnotation;
              }

              break;
            } else {
              // Not an arrow function, restore position
              current = backup;
              break;
            }
          }

          // If we see a comma, expect another parameter
          if (check("COMMA")) {
            next(); // consume ','
          } else {
            // Not a well-formed parameter list
            current = backup;
            break;
          }
        }

        // If we confirmed this is an arrow function, parse its body
        if (isArrowFunction) {
          let body;
          let returnTypeAnnotation = null;

          // Check for return type annotation
          if (check("COLON")) {
            returnTypeAnnotation = parseTypeAnnotation();
          }

          // Block body: (params) => { statements }
          if (check("LEFT_CURLY")) {
            next(); // consume '{'
            body = [];

            // Parse statements until closing brace
            while (!check("RIGHT_CURLY") && !check("EOF")) {
              // Skip semicolons between statements
              while (check("SEMICOLON")) {
                next(); // consume semicolon
              }

              // Break if we've reached the end
              if (check("RIGHT_CURLY")) {
                break;
              }

              body.push(parseStatement());
            }

            next(); // consume '}'
          }
          // Expression body: (params) => expression
          else {
            body = parseExpression();
          }

          // Return the ArrowFunctionExpression with parameters
          return {
            type: "ArrowFunctionExpression",
            params,
            body,
            returnTypeAnnotation,
            expression: !Array.isArray(body),
          };
        }
      }

      // If we get here, it wasn't an arrow function after all
      // Restore the position to before the left parenthesis
      current = backup;
    }

    // If not an arrow function, parse a primary expression
    return parsePrimary();
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
    // Check for array literals
    if (check("LEFT_BRACKET")) {
      return parseArrayLiteral();
    }

    const token = next();

    switch (token.type) {
      case "IDENTIFIER": {
        // Create an identifier node
        const identifierNode = {
          type: "Identifier",
          name: token.value,
          position: token.position,
        };

        // Check if this identifier is being called as a function
        if (check("LEFT_PAREN")) {
          return parseCallExpression(identifierNode);
        }

        // Check if this identifier is being used with array indexing
        if (check("LEFT_BRACKET")) {
          return parseMemberExpression(identifierNode);
        }

        return identifierNode;
      }

      case "NUMBER": {
        // Parse numeric literals and convert string values to actual numbers
        return {
          type: "NumericLiteral",
          value: parseFloat(token.value),
          position: token.position,
        };
      }

      case "STRING": {
        // Remove the quotes from string literals
        const value = token.value.slice(1, -1);
        return {
          type: "StringLiteral",
          value,
          position: token.position,
        };
      }

      case "BOOLEAN": {
        // Parse boolean literals (true/false)
        return {
          type: "BooleanLiteral",
          value: token.value === "true", // Convert to actual boolean
          position: token.position,
        };
      }

      case "LEFT_PAREN": {
        // Handle parenthesized expressions: (expression)
        const parenExpr = parseExpression();
        expect("RIGHT_PAREN", "Expected closing parenthesis");

        // Check if this parenthesized expression is being called as a function
        if (check("LEFT_PAREN")) {
          return parseCallExpression(parenExpr);
        }

        // Check if this parenthesized expression has array indexing
        if (check("LEFT_BRACKET")) {
          return parseMemberExpression(parenExpr);
        }

        return parenExpr;
      }

      default:
        // If we don't recognize the token, report an error
        throw new Error(
          `Unexpected token: ${token.type} at position ${token.position}`,
        );
    }
  }

  /**
   * Parse a function call expression: callee(arg1, arg2, ...)
   *
   * @param {Object} callee - The AST node of the function being called
   * @returns {Object} - A CallExpression AST node
   */
  function parseCallExpression(callee) {
    next(); // consume LEFT_PAREN after the function name

    const args = []; // Array to hold function arguments

    // Parse arguments if there are any
    if (!check("RIGHT_PAREN")) {
      do {
        // Each argument is an expression
        args.push(parseExpression());

        // If we see a comma, expect another argument
        if (check("COMMA")) {
          next(); // consume comma
        } else {
          break;
        }
      } while (!check("RIGHT_PAREN") && !check("EOF"));
    }

    // The argument list must end with a closing parenthesis
    expect("RIGHT_PAREN", "Expected closing parenthesis for function call");

    // Handle chained function calls: foo()()
    if (check("LEFT_PAREN")) {
      // Use the current call expression as the callee for the next call
      return parseCallExpression({
        type: "CallExpression",
        callee,
        arguments: args,
      });
    }

    // Return the function call expression node
    return {
      type: "CallExpression",
      callee,
      arguments: args,
    };
  }

  // Start parsing
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

// Export the constants for token patterns and whitespace regex at module level
// so they can be used by the visualization tools
const WHITESPACE_REGEX = /^\s+/;
const TOKEN_PATTERNS = [
  // Comments
  { type: "COMMENT", regex: /^\/\/.*?(?:\n|$)/ }, // Single-line comments
  { type: "COMMENT", regex: /^\/\*[\s\S]*?\*\// }, // Multi-line comments

  // Keywords
  { type: "CONST", regex: /^const\b/ }, // const keyword
  { type: "RETURN", regex: /^return\b/ }, // return keyword

  // Type annotation keywords
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

// Export the main functions and individual components for teaching purposes
module.exports = {
  // Main compilation functions
  compile, // Just parse to AST
  compileAndAnalyze, // Parse + optional analysis
  compileWithTypes, // Parse + full analysis with types

  // Individual compiler phases for educational purposes
  tokenize, // Lexical analysis
  parse, // Syntax analysis
  
  // Token patterns and utilities for visualization and educational tools
  TOKEN_PATTERNS,
  WHITESPACE_REGEX
};
