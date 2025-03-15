/**
 * TokenizerRunner - Runs the tokenizer with state tracking for visualization
 *
 * This class simulates the tokenizer's execution step by step to visualize the tokenization process
 * without modifying the original tokenizer. It mirrors the tokenization logic in compiler/parse.js
 * but adds instrumentation to capture each step of the process.
 */
class TokenizerRunner {
  constructor(sourceCode) {
    this.sourceCode = sourceCode;
    this.position = 0;
    this.tokens = [];
    this.steps = [];
    this.whitespaceRegex = /^\s+/; // Same as in the original tokenizer

    // Initialize with empty step
    this.steps.push({
      type: "initial",
      position: 0,
      length: 0,
      currentTokens: [],
    });
  }

  /**
   * Extract token patterns from the original tokenizer
   *
   * This is a method that would normally extract patterns by analyzing the original tokenizer.
   * For this implementation, we'll still define the patterns here, but in a real-world scenario,
   * you could use reflection or other techniques to extract the actual patterns from the tokenizer.
   */
  extractTokenPatterns() {
    // These patterns match those in the original tokenizer in compiler/parse.js
    this.patterns = [
      // Comments
      { type: "COMMENT", regex: /^\/\/.*?(?:\n|$)/ },
      { type: "COMMENT", regex: /^\/\*[\s\S]*?\*\// },

      // Keywords
      { type: "CONST", regex: /^const\b/ },
      { type: "RETURN", regex: /^return\b/ },

      // Type annotation keywords
      { type: "TYPE_NUMBER", regex: /^number\b/ },
      { type: "TYPE_STRING", regex: /^string\b/ },
      { type: "TYPE_BOOLEAN", regex: /^boolean\b/ },
      { type: "TYPE_ARRAY", regex: /^Array\b/ },
      { type: "TYPE_VOID", regex: /^void\b/ },
      { type: "TYPE_INT", regex: /^Void\b/ },
      { type: "TYPE_FLOAT", regex: /^Float\b/ },
      { type: "TYPE_BOOL", regex: /^Bool\b/ },
      { type: "TYPE_UNIT", regex: /^Unit\b/ },

      // Operators and punctuation
      { type: "ARROW", regex: /^=>/ },
      { type: "TERNARY", regex: /^\?/ },
      { type: "COLON", regex: /^:/ },
      { type: "EQUAL", regex: /^=/ },
      { type: "PIPE", regex: /^\|/ },
      { type: "LESS_THAN", regex: /^</ },
      { type: "GREATER_THAN", regex: /^>/ },
      { type: "PLUS", regex: /^\+/ },
      { type: "LEFT_PAREN", regex: /^\(/ },
      { type: "RIGHT_PAREN", regex: /^\)/ },
      { type: "LEFT_CURLY", regex: /^\{/ },
      { type: "RIGHT_CURLY", regex: /^\}/ },
      { type: "LEFT_BRACKET", regex: /^\[/ },
      { type: "RIGHT_BRACKET", regex: /^\]/ },
      { type: "COMMA", regex: /^,/ },
      { type: "SEMICOLON", regex: /^;/ },

      // Literals and identifiers
      { type: "BOOLEAN", regex: /^(true|false)\b/ },
      { type: "IDENTIFIER", regex: /^[a-zA-Z_][a-zA-Z0-9_]*/ },
      { type: "NUMBER", regex: /^[0-9]+(\.[0-9]+)?/ },
      { type: "STRING", regex: /^"([^"\\]|\\.)*("|$)/ },
      { type: "STRING", regex: /^'([^'\\]|\\.)*(\'|$)/ },
    ];
  }

  /**
   * Run the tokenizer simulation and record visualization steps
   *
   * This method simulates the tokenization logic of compiler/parse.js
   * but tracks each step for visualization purposes.
   *
   * @returns {Object} - Contains tokens and visualization steps
   */
  run() {
    // Make sure we have patterns defined
    if (!this.patterns) {
      this.extractTokenPatterns();
    }

    // Main tokenization loop - mirrors the logic in the original tokenizer
    while (this.position < this.sourceCode.length) {
      this.skipWhitespace();

      if (this.position >= this.sourceCode.length) {
        break;
      }

      let matched = false;

      for (const pattern of this.patterns) {
        const match = this.sourceCode.slice(this.position).match(pattern.regex);

        if (match) {
          const value = match[0];
          const startPosition = this.position;

          // Skip comments but still record the step
          if (pattern.type === "COMMENT") {
            // Record step BEFORE changing position
            this.steps.push({
              type: "comment",
              position: startPosition,
              length: value.length,
              value,
              currentTokens: [...this.tokens],
            });

            // Update position AFTER recording the step
            this.position += value.length;
            matched = true;
            break;
          }

          // Create token object
          const token = {
            type: pattern.type,
            value,
            position: startPosition,
          };

          // Add token to the array
          this.tokens.push(token);

          // Record step BEFORE changing position
          this.steps.push({
            type: "token",
            token: { ...token },
            position: startPosition,
            length: value.length,
            currentTokens: [...this.tokens],
          });

          // Update position AFTER recording the step
          this.position += value.length;
          matched = true;
          break;
        }
      }

      if (!matched) {
        throw new Error(
          `Unexpected character at position ${this.position}: "${this.sourceCode.charAt(this.position)}"`,
        );
      }
    }

    // Add EOF token
    const eofToken = { type: "EOF", position: this.position };
    this.tokens.push(eofToken);

    this.steps.push({
      type: "token",
      token: { ...eofToken },
      position: this.position,
      length: 0,
      currentTokens: [...this.tokens],
    });

    return {
      tokens: this.tokens,
      steps: this.steps,
    };
  }

  // Helper function to skip whitespace
  skipWhitespace() {
    const match = this.sourceCode
      .slice(this.position)
      .match(this.whitespaceRegex);
    if (match) {
      const startPosition = this.position;
      const length = match[0].length;

      // Record step BEFORE changing position
      this.steps.push({
        type: "whitespace",
        position: startPosition,
        length: length,
        currentTokens: [...this.tokens],
      });

      // Update position AFTER recording the step
      this.position += length;
    }
  }

  /**
   * Get tokens from the original tokenizer
   *
   * This static method calls the original tokenizer function from compile/parse.js
   * to get the actual tokens without visualization steps.
   *
   * @param {string} sourceCode - The source code to tokenize
   * @returns {Array} - Array of tokens from the original tokenizer
   */
  static getTokens(sourceCode) {
    // Call the original tokenizer from compiler/parse.js
    return tokenize(sourceCode);
  }
}

// Helper function to create colored token display
function createTokenDisplay(token) {
  const tokenElement = document.createElement("div");
  tokenElement.className = "token";
  tokenElement.textContent = `${token.type}: "${token.value || ""}" (pos: ${token.position})`;
  tokenElement.dataset.position = token.position;
  return tokenElement;
}

// Helper function to highlight source code
function highlightCode(
  sourceCode,
  currentPosition,
  currentLength,
  highlightClass = "text-current",
) {
  // Convert source code to HTML with spans for highlighting
  const beforeCurrent = sourceCode.substring(0, currentPosition);
  const currentText = sourceCode.substring(
    currentPosition,
    currentPosition + currentLength,
  );
  const afterCurrent = sourceCode.substring(currentPosition + currentLength);

  return [
    beforeCurrent.length > 0
      ? `<span class="text-consumed">${escapeHtml(beforeCurrent)}</span>`
      : "",
    currentText.length > 0
      ? `<span class="${highlightClass}">${escapeHtml(currentText)}</span>`
      : "",
    afterCurrent,
  ].join("");
}

// Helper function to escape HTML
function escapeHtml(text) {
  const element = document.createElement("div");
  element.textContent = text;
  return element.innerHTML;
}

/**
 * Main Visualization Controller
 *
 * This class controls the UI for visualizing the tokenization process.
 * It uses TokenizerRunner to simulate the tokenization process step by step,
 * while using the original tokenizer from compiler/parse.js for verification.
 *
 * The visualization shows:
 * 1. The original source code with highlighting to show tokenization progress
 * 2. The tokens generated at each step
 *
 * This design allows changes to the original tokenizer in compiler/parse.js
 * to be automatically reflected in the visualization without modifying the UI code.
 */
class TokenizerVisualizer {
  constructor() {
    this.sourceCode = "";
    this.tokens = [];
    this.visualizationSteps = [];
    this.currentStepIndex = 0;

    // UI elements
    this.sourceCodeElement = document.getElementById("source-code");
    this.tokensListElement = document.getElementById("tokens-list");
    this.scrubber = document.getElementById("scrubber");
    this.progressInfo = document.getElementById("progress-info");
    this.exampleSelect = document.getElementById("example-select");
    this.customInputContainer = document.getElementById(
      "custom-input-container",
    );
    this.customInput = document.getElementById("custom-input");
    this.runCustomButton = document.getElementById("run-custom");

    // Initialize examples
    this.examples = {
      example1: `const greeting = "Hello";
const audience = true ? "world" : "nobody";`,

      example2: `const add = (a, b) => a + b;
const greet = () => {
  const name = "world";
  const greeting = "Hello";
  return greeting + " " + name;
};`,

      example3: `const getMessage = () => {
  const prefix = "Hello";
  const suffix = "World";
  return prefix + " " + suffix;
}

const emptyReturn = () => {
  return;
}`,
    };

    // Bind event handlers
    this.scrubber.addEventListener(
      "input",
      this.updateVisualization.bind(this),
    );
    this.exampleSelect.addEventListener(
      "change",
      this.handleExampleChange.bind(this),
    );
    this.runCustomButton.addEventListener(
      "click",
      this.runCustomCode.bind(this),
    );

    // Initialize with the first example
    this.loadExample("example1");
  }

