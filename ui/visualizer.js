// Modify the tokenize function to record token positions and steps
(function() {
  // Store original tokenize function
  const originalTokenize = tokenize;
  
  // Override with instrumented version that records token generation steps
  tokenize = function(sourceCode) {
    // Store steps for visualization
    const steps = [];
    const tokens = [];
    let position = 0;
    
    // Regular expression to identify whitespace
    const whitespaceRegex = /^\s+/;
    
    // Token patterns from the original tokenizer
    const patterns = [
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
    
    function skipWhitespace() {
      const match = sourceCode.slice(position).match(whitespaceRegex);
      if (match) {
        // Record whitespace skipping as a step
        const oldPosition = position;
        position += match[0].length;
        
        steps.push({
          type: 'whitespace',
          position: oldPosition,
          length: match[0].length,
          currentTokens: [...tokens]
        });
      }
    }
    
    // Main tokenization loop
    while (position < sourceCode.length) {
      skipWhitespace();
      
      if (position >= sourceCode.length) {
        break;
      }
      
      let matched = false;
      
      for (const pattern of patterns) {
        const match = sourceCode.slice(position).match(pattern.regex);
        
        if (match) {
          const value = match[0];
          
          // Skip comments but still record the step
          if (pattern.type === "COMMENT") {
            const oldPosition = position;
            position += value.length;
            
            steps.push({
              type: 'comment',
              position: oldPosition,
              length: value.length,
              value,
              currentTokens: [...tokens]
            });
            
            matched = true;
            break;
          }
          
          // Create token object
          const token = {
            type: pattern.type,
            value,
            position,
          };
          
          tokens.push(token);
          
          // Record this step for visualization
          steps.push({
            type: 'token',
            token: { ...token },
            position,
            length: value.length,
            currentTokens: [...tokens]
          });
          
          position += value.length;
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        throw new Error(
          `Unexpected character at position ${position}: "${sourceCode.charAt(position)}"`,
        );
      }
    }
    
    // Add EOF token
    const eofToken = { type: "EOF", position };
    tokens.push(eofToken);
    
    steps.push({
      type: 'token',
      token: { ...eofToken },
      position,
      length: 0,
      currentTokens: [...tokens]
    });
    
    // Store the steps for visualization
    tokens.visualizationSteps = steps;
    
    return tokens;
  };
})();

// Helper function to create colored token display
function createTokenDisplay(token) {
  const tokenElement = document.createElement('div');
  tokenElement.className = 'token';
  tokenElement.textContent = `${token.type}: "${token.value || ''}" (pos: ${token.position})`;
  tokenElement.dataset.position = token.position;
  return tokenElement;
}

// Helper function to highlight source code
function highlightCode(sourceCode, consumedUntil, currentConsuming) {
  // Convert source code to HTML with spans for highlighting
  const beforeConsumed = sourceCode.substring(0, consumedUntil);
  const currentText = sourceCode.substring(consumedUntil, consumedUntil + currentConsuming);
  const afterCurrent = sourceCode.substring(consumedUntil + currentConsuming);
  
  return [
    beforeConsumed.length > 0 ? `<span class="text-consumed">${escapeHtml(beforeConsumed)}</span>` : '',
    currentText.length > 0 ? `<span class="text-current">${escapeHtml(currentText)}</span>` : '',
    afterCurrent
  ].join('');
}

// Helper function to escape HTML
function escapeHtml(text) {
  const element = document.createElement('div');
  element.textContent = text;
  return element.innerHTML;
}

// Main visualization controller
class TokenizerVisualizer {
  constructor() {
    this.sourceCode = '';
    this.tokens = [];
    this.visualizationSteps = [];
    this.currentStepIndex = 0;
    
    // UI elements
    this.sourceCodeElement = document.getElementById('source-code');
    this.tokensListElement = document.getElementById('tokens-list');
    this.scrubber = document.getElementById('scrubber');
    this.progressInfo = document.getElementById('progress-info');
    this.exampleSelect = document.getElementById('example-select');
    this.customInputContainer = document.getElementById('custom-input-container');
    this.customInput = document.getElementById('custom-input');
    this.runCustomButton = document.getElementById('run-custom');
    
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
}`
    };
    
    // Bind event handlers
    this.scrubber.addEventListener('input', this.updateVisualization.bind(this));
    this.exampleSelect.addEventListener('change', this.handleExampleChange.bind(this));
    this.runCustomButton.addEventListener('click', this.runCustomCode.bind(this));
    
    // Initialize with the first example
    this.loadExample('example1');
  }
  
  loadExample(exampleKey) {
    this.sourceCode = this.examples[exampleKey];
    this.runTokenization();
  }
  
  runCustomCode() {
    this.sourceCode = this.customInput.value.trim();
    if (!this.sourceCode) {
      alert('Please enter some code to tokenize');
      return;
    }
    this.runTokenization();
  }
  
  runTokenization() {
    try {
      // Run tokenization and get the tokens with visualization steps
      this.tokens = tokenize(this.sourceCode);
      this.visualizationSteps = this.tokens.visualizationSteps || [];
      
      // Reset UI
      this.currentStepIndex = 0;
      this.scrubber.max = this.visualizationSteps.length;
      this.scrubber.value = 0;
      
      // Update the visualization
      this.updateVisualization();
    } catch (error) {
      alert(`Tokenization error: ${error.message}`);
      console.error(error);
    }
  }
  
  updateVisualization() {
    const scrubberValue = parseInt(this.scrubber.value, 10);
    const progress = Math.min(scrubberValue, this.visualizationSteps.length);
    this.currentStepIndex = progress;
    
    // Update progress info
    const percentage = Math.round((progress / this.visualizationSteps.length) * 100);
    this.progressInfo.textContent = `${percentage}%`;
    
    // Update source code display with highlighting
    this.updateSourceCodeHighlighting();
    
    // Update tokens list
    this.updateTokensDisplay();
  }
  
  updateSourceCodeHighlighting() {
    // Start with the raw source code
    this.sourceCodeElement.textContent = this.sourceCode;
    
    if (this.currentStepIndex > 0) {
      const step = this.visualizationSteps[this.currentStepIndex - 1];
      
      // Determine how much of the source code has been consumed
      let consumedUntil = step.position + (step.length || 0);
      
      // For the current step, highlight it differently
      let currentConsuming = 0;
      if (this.currentStepIndex < this.visualizationSteps.length) {
        const nextStep = this.visualizationSteps[this.currentStepIndex];
        currentConsuming = nextStep.length || 0;
      }
      
      // Apply highlighting
      this.sourceCodeElement.innerHTML = highlightCode(
        this.sourceCode, 
        consumedUntil, 
        currentConsuming
      );
    }
  }
  
  updateTokensDisplay() {
    // Clear tokens list
    this.tokensListElement.innerHTML = '';
    
    if (this.currentStepIndex === 0) {
      return;
    }
    
    // Get tokens up to current step
    const step = this.visualizationSteps[this.currentStepIndex - 1];
    const tokens = step.currentTokens || [];
    
    // Add tokens to display
    tokens.forEach((token, index) => {
      const tokenElement = createTokenDisplay(token);
      
      if (index === tokens.length - 1 && step.type === 'token') {
        // Highlight the most recently added token
        tokenElement.classList.add('token-current');
      } else {
        // Normal highlighting for previous tokens
        tokenElement.classList.add('token-highlighted');
      }
      
      this.tokensListElement.appendChild(tokenElement);
    });
  }
  
  handleExampleChange() {
    const selectedExample = this.exampleSelect.value;
    
    if (selectedExample === 'custom') {
      this.customInputContainer.classList.remove('hidden');
    } else {
      this.customInputContainer.classList.add('hidden');
      this.loadExample(selectedExample);
    }
  }
}

// Initialize the visualizer when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new TokenizerVisualizer();
});