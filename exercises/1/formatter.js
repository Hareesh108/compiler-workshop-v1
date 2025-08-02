// 👉 Run `node index.js` from the parent directory to see which tests are failing.
//
// Fix the failing tests by resolving the "👉" comments in this file!

/**
 * Formatter
 *
 * This module takes a parse tree (AST) and converts it back into formatted source code.
 * It handles proper indentation, spacing, and line breaks to make the output look nice.
 */

const { compile } = require("./parse");

/**
 * Format a parse tree into formatted source code
 *
 * @param {Array|Object} parseTree - The parse tree nodes from the parser
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted source code
 */
function format(parseTree, options = {}) {
  const defaultOptions = {
    indentSize: 2,
    useSpaces: true,
    maxLineLength: 80,
  };

  const opts = { ...defaultOptions, ...options };
  const indent = opts.useSpaces ? " ".repeat(opts.indentSize) : "\t";

  return parseTree.map((node) => formatNode(node, 0, indent)).join("\n");

  /**
   * Format a single node with the given indentation level
   *
   * @param {Object} node - The parse tree node
   * @param {number} indentLevel - The current indentation level (defaults to 0)
   * @param {string} indentString - The string to use for one level of indentation (defaults to empty string)
   * @returns {string} - Formatted code for this node
   */
  function formatNode(node, indentLevel = 0, indentString = "") {
    switch (node.type) {
      case "ConstDeclaration":
        return formatConstDeclaration(node, indentLevel, indentString);

      case "ReturnStatement":
        return formatReturnStatement(node, indentLevel, indentString);

      case "BinaryExpression":
        return formatBinaryExpression(node);

      case "ConditionalExpression":
        return formatConditionalExpression(node);

      case "CallExpression":
        return formatCallExpression(node);

      case "ArrowFunctionExpression":
        return formatArrowFunction(node, indentLevel, indentString);

      case "ArrayLiteral":
        return formatArrayLiteral(node);

      case "MemberExpression":
        return formatMemberExpression(node);

      case "BlockStatement":
        return formatBlockStatement(node, indentLevel, indentString);

      case "StringLiteral":
        return `"${node.value}"`;

      case "NumericLiteral":
        return `${node.value}`;

      case "BooleanLiteral":
        return node.value ? "true" : "false";

      case "Identifier":
        return node.name;

      default:
        console.warn(`Unknown node type: ${node.type}`);
        return "";
    }
  }

  /**
   * Format a constant declaration
   */
  function formatConstDeclaration(node, indentLevel, indentString) {
    const currentIndent = indentString.repeat(indentLevel);
    let result = `${currentIndent}const ${formatNode(node.id, indentLevel, indentString)}`;

    // Add type annotation if present
    if (node.typeAnnotation) {
      result += ": " + formatTypeAnnotation(node.typeAnnotation);
    }

    result += " = " + formatNode(node.init, indentLevel, indentString) + ";";

    return result;
  }

  /**
   * Format a return statement
   */
  function formatReturnStatement(node, indentLevel, indentString) {
    const currentIndent = indentString.repeat(indentLevel);

    if (!node.argument) {
      return `${currentIndent}return;`;
    }

    return `${currentIndent}return ${formatNode(node.argument, indentLevel, indentString)};`;
  }

  /**
   * Format an array literal
   */
  function formatArrayLiteral(node) {
    if (node.elements.length === 0) {
          return "[]";
        }

        const elements = node.elements.map((elem) => formatNode(elem)).join(", ");

        return `[${elements}]`;

    // 👉 Change this to format the given array literal node.
    //
    // The structure of the `node` arg will be:
    //
    // {
    //    elements: // Array of parse tree nodes
    // }
    //
    // Example of a correctly-formatted array:
    //
    // [a, b, c]

    return "TODO: Implement formatArrayLiteral()";
  }

  /**
   * Format a function call expression
   */
  function formatCallExpression(node) {
    // 👉 Change this to format the given function call node.
    //
    // The structure of the `node` arg will be:
    //
    // {
    //    callee: // parse tree node (not necessarily a name!)
    //    arguments: // Array of parse tree nodes
    // }
    //
    // Example of a correctly-formatted call:
    //
    // foo(arg1, arg2)

    return "TODO: Implement formatCallExpression()";
  }

  /**
   * Format a binary expression
   */
  function formatBinaryExpression(node) {
    // 👉 Change this to format the given binary expression node.
    //
    // The structure of the `node` arg will be:
    //
    // {
    //    left: // the parse tree node to the left of the operator
    //    operator: // string (e.g. "+" or "*" or "/")
    //    right: // the parse tree node to the right of the operator
    // }
    //
    // Example of a correctly-formatted call:
    //
    // a + b

    return "TODO: Implement formatBinaryExpression()";
  }

  /**
   * Format a conditional (ternary) expression
   */
  function formatConditionalExpression(node) {
    const test = formatNode(node.test);
    const consequent = formatNode(node.consequent);
    const alternate = formatNode(node.alternate);

    return `${test} ? ${consequent} : ${alternate}`;
  }

  /**
   * Format an arrow function
   */
  function formatArrowFunction(node, indentLevel, indentString) {
    // Format parameters with their type annotations
    const params = node.params
      .map((param) => {
        let paramStr = formatNode(param);

        if (param.typeAnnotation) {
          paramStr += ": " + formatTypeAnnotation(param.typeAnnotation);
        }

        return paramStr;
      })
      .join(", ");

    let result = `(${params})`;

    // Add return type annotation if present
    if (node.returnType) {
      result += ": " + formatTypeAnnotation(node.returnType);
    }

    result += " => ";

    // Format the function body (only block bodies are supported)
    if (node.body.type === "BlockStatement") {
      result += formatBlockStatement(node.body, indentLevel, indentString);
    } else {
      // Should not happen as per parser implementation, but handling for completeness
      result += formatNode(node.body, indentLevel, indentString);
    }

    return result;
  }

  /**
   * Format a member expression (array access)
   */
  function formatMemberExpression(node) {
    const object = formatNode(node.object);
    const index = formatNode(node.index);

    return `${object}[${index}]`;
  }

  /**
   * Format a block statement (curly braces with statements inside)
   */
  function formatBlockStatement(node, indentLevel, indentString) {
    const currentIndent = indentString.repeat(indentLevel);
    const bodyIndent = indentString.repeat(indentLevel + 1);

    if (node.body.length === 0) {
      return `{}`;
    }

    const formattedStatements = node.body
      .map((statement) => formatNode(statement, indentLevel + 1, indentString))
      .join("\n");

    return `{\n${formattedStatements}\n${currentIndent}}`;
  }

  /**
   * Format a type annotation
   */
  function formatTypeAnnotation(typeNode) {
    if (!typeNode) return "";

    if (typeNode.type === "TypeAnnotation") {
      return typeNode.valueType;
    }

    if (typeNode.type === "ArrayTypeAnnotation") {
      const elementType = formatTypeAnnotation(typeNode.elementType);
      return `Array<${elementType}>`;
    }

    if (typeNode.type === "FunctionTypeAnnotation") {
      const paramTypes = typeNode.paramTypes
        .map((param) => {
          return `${param.name}: ${formatTypeAnnotation(param.typeAnnotation)}`;
        })
        .join(", ");

      const returnType = formatTypeAnnotation(typeNode.returnType);

      return `(${paramTypes}) => ${returnType}`;
    }

    return "";
  }
}

/**
 * Format source code by tokenizing, parsing, and then formatting
 *
 * @param {string} sourceCode - The source code to format
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted source code
 */
function formatSourceCode(sourceCode, options = {}) {
  const parseTree = compile(sourceCode);
  return format(parseTree, options);
}

module.exports = {
  format,
  formatSourceCode,
};
