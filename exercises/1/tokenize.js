/**
 * Lexical Analysis (Tokenization)
 *
 * This module handles the tokenization phase of our compiler.
 * It breaks source code into tokens - minimal, meaningful units of code.
 */

// Token patterns and whitespace regex
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

/**
 * Tokenize source code into a stream of tokens
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

// Function to get the token patterns
function getTokenPatterns() {
  return TOKEN_PATTERNS;
}

// Function to get the whitespace regex
function getWhitespaceRegex() {
  return WHITESPACE_REGEX;
}

module.exports = {
  tokenize,
  getTokenPatterns,
  getWhitespaceRegex,
  TOKEN_PATTERNS,
  WHITESPACE_REGEX
};