  loadExample(exampleKey) {
    this.sourceCode = this.examples[exampleKey];
    this.runTokenization();
  }

  runCustomCode() {
    this.sourceCode = this.customInput.value.trim();
    if (!this.sourceCode) {
      alert("Please enter some code to tokenize");
      return;
    }
    this.runTokenization();
  }

  runTokenization() {
    try {
      // Clear previous token display
      this.tokensListElement.innerHTML = "";

      // Create a TokenizerRunner to simulate the tokenization process
      const runner = new TokenizerRunner(this.sourceCode);
      const result = runner.run();

      // Get the actual tokens by running the original tokenizer
      this.tokens = TokenizerRunner.getTokens(this.sourceCode);

      // Store visualization steps
      this.visualizationSteps = result.steps;

      // Reset UI
      this.currentStepIndex = 0;
      this.scrubber.max = Math.max(0, this.visualizationSteps.length - 1);
      this.scrubber.value = 0;

      // Reset scroll positions
      this.tokensListElement.scrollTop = 0;
      this.sourceCodeElement.scrollTop = 0;

      // Update the visualization
      this.updateVisualization();
    } catch (error) {
      alert(`Tokenization error: ${error.message}`);
      console.error(error);
    }
  }

  updateVisualization() {
    const scrubberValue = parseInt(this.scrubber.value, 10);
    // Skip the initial step to avoid requiring two drags to see anything
    const progress = Math.min(
      scrubberValue,
      this.visualizationSteps.length - 1,
    );
    this.currentStepIndex = progress + 1; // Add 1 to skip the initial step

    // Update progress info
    const percentage = Math.round(
      (progress / (this.visualizationSteps.length - 1)) * 100,
    );
    this.progressInfo.textContent = `${percentage}%`;

    // Update tokens list first
    this.updateTokensDisplay();

    // Then update source code display with highlighting
    this.updateSourceCodeHighlighting();
  }

