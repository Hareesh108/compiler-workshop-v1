// Test our simple compiler
const { compile } = require("./simple-compiler");

// Example 1: const declaration and ternary
const example1 = `
const greeting = "Hello";
const audience = true ? "world" : "nobody";
`;

// Example 2: arrow function with return
const example2 = `
const add = (a, b) => a + b;
const greet = () => {
  const name = "world";
  const greeting = "Hello";
  return greeting + " " + name;
};
`;

// Example 3: return statement
const example3 = `
const getMessage = () => {
  const prefix = "Hello";
  const suffix = "World";
  return prefix + " " + suffix;
}

const emptyReturn = () => {
  return;
}
`;

console.log("Example 1 AST:");
console.log(JSON.stringify(compile(example1), null, 2));

console.log("\nExample 2 AST:");
console.log(JSON.stringify(compile(example2), null, 2));

console.log("\nExample 3 AST:");
console.log(JSON.stringify(compile(example3), null, 2));
