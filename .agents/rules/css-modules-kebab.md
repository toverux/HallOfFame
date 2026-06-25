---
paths:
  - "**/*.scss"
---

Use kebab-case for all CSS class names, including CSS Module scoped classes in `*.module.css` files.
They are converted from kebab-case to camelCase in TypeScript: `.class-name` becomes
`styles.className`.
