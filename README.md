# Simple Compiler

A minimal compiler implementation for educational purposes. This compiler demonstrates the fundamental stages of compilation:

1. **Lexical Analysis** (Tokenization)
2. **Syntax Analysis** (Parsing)
3. **Semantic Analysis**
   - Name Resolution
   - Type Checking

## Language Features

The compiler supports a small subset of JavaScript:

- Variable declarations with `const`
- Arrow functions with single and multiple parameters
- Return statements (must be the last statement in a function)
- Ternary expressions
- Binary expressions (only the `+` operator)
- Function calls
- Primitive types: integers, floats, strings, and booleans

## Components

- **parse.js**: Lexer and parser that convert source code to AST
- **analyze.js**: Name resolution that verifies variable scoping
- **typecheck.js**: Hindley-Milner type inference algorithm

## Hindley-Milner Type Inference

The type checker uses a simplified implementation of the Hindley-Milner algorithm, named after its creators Roger Hindley and Robin Milner. This algorithm can infer types without requiring explicit type annotations.

### How It Works

1. **Type Variables**: Initially, each expression is assigned a type variable (a placeholder for its type).

2. **Constraint Collection**: As the algorithm traverses the AST, it collects constraints on what these type variables can be.

   - For literals, their type is known immediately (e.g., numbers are `Int`)
   - For operations, constraints are derived from the operation (e.g., `+` requires numeric operands)
   - For variables, constraints come from their declarations and uses

3. **Unification**: The algorithm solves these constraints by making type variables equal when they must represent the same type.

   - If a conflict is found (e.g., trying to use a string where a number is expected), a type error is reported
   - If no conflicts are found, all expressions are assigned concrete types

4. **Polymorphism**: Functions can work with multiple types through parametric polymorphism.
   - For example, the identity function `id(x) => x` has type `α -> α` (for any type α)
   - Each use of a polymorphic function gets fresh type variables

### Key Benefits

- **No Type Annotations**: Types are inferred automatically
- **Type Safety**: Catches type errors before runtime
- **Polymorphism**: Functions can work with multiple types without explicit generics

## Examples

```javascript
// Inferred types shown as comments
const x = 5; // x: Int
const y = "hello"; // y: String
const id = (x) => x; // id: α -> α (polymorphic)
const five = id(5); // five: Int
const greeting = id("hi"); // greeting: String
```

In this example, the `id` function is polymorphic - it can work with any type, and the specific type used in each call is inferred correctly.

## Error Detection

The compiler can detect:

1. **Undeclared variables**: References to variables not in scope
2. **Duplicate declarations**: Declaring the same variable twice in the same scope
3. **Type errors**: Using a value of the wrong type (e.g., adding a string to a number)
4. **Invalid return placement**: Return statements not at the end of functions
