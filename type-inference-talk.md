# Advanced Type Inference in a Small JavaScript Subset
*A 30-minute instructional talk on functions, conditionals, and arrays*

## Introduction (2 minutes)

Today we'll explore advanced concepts in Hindley-Milner type inference by walking through a simple compiler for a JavaScript subset. We'll focus on three key type inference challenges:

1. Functions with arguments and return values
2. Conditional expressions (specifically ternaries)
3. Arrays with parametric polymorphism

I'll assume you're already familiar with basic Hindley-Milner concepts like type variables, unification, and simple inference for constants and variables.

## Type Inference for Functions (10 minutes)

Functions represent our first significant type inference challenge, as they require handling:

1. Arguments with unknown types
2. Return values dependent on those arguments
3. Lexical scopes and closures

### How Function Type Inference Works

When we encounter a function definition like:

```javascript
const identity = x => x;
```

Our type inference system needs to:

1. Create a new type variable for each parameter (`x` gets type variable `t0`)
2. Create a new scope for the function body
3. Infer the type of the function body (here, it's just `x`, so it's type `t0`)
4. Construct the function type: `t0 -> t0`

For more complex functions, we track how type variables flow through expressions:

```javascript
const add = (x, y) => x + y;
```

Here we:
1. Assign type variables `t0` and `t1` to `x` and `y`
2. When processing `x + y`, we unify both `t0` and `t1` with `Number`
3. The body's type is inferred as `Number`
4. The final function type becomes `Number -> Number -> Number`

### Handling Function Application

When a function is called, like:

```javascript
const double = x => x * 2;
const result = double(5);
```

We:
1. Look up the function's type (here, `Number -> Number`)
2. Infer the argument's type (`5` is a `Number`)
3. Unify the function's parameter type with the argument type
4. The return type of the function becomes the type of the result

### Function Inference with Polymorphism

The real power comes with polymorphic functions:

```javascript
const applyTwice = (f, x) => f(f(x));
```

Here:
1. `f` gets type `t0 -> t1` (a function from some type to another)
2. `x` gets type `t0` (matching the input of `f`)
3. `f(x)` has type `t1`
4. But `f(f(x))` requires `t1` to be the same as `t0`
5. So we unify `t0` and `t1`, giving `f` type `t0 -> t0`
6. The resulting function type is `(t0 -> t0) -> t0 -> t0`

This type says: "given a function that maps from some type to the same type, and a value of that type, return a value of that type."

## Type Inference for Conditionals (6 minutes)

In our subset of JavaScript, conditionals come in the form of ternary expressions:

```javascript
const max = (a, b) => a > b ? a : b;
```

### How Ternary Type Inference Works

For a ternary expression `condition ? thenExpr : elseExpr`:

1. Infer the type of `condition` and unify it with `Boolean`
2. Infer the types of `thenExpr` and `elseExpr` independently, yielding types `t1` and `t2`
3. Unify `t1` and `t2` to get the result type `t3`
4. The ternary expression has type `t3`

Let's analyze our `max` example:

```javascript
const max = (a, b) => a > b ? a : b;
```

1. Parameters `a` and `b` get type variables `t0` and `t1`
2. `a > b` requires both `a` and `b` to be `Number`, so we unify `t0` and `t1` with `Number`
3. The "then" and "else" expressions are `a` and `b`, both now known to be `Number`
4. The result type of the ternary is `Number`
5. The function type is inferred as `Number -> Number -> Number`

### Type Inference with Complex Ternaries

Ternaries become more interesting when the branches have different apparent types:

```javascript
const condition = true;
const result = condition ? [1, 2, 3] : [4, 5, 6];
```

Here:
1. `condition` has type `Bool`
2. The "then" branch has type `Array<Number>`
3. The "else" branch has type `Array<Number>`
4. We unify these types, resulting in `result` having type `Array<Number>`

This emphasizes that the branches must be compatible types, but don't have to be identical expressions.

## Arrays and Parametric Polymorphism (10 minutes)

Arrays introduce parametric polymorphism to our type system, as an array's type depends on the type of its elements.

### Typing Array Literals

For an array literal like `[1, 2, 3]`:

1. Infer the type of each element (here, all `Number`)
2. Unify these types to find the element type (`Number`)
3. The array's type is `Array<Number>` (an array of numbers)

When array elements have different apparent types:

```javascript
const mixed = [1, "two"];
```

1. Element `1` has type `Number`
2. Element `"two"` has type `String`
3. We can't unify these in our simple type system, resulting in a type error

### Empty Arrays and Type Variables

Empty arrays are especially interesting:

```javascript
const emptyArray = [];
```

Here we can't immediately determine the element type, so we assign:
1. A fresh type variable `t0` for the element type
2. The array gets type `Array<t0>`

This type variable will later be unified when the array is used.

### Parametric Polymorphism in Array Operations

The real power comes with generic array operations. Consider:

```javascript
const first = array => array[0];
```

Here:
1. Parameter `array` gets type variable `Array<t0>` (an array of some type)
2. The result of the indexing operation has type `t0`
3. The function type is `Array<t0> -> t0` (a polymorphic function!)

This means `first` can work on arrays of any type, preserving the element type:

```javascript
const a = first([1, 2, 3]);        // a: Number
const b = first(["one", "two"]);   // b: String
```

### Type Variable Diagrams

Here's a diagram showing how type variables flow through array operations:

```
                   +--------+
array argument --> Array<t0> ---+  
                               |
                               v
                              t0 <-- element type
                               |
                               v
                              t0 <-- return type
```

When we call a polymorphic array function with concrete types:

```
first([1, 2, 3])

                   +--------+
[1, 2, 3] -------> Array<t0> 
                      |
                      | unify t0 with Number
                      v
                    Number <-- return type
```

### A Powerful Example of Polymorphism

Let's examine a function that returns the first element of an array:

```javascript
const getFirstElement = (arr) => {
  return arr[0];
};

const nums = [1, 2, 3];
const firstNum = getFirstElement(nums);

const strings = ["a", "b", "c"];
const firstString = getFirstElement(strings);
```

The type inference is fascinating:

1. `arr` gets type `Array<t0>`
2. `arr[0]` has type `t0`
3. Function's return type is `t0`
4. The function type is `Array<t0> -> t0`

When we call the function:
- With `nums`, `t0` unifies with `Number`
- With `strings`, `t0` unifies with `String`

This shows that the same function can work with different types without explicit generics/templates syntax.

## Conclusion (2 minutes)

We've covered:

1. How function type inference tracks type variables through parameter types and return values
2. How conditionals (ternaries) unify the types of their branches
3. How arrays introduce parametric polymorphism, allowing operations to work generically on arrays of any type

The key insight from Hindley-Milner systems is that we can start with broad type variables and progressively constrain them through unification, discovering the most general type that works for any given expression.

This approach to type inference is not only elegant but practical, forming the foundation of type systems in languages like Haskell, ML, and influencing TypeScript and many other modern languages.