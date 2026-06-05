## Design Philosophy
- Write simple, straightforward, and readable code.
- Follow the Single Responsibility Principle (SRP).
- Implement Fail Fast and Early Return.
- Separate Agent "Role" (identity) from "Knowledge" (business rules) to keep functions general.
- Main functions act as Orchestrators: MUST validate all inputs.
- Hidden functions act as Specialists: Do NOT validate inputs (assume inputs are valid).
- Optimize for modular, batch-processed operations to minimize API limits.

## Coding Standard & Architecture
- Follow the `src` layout.
- Use `const` by default, `let` when reassignment is needed. Never use `var`.
- Write Pure Functions.
- Use `async/await` for asynchronous operations.
- Handle `try/catch` at the Main function level.
- Use Nested SCSS for core application styling instead of Tailwind CSS.

## Naming Conventions
- Variables and Functions: `camelCase`.
- Classes and Components: `PascalCase`.
- Hidden/Internal Functions: Prefix with `_`.
- Prioritize descriptive names over abbreviations.

## Documentation & Comments (JSDoc)
- Comments must explain the "Why", never the "What".
- Use numbered line comments (`// 1.`, `// 2.`) to clearly separate steps in orchestrator or multi-step functions.
- Use `TODO:` and `FIXME:` systematically.
- Use `@fileoverview` for modules.
- Use `@param`, `@returns`, and `@throws` for Main functions.
- Omit JSDoc for simple hidden/helper functions.