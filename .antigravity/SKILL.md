---
name: Project-Embedded Autonomous Skills
description: Local AI agent skills for coding, testing, and debugging directly within the project.
---

# Project-Embedded Autonomous Skills

This project is equipped with an internal "brain" located in `.antigravity/`. These scripts allow Antigravity (and you) to automate development tasks.

## Available Skills

### 1. The Forge (`forge.py`)
**"I build things."**
Generates production-ready React components with compliant Tailwind 4 styling and automatic test generation.

- **Usage**: `python .antigravity/forge.py <ComponentName>`
- **Example**: `python .antigravity/forge.py UserProfileCard`
- **Output**:
    - `src/components/UserProfileCard.tsx`
    - `src/components/UserProfileCard.test.tsx`

### 2. The Sentinel (`sentinel.py`)
**"I watch and protect."**
Runs a full health scan of the project. It executes linting, type-checking, and unit tests, returning a JSON report.

- **Usage**: `python .antigravity/sentinel.py`
- **What it checks**:
    - **Lint**: ESLint (Next.js config)
    - **Types**: TypeScript compiler (noEmit)
    - **Tests**: Vitest (Unit & Integration)
- **Exit Code**: Returns `0` if healthy, `1` if issues are found.

## Workflow for AI Agents

When asked to "fix a bug" or "build a feature":
1.  **Code**: Use standard tools to edit files.
2.  **Verify**: Run `python .antigravity/sentinel.py` to ensure no regressions.
    - If `sentinel` fails, read the JSON output and auto-correct.

When asked to "create a component":
1.  **Scaffold**: Run `python .antigravity/forge.py NewComponent`.
2.  **Refine**: Edit the generated files to match specific requirements.
