// Simple script to test the analyzer and type checker

// Create a test AST
const testAst = {
  type: "Program",
  body: [
    {
      type: "ConstDeclaration",
      id: {
        type: "Identifier",
        name: "greeting"
      },
      init: {
        type: "StringLiteral",
        value: "Hello"
      }
    },
    {
      type: "ConstDeclaration",
      id: {
        type: "Identifier",
        name: "getMessage"
      },
      init: {
        type: "ArrowFunctionExpression",
        params: [],
        body: [
          {
            type: "ReturnStatement",
            argument: {
              type: "BinaryExpression",
              operator: "+",
              left: {
                type: "Identifier",
                name: "greeting"
              },
              right: {
                type: "StringLiteral",
                value: " world"
              }
            }
          }
        ]
      }
    }
  ]
};

// Function to collect events from callbacks
function collectEvents(callback) {
  const events = [];
  return {
    callback: (event) => {
      events.push(event);
      if (callback) callback(event);
    },
    events
  };
}

// Initialize CompilerModule if needed
if (typeof window === 'undefined') {
  global.window = { CompilerModule: {} };
  const typecheck = require('./compiler/typecheck.js');
  const analyze = require('./compiler/analyze.js');
  if (analyze) {
    window.CompilerModule.analyze = analyze.analyze;
  }
}

// Run name resolution analysis
console.log("\n=== RUNNING NAME RESOLUTION ===");
const nameResolution = collectEvents((event) => {
  console.log(`Name Resolution Event: ${event.type}${event.name ? ' - ' + event.name : ''}`);
});

let nameResult;
if (window.CompilerModule.analyze) {
  nameResult = window.CompilerModule.analyze(testAst, {
    nameResolutionCallback: nameResolution.callback
  });

  if (nameResult.errors && nameResult.errors.length > 0) {
    console.log("Name resolution errors:", nameResult.errors);
  } else {
    console.log("No name resolution errors");
  }

  console.log(`Total name resolution events: ${nameResolution.events.length}`);
} else {
  console.error("analyze function not available");
}

// Run type checking
console.log("\n=== RUNNING TYPE CHECKING ===");
const typeChecker = collectEvents((event) => {
  console.log(`Type Inference Event: ${event.type}${event.typeVar ? ' - typeVar: ' + event.typeVar.id : ''}`);
});

if (window.CompilerModule.typecheck) {
  const typeResult = window.CompilerModule.typecheck(testAst, nameResult?.errors || [], {
    typeInferenceCallback: typeChecker.callback
  });

  if (typeResult.errors && typeResult.errors.length > 0) {
    console.log("Type errors:", typeResult.errors);
  } else {
    console.log("No type errors");
  }

  console.log(`Total type checking events: ${typeChecker.events.length}`);
} else {
  console.error("typecheck function not available");
}

// Print summary
console.log("\n=== SUMMARY ===");
console.log(`AST Nodes: ${countNodes(testAst)}`);
console.log(`Name Resolution Events: ${nameResolution.events.length}`);
console.log(`Type Inference Events: ${typeChecker.events.length}`);

// Count nodes in AST
function countNodes(node) {
  if (!node || typeof node !== 'object') return 0;

  let count = 1; // Count this node

  // Count nodes in arrays like body or params
  Object.values(node).forEach(value => {
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item && typeof item === 'object') {
          count += countNodes(item);
        }
      });
    } else if (value && typeof value === 'object' && value.type) {
      // Count child nodes with a type property
      count += countNodes(value);
    }
  });

  return count;
}
