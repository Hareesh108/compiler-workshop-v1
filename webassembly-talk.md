# WebAssembly Code Generation for a JavaScript Subset
*A 30-minute instructional talk on generating WebAssembly from a typed AST*

## Introduction to WebAssembly (5 minutes)

WebAssembly (often abbreviated as Wasm) is a binary instruction format designed as a portable compilation target for high-level languages. It allows code to run at near-native speed in web browsers by providing a compact binary format that loads and executes faster than JavaScript.

Key characteristics of WebAssembly:

1. **Binary format**: Compact representation designed for fast transmission, parsing, and execution
2. **Stack-based virtual machine**: Uses a structured stack for operations
3. **Type safety**: Strong typing system with static validation
4. **Memory model**: Linear memory model with explicit memory management
5. **Designed for compatibility**: Works alongside JavaScript in the browser

WebAssembly modules are structured into sections, each with a specific purpose:

```
+------------------+
| Module           |
+------------------+
| Type Section     | (Function signatures)
| Import Section   | (External dependencies)
| Function Section | (Function type indices)
| Table Section    | (Function references)
| Memory Section   | (Linear memory definitions)
| Global Section   | (Global variables)
| Export Section   | (Functions/objects to expose)
| Start Section    | (Initialization function)
| Element Section  | (Function table elements)
| Code Section     | (Function bodies)
| Data Section     | (Memory initialization)
+------------------+
```

For our compiler, we'll focus primarily on the Type, Function, Memory, Export, and Code sections.

## From Types to WebAssembly Types (3 minutes)

Before generating WebAssembly, we need to map our language's types to WebAssembly's type system, which is simpler and includes only four value types:

```
Our Type System     WebAssembly Types
--------------     -----------------
Number     ------> i32 (32-bit integer)
Float      ------> f64 (64-bit float)
Bool       ------> i32 (0 = false, 1 = true)
Void       ------> (no return value)
Array<T>   ------> i32 (pointer to memory)
Function   ------> Function types (described by signature)
```

WebAssembly function types are defined by their parameter and return types:

```
(param i32 i32) (result i32)  // Two i32 parameters, returns i32
(param f64) (result f64)     // One f64 parameter, returns f64
(param i32) (result)         // One i32 parameter, no return value
```

## WebAssembly Binary Format Encoding (5 minutes)

WebAssembly binary format uses several encoding techniques:

### 1. LEB128 (Little Endian Base 128)

This variable-length encoding is used for integers in WebAssembly to save space:

```
Example encoding of 624:
624 = 0x0270 = 0b0000001001110000
Split into 7-bit groups with continuation bit:
0b0000001 0b0011100 0b00
Add continuation bit to all but last group:
0b10000001 0b00011100
Final bytes: 0x81 0x1C
```

For signed integers, an additional sign bit is considered.

### 2. IEEE-754 for Floating Point

Floating point numbers use standard IEEE-754 encoding:
- f32: 32-bit single precision
- f64: 64-bit double precision

### 3. Section Structure

Each section follows the format:
```
Section ID (1 byte) | Size (LEB128) | Contents (size bytes)
```

### 4. Instructions

WebAssembly instructions (opcodes) are represented as single bytes, often followed by immediate values.

```
i32.const 42  ->  0x41 0x2A
local.get 0   ->  0x20 0x00
i32.add       ->  0x6A
```

## Function Generation (7 minutes)

Let's explore how to generate WebAssembly code for functions, starting with a simple example:

```javascript
const add = (a, b) => a + b;
```

This translates to the following WebAssembly code:

```
;; Function signature in Type section
(type $t0 (func (param i32 i32) (result i32)))

;; Function definition
(func $add (type $t0) (param i32 i32) (result i32)
  local.get 0  ;; get parameter 'a'
  local.get 1  ;; get parameter 'b'
  i32.add      ;; add them together
)

;; Export the function
(export "add" (func $add))
```

In binary format, we would:

1. Create a type section with the function signature
2. Create a function section referencing this type
3. Create a code section with the function body
4. Create an export section to expose the function

For the function body, we recursively generate code for expressions:

```
Function body generation:
1. Push parameters onto the stack: local.get <index>
2. Perform operations: i32.add, i32.sub, etc.
3. Return value is left on the stack
```

For nested function calls:

```javascript
const double = (x) => x + x;
const quadruple = (x) => double(double(x));
```

