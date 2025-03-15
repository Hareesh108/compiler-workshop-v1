# Compiler Visualization Tool

This visualization tool provides an interactive way to understand the compilation process for our simple compiler. It currently focuses on the tokenization phase of compilation.

## Features

- Interactive scrubber to progress through the compilation stages
- Visualizes tokenization step-by-step
- Highlights source code as it's being consumed by the tokenizer
- Displays tokens as they're generated 
- Comes with several pre-built examples
- Supports custom code input

## How to Use

1. Open `index.html` in your web browser (just double-click the file or open it with your browser)
2. Use the scrubber to step through the tokenization process:
   - As you move the scrubber, more of the source code will be highlighted
   - Already consumed text is shown with a light gray background
   - Currently being consumed text is highlighted in green
   - Tokens generated so far are displayed on the right
   - The most recently generated token is highlighted in green

3. Select an example from the dropdown or enter your own code to tokenize

## Architecture

The visualization tool modifies the existing tokenizer to record all steps:

- The tool intercepts and instruments the original `tokenize` function
- The instrumented version records detailed steps as tokens are generated
- It doesn't affect the behavior of the tokenizer when called from Node.js

### File Structure

- `index.html` - Main HTML file (in the project root)
- `ui/styles.css` - CSS styles for the visualization
- `ui/visualizer.js` - JavaScript code for the visualization
- `compiler/*.js` - The original compiler code (unchanged)

## Coming Soon

- Parse tree visualization (AST)
- Name resolution visualization
- Type checking visualization

## Notes for Instructors

This tool is designed to help students understand the compilation process. Some teaching ideas:

- Ask students to predict what tokens will be generated for a given input
- Modify the examples to include syntax errors and observe the tokenizer's behavior
- Discuss how the tokenizer differentiates between different types of tokens
- Explore how comments and whitespace are handled during tokenization