# LLM Prompt Evaluation

Promptfoo-based evaluation suite for GitPulse report generation prompts.

## Purpose

Tests production prompts against real model outputs to catch:
- Citation validation failures
- Markdown structure issues
- Output quality regressions

## Running Evaluations

```bash
# Run full evaluation suite
npx promptfoo eval

# Run with specific config
npx promptfoo eval -c evals/promptfooconfig.yaml

# View results in UI
npx promptfoo view
```

## Structure

```
evals/
├── promptfooconfig.yaml  # Evaluation configuration
└── prompts/              # Prompt templates under test
    ├── daily-report.txt
    └── weekly-report.txt
```

## Key Assertions

- Contains GitHub citations (`github.com`)
- Proper markdown structure (`##` headings)
- Non-trivial output length (>100 chars)

## See Also

- [llm-evaluation skill](../.claude/skills/llm-evaluation/) - CI/CD integration patterns
- [convex/lib/generateReport.ts](../convex/lib/generateReport.ts) - Production prompts
