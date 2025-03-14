# Simple Compiler

A minimal compiler implementation for educational purposes. This compiler demonstrates the fundamental stages of compilation:

1. **Lexical Analysis** (Tokenization)
2. **Syntax Analysis** (Parsing)
3. **Semantic Analysis**
   - Name Resolution
   - Type Checking

## Language Features

The compiler supports a small subset of JavaScript with TypeScript-like type annotations:

- Variable declarations with `const`
- Arrow functions with single and multiple parameters
- Return statements (must be the last statement in a function)
- Ternary expressions
- Binary expressions (only the `+` operator)
- Function calls
- Array literals and array indexing (`[]` syntax)
- TypeScript-style type annotations (optional)
- Primitive types: integers, floats, strings, booleans, and homogeneous arrays

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

// With type annotations
const z: number = 10; // z: Int
const name: string = "world"; // name: String
const add = (x: number, y: number): number => x + y; // add: Int -> Int -> Int

// Array examples
const nums = [1, 2, 3]; // nums: Array<Int>
const emptyArray = []; // emptyArray: Array<α> (polymorphic)
const matrix = [[1, 2], [3, 4]]; // matrix: Array<Array<Int>>

// Arrays with type annotations
const strings: Array<string> = ["a", "b", "c"]; // strings: Array<String>
const emptyNums: Array<number> = []; // emptyNums: Array<Int>

// Polymorphic array function
const first = (arr) => arr[0]; // first: Array<α> -> α (polymorphic)
const firstNum = first(nums); // firstNum: Int
const firstRow = first(matrix); // firstRow: Array<Int>
```

In this example, the `id` function is polymorphic - it can work with any type, and the specific type used in each call is inferred correctly.

## Error Detection

The compiler can detect:

1. **Undeclared variables**: References to variables not in scope
2. **Duplicate declarations**: Declaring the same variable twice in the same scope
3. **Type errors**: Using a value of the wrong type (e.g., adding a string to a number)
4. **Invalid return placement**: Return statements not at the end of functions
5. **Array type errors**: Mixing different types in a homogeneous array
6. **Invalid array access**: Using non-integer indices or accessing non-array values
7. **Type annotation violations**: Values that don't match their type annotations

## Type Annotations

The compiler supports optional TypeScript-style type annotations that integrate with the Hindley-Milner type inference system:

1. **Variable Annotations**: `const x: number = 5;`
2. **Parameter Annotations**: `(x: number, y: string) => {...}`
3. **Return Type Annotations**: `(): number => 42` 
4. **Array Type Annotations**: `Array<number>` for arrays of numbers
5. **Partial Annotations**: You can annotate some parts and let the compiler infer the rest

Annotations serve as explicit constraints on the inferred types. When annotations are present, the compiler will ensure that values match their declared types. If no annotations are provided, the compiler will infer types automatically.