We generate code that correctly manages the stack:

```
(func $double (param i32) (result i32)
  local.get 0  ;; x
  local.get 0  ;; x again
  i32.add      ;; x + x
)

(func $quadruple (param i32) (result i32)
  local.get 0      ;; x
  call $double     ;; double(x)
  call $double     ;; double(double(x))
)
```

## Conditionals and Control Flow (5 minutes)

WebAssembly uses structured control flow with blocks, loops, and if/else statements.

For a ternary expression like:

```javascript
const max = (a, b) => a > b ? a : b;
```

We generate:

```
(func $max (param i32 i32) (result i32)
  local.get 0            ;; a
  local.get 1            ;; b
  i32.gt_s               ;; a > b (signed comparison)
  if (result i32)        ;; if condition is true
    local.get 0          ;; return a
  else
    local.get 1          ;; return b
  end
)
```

In binary format, this uses the control flow opcodes:
- 0x04 (if)
- 0x05 (else)
- 0x0b (end)

With type annotations for the result type of the if expression.

For recursive functions like:

```javascript
const factorial = (n) => n <= 1 ? 1 : n * factorial(n - 1);
```

We generate:

```
(func $factorial (param i32) (result i32)
  local.get 0            ;; n
  i32.const 1            ;; 1
  i32.le_s               ;; n <= 1
  if (result i32)
    i32.const 1          ;; 1 (base case)
  else
    local.get 0          ;; n
    local.get 0          ;; n
    i32.const 1          ;; 1
    i32.sub              ;; n - 1
    call $factorial      ;; factorial(n - 1)
    i32.mul              ;; n * factorial(n - 1)
  end
)
```

## Memory Model and Arrays (3 minutes)

WebAssembly uses a linear memory model - a contiguous byte array that can be accessed by load and store instructions.

For arrays, we implement a simple memory representation:
- Each array starts with its length (4 bytes)
- Followed by the array elements

```
Memory layout for [1, 2, 3]:

Address:  0       4   8   12
          +-------+---+---+---+
          |   3   | 1 | 2 | 3 |
          +-------+---+---+---+
          ^       ^
          |       |
          |       Elements start here
          Length
```

For an array access operation like `arr[i]`:

```
;; To access arr[i] where arr is a pointer:
local.get 0      ;; array pointer
local.get 1      ;; index i
i32.const 4      ;; element size (4 bytes for i32)
i32.mul          ;; i * 4
i32.const 4      ;; offset past the length field
i32.add          ;; (i * 4) + 4
i32.add          ;; arr + (i * 4) + 4
i32.load         ;; load value at address
```

## Putting It All Together (2 minutes)

When our compiler generates WebAssembly, it follows these steps:

1. Type analysis to determine function signatures
2. Mapping language types to WebAssembly types
3. Generating appropriate sections:
   - Type section for function signatures
   - Function section to declare functions
   - Memory section for array support
   - Export section to expose functions
   - Code section with function implementations

The binary format is then ready to be:
1. Downloaded by the browser
2. Compiled to native code by the browser's WebAssembly engine
3. Instantiated with any required imports
4. Called from JavaScript with standard parameters

## Practical Implementation Details and Optimizations (2 minutes)

In real-world implementations, several optimizations would be applied:

1. **Constant folding**: Evaluate constant expressions at compile time
2. **Dead code elimination**: Remove unreachable or unused code
3. **Register allocation**: Optimize local variable usage
4. **Inlining**: Replace function calls with their body for small functions
5. **Tail call optimization**: Convert recursive calls to loops where possible

Our implementation focuses on correctness rather than these optimizations, but they would be important for production compilers.

## Demonstration (3 minutes)

Let's see our WebAssembly compiler in action:

1. Write a simple function in our language subset
2. Compile it to WebAssembly using our compiler
3. Instantiate and run the WebAssembly module in the browser
4. Compare performance with equivalent JavaScript

The demo will show that WebAssembly provides:
- Predictable performance
- Efficient execution for numeric code
- Natural interoperability with JavaScript

## Conclusion

We've covered:
1. WebAssembly's structure and binary format
2. Mapping language constructs to WebAssembly
3. Generating valid WebAssembly binaries
4. Working with WebAssembly's memory model

By adding WebAssembly generation to our compiler, we've created a complete pipeline from source code to executable binaries, demonstrating the power of modern web technologies for high-performance computing in the browser.