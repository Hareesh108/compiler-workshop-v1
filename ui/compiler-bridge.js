/**
 * Compiler Bridge Script
 * 
 * This script loads the compiler code and exposes the necessary components
 * for visualization without modifying the original compiler code.
 * It fetches the original parse.js file, evaluates it, and exposes
 * the required constants and functions to the browser environment.
 */

// First, let's define the token patterns and whitespace regex from parse.js
// These must be kept in sync with the actual patterns in compiler/parse.js
window.CompilerModule.WHITESPACE_REGEX = /^\s+/;

window.CompilerModule.TOKEN_PATTERNS = [
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

// Load the original tokenizer function by fetching and evaluating the parse.js file
(async function loadCompiler() {
  try {
    // Fetch the original parse.js file
    const response = await fetch('../compiler/parse.js');
    const sourceCode = await response.text();
    
    // Create a self-executing function wrapper to evaluate the code without polluting the global scope
    const moduleWrapper = `
      (function() {
        // Create a mock module.exports
        const module = { exports: {} };
        
        // Execute the compiler code
        ${sourceCode}
        
        // Extract the tokenize function
        return module.exports.tokenize;
      })()
    `;
    
    // Evaluate the module and extract the tokenize function
    window.CompilerModule.tokenize = eval(moduleWrapper);
    
    console.log('Compiler module loaded successfully');
  } catch (error) {
    console.error('Error loading compiler module:', error);
    
    // Fallback tokenizer implementation if loading fails
    window.CompilerModule.tokenize = function(sourceCode) {
      const tokens = [];
      let position = 0;
      
      // Simplified tokenizer just for fallback
      while (position < sourceCode.length) {
        // Skip whitespace
        const whitespaceMatch = sourceCode.slice(position).match(window.CompilerModule.WHITESPACE_REGEX);
        if (whitespaceMatch) {
          position += whitespaceMatch[0].length;
          continue;
        }
        
        let matched = false;
        
        for (const pattern of window.CompilerModule.TOKEN_PATTERNS) {
          const match = sourceCode.slice(position).match(pattern.regex);
          
          if (match) {
            const value = match[0];
            
            // Skip comments
            if (pattern.type === "COMMENT") {
              position += value.length;
              matched = true;
              break;
            }
            
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
        
        if (!matched) {
          throw new Error(`Unexpected character at position ${position}`);
        }
      }
      
      tokens.push({ type: "EOF", position });
      
      return tokens;
    };
    
    console.log('Using fallback tokenizer implementation');
  }
})();