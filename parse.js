// This parses a tiny subset of JavaScript:
// - Strings, numbers, and booleans
// - `const` declarations
// - Arrow functions
// - `return` statements
// - Ternaries
// - Binary expressions (+)

/**
 * Lexer: Converts source code into tokens
 */
function tokenize(sourceCode) {
  const tokens = [];
  let position = 0;

  // Whitespace regex
  const whitespaceRegex = /^\s+/;

  // Token patterns
  const patterns = [
    { type: "CONST", regex: /^const\b/ },
    { type: "RETURN", regex: /^return\b/ }, // Move RETURN before IDENTIFIER
    { type: "ARROW", regex: /^=>/ },
    { type: "TERNARY", regex: /^\?/ },
    { type: "COLON", regex: /^:/ },
    { type: "EQUAL", regex: /^=/ },
    { type: "PLUS", regex: /^\+/ },
    { type: "LEFT_PAREN", regex: /^\(/ },
    { type: "RIGHT_PAREN", regex: /^\)/ },
    { type: "LEFT_CURLY", regex: /^\{/ },
    { type: "RIGHT_CURLY", regex: /^\}/ },
    { type: "COMMA", regex: /^,/ },
    { type: "SEMICOLON", regex: /^;/ },
    { type: "BOOLEAN", regex: /^(true|false)\b/ },
    { type: "IDENTIFIER", regex: /^[a-zA-Z_][a-zA-Z0-9_]*/ }, // Move IDENTIFIER after keywords
    { type: "NUMBER", regex: /^[0-9]+(\.[0-9]+)?/ },
    { type: "STRING", regex: /^"([^"\\]|\\.)*("|$)/ },
    { type: "STRING", regex: /^'([^'\\]|\\.)*(\'|$)/ },
  ];

  // Helper function to skip whitespace
  function skipWhitespace() {
    const match = sourceCode.slice(position).match(whitespaceRegex);
    if (match) {
      position += match[0].length;
    }
  }

  // Process the source code until the end
  while (position < sourceCode.length) {
    skipWhitespace();

    if (position >= sourceCode.length) {
      break;
    }

    let matched = false;

    // Try to match each pattern
    for (const pattern of patterns) {
      const match = sourceCode.slice(position).match(pattern.regex);

      if (match) {
        const value = match[0];
        tokens.push({
          type: pattern.type,
          value,
          position,
        });

        position += value.length;
        matched = true;
        break;
      }
    }

    // If no pattern matches, it's an error
    if (!matched) {
      throw new Error(
        `Unexpected character at position ${position}: "${sourceCode.charAt(position)}"`,
      );
    }
  }

  // Add an EOF token to simplify parser logic
  tokens.push({ type: "EOF", position });

  return tokens;
}

/**
 * Parser: Converts tokens into an Abstract Syntax Tree (AST)
 */
function parse(tokens) {
  let current = 0;

  // Convenience function to look at the current token
  function peek() {
    return tokens[current];
  }

  // Convenience function to advance to the next token
  function next() {
    return tokens[current++];
  }

  // Check if the current token matches the expected type
  function check(type) {
    return peek().type === type;
  }

  // Expect a specific token type and advance, or throw an error
  function expect(type, message) {
    if (check(type)) {
      return next();
    }
    throw new Error(
      message ||
        `Expected ${type} but got ${peek().type} at position ${peek().position}`,
    );
  }

  // Parse a program (the entry point)
  function parseProgram() {
    const body = [];

    while (!check("EOF")) {
      body.push(parseStatement());
    }

    return {
      type: "Program",
      body,
    };
  }

  // Parse a statement
  function parseStatement() {
    if (check("CONST")) {
      return parseConstDeclaration();
    }

    if (check("RETURN")) {
      return parseReturnStatement();
    }

    return parseExpression();
  }

  // Parse a return statement
  function parseReturnStatement() {
    next(); // consume 'return'

    // Handle empty return
    if (check("SEMICOLON")) {
      next(); // consume semicolon
      return {
        type: "ReturnStatement",
        argument: null,
      };
    }

    // Handle return followed immediately by closing brace
    if (check("RIGHT_CURLY")) {
      return {
        type: "ReturnStatement",
        argument: null,
      };
    }

    const argument = parseExpression();

    // Make semicolons optional
    if (check("SEMICOLON")) {
      next(); // consume semicolon if present
    }

    return {
      type: "ReturnStatement",
      argument,
    };
  }

  // Parse a const declaration
  function parseConstDeclaration() {
    next(); // consume 'const'
    const id = expect("IDENTIFIER", "Expected identifier after const").value;
    expect("EQUAL", "Expected = after identifier in const declaration");
    const init = parseExpression();

    // Make semicolons optional
    if (check("SEMICOLON")) {
      next(); // consume semicolon if present
    }

    return {
      type: "ConstDeclaration",
      id: {
        type: "Identifier",
        name: id,
      },
      init,
    };
  }

  // Parse an expression
  function parseExpression() {
    return parseTernary();
  }

  // Parse a ternary expression
  function parseTernary() {
    let test = parseBinaryExpression();

    if (check("TERNARY")) {
      next(); // consume '?'
      const consequent = parseExpression();
      expect("COLON", "Expected : in ternary expression");
      const alternate = parseExpression();

      return {
        type: "ConditionalExpression",
        test,
        consequent,
        alternate,
      };
    }

    return test;
  }

  // Parse binary expressions like a + b + c
  function parseBinaryExpression() {
    let left = parseArrowFunction();

    // Handle chains of + operations (e.g., a + b + c)
    while (check("PLUS")) {
      next(); // consume '+'
      const right = parseArrowFunction();

      left = {
        type: "BinaryExpression",
        operator: "+",
        left,
        right,
      };
    }

    return left;
  }

  // Parse an arrow function
  function parseArrowFunction() {
    // Check if we're at the start of an arrow function
    if (check("LEFT_PAREN")) {
      const startToken = peek();
      const backup = current;

      next(); // consume '('

      const params = [];

      // No parameters
      if (check("RIGHT_PAREN")) {
        next(); // consume ')'

        if (check("ARROW")) {
          next(); // consume '=>'

          // Parse the arrow function body
          let body;
          if (check("LEFT_CURLY")) {
            next(); // consume '{'
            body = [];

            // Parse statements in the block until we hit the closing curly brace
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
          } else {
            body = parseExpression();
          }

          return {
            type: "ArrowFunctionExpression",
            params: [],
            body,
            expression: !Array.isArray(body),
          };
        }
      }
      // With parameters
      else if (check("IDENTIFIER")) {
        let isArrowFunction = false;

        // Parse parameters
        while (true) {
          const param = expect("IDENTIFIER", "Expected parameter name").value;
          params.push({
            type: "Identifier",
            name: param,
          });

          if (check("RIGHT_PAREN")) {
            next(); // consume ')'

            if (check("ARROW")) {
              next(); // consume '=>'
              isArrowFunction = true;
              break;
            } else {
              // Not an arrow function, restore position
              current = backup;
              break;
            }
          }

          if (check("COMMA")) {
            next(); // consume ','
          } else {
            // Not a well-formed parameter list
            current = backup;
            break;
          }
        }

        if (isArrowFunction) {
          // Parse the arrow function body
          let body;
          if (check("LEFT_CURLY")) {
            next(); // consume '{'
            body = [];

            // Parse statements in the block until we hit the closing curly brace
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
          } else {
            body = parseExpression();
          }

          return {
            type: "ArrowFunctionExpression",
            params,
            body,
            expression: !Array.isArray(body),
          };
        }
      }

      // Not an arrow function, restore position
      current = backup;
    }

    return parsePrimary();
  }

  // Parse primary expressions (identifiers, literals)
  function parsePrimary() {
    const token = next();

    switch (token.type) {
      case "IDENTIFIER":
        return {
          type: "Identifier",
          name: token.value,
        };

      case "NUMBER":
        return {
          type: "NumericLiteral",
          value: parseFloat(token.value),
        };

      case "STRING":
        // Remove the quotes from the string value
        const value = token.value.slice(1, -1);
        return {
          type: "StringLiteral",
          value,
        };

      case "BOOLEAN":
        return {
          type: "BooleanLiteral",
          value: token.value === "true",
        };

      case "LEFT_PAREN":
        const expr = parseExpression();
        expect("RIGHT_PAREN", "Expected closing parenthesis");
        return expr;

      default:
        throw new Error(
          `Unexpected token: ${token.type} at position ${token.position}`,
        );
    }
  }

  // Start parsing
  return parseProgram();
}

/**
 * Main function that combines lexing and parsing
 */
function compile(sourceCode) {
  const tokens = tokenize(sourceCode);
  const ast = parse(tokens);
  return ast;
}

// Export the main function and individual components for teaching purposes
module.exports = {
  compile,
  tokenize,
  parse,
};