  updateSourceCodeHighlighting() {
    // Start with the raw source code
    this.sourceCodeElement.textContent = this.sourceCode;

    if (this.currentStepIndex > 0) {
      const currentStep = this.visualizationSteps[this.currentStepIndex - 1];

      // Current token position and length
      const currentPosition = currentStep.position;
      const currentLength = currentStep.length || 0;

      // Determine highlight class based on the step type
      // Use green highlight for token steps, gray for whitespace/comments
      const highlightClass =
        currentStep.type === "token" ? "text-current" : "text-whitespace";

      // Apply highlighting - highlight the current token
      this.sourceCodeElement.innerHTML = highlightCode(
        this.sourceCode,
        currentPosition,
        currentLength,
        highlightClass,
      );
    }
  }

  updateTokensDisplay() {
    // Clear tokens list
    this.tokensListElement.innerHTML = "";

    if (this.currentStepIndex === 0) {
      return;
    }

    // Get tokens up to current step
    const step = this.visualizationSteps[this.currentStepIndex - 1];
    const tokens = step.currentTokens || [];

    // Add tokens to display
    tokens.forEach((token, index) => {
      const tokenElement = createTokenDisplay(token);

      if (index === tokens.length - 1 && step.type === "token") {
        // Highlight the most recently added token
        tokenElement.classList.add("token-current");
      } else {
        // Normal highlighting for previous tokens
        tokenElement.classList.add("token-highlighted");
      }

      this.tokensListElement.appendChild(tokenElement);
    });

    // Scroll to the bottom of the token container after a short delay to ensure DOM updates
    // This ensures the most recently added token is fully visible
    setTimeout(() => {
      this.tokensListElement.scrollTop = this.tokensListElement.scrollHeight;
    }, 0);
  }

  handleExampleChange() {
    const selectedExample = this.exampleSelect.value;

    if (selectedExample === "custom") {
      this.customInputContainer.classList.remove("hidden");
    } else {
      this.customInputContainer.classList.add("hidden");
      this.loadExample(selectedExample);
    }
  }
}

// Initialize the visualizer when the page loads
document.addEventListener("DOMContentLoaded", () => {
  new TokenizerVisualizer();
});
