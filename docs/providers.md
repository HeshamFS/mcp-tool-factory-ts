# Providers Guide

Configure and use different LLM providers with MCP Tool Factory.

## Overview

MCP Tool Factory supports multiple LLM providers for natural language generation:

| Provider | Best For | Default Model |
|----------|----------|---------------|
| Anthropic | Highest quality | claude-sonnet-4-20250514 |
| OpenAI | Fast generation | gpt-4o |
| Google | Cost effective | gemini-2.0-flash |
| Claude Code | Local development | claude-sonnet-4-20250514 |

## Provider Selection

### Automatic Detection

The factory auto-detects providers from environment variables:

```bash
# Set one of these
export ANTHROPIC_API_KEY=sk-ant-api03-...
export OPENAI_API_KEY=sk-...
export GOOGLE_API_KEY=AIza...
```

Priority order:
1. `ANTHROPIC_API_KEY` → Anthropic
2. `OPENAI_API_KEY` → OpenAI
3. `GOOGLE_API_KEY` → Google

### Explicit Selection (CLI)

```bash
mcp-factory generate "..." --provider anthropic
mcp-factory generate "..." --provider openai
mcp-factory generate "..." --provider google
```

### Explicit Selection (API)

```typescript
import { ToolFactoryAgent, LLMProvider } from 'mcp-tool-factory';

const agent = new ToolFactoryAgent({
  config: {
    provider: LLMProvider.ANTHROPIC,
    model: 'claude-opus-4-20250514',
  },
});
```

---

## Anthropic Claude

### Setup

1. Get API key from [console.anthropic.com](https://console.anthropic.com/)
2. Set environment variable:

```bash
export ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Available Models

| Model | Context | Best For |
|-------|---------|----------|
| claude-opus-4-20250514 | 200K | Complex tools, best quality |
| claude-sonnet-4-20250514 | 200K | Balance of speed/quality |
| claude-3-5-haiku-20241022 | 200K | Fast, simple tools |

### CLI Usage

```bash
# Default (claude-sonnet-4-20250514)
mcp-factory generate "Create weather tools"

# Specific model
mcp-factory generate "Create complex analytics tools" \
  --provider anthropic \
  --model claude-opus-4-20250514
```

### API Usage

```typescript
import { ToolFactoryAgent, LLMProvider } from 'mcp-tool-factory';

const agent = new ToolFactoryAgent({
  config: {
    provider: LLMProvider.ANTHROPIC,
    model: 'claude-sonnet-4-20250514',
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
});
```

### Rate Limits

| Tier | Requests/min | Tokens/min |
|------|-------------|------------|
| Free | 5 | 20,000 |
| Build | 50 | 40,000 |
| Scale | 1,000 | 400,000 |

### Troubleshooting

**"Invalid API key"**
```bash
# Verify key is set
echo $ANTHROPIC_API_KEY

# Test with curl
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

---

## OpenAI GPT

### Setup

1. Get API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. Set environment variable:

```bash
export OPENAI_API_KEY=sk-...
```

### Available Models

| Model | Context | Best For |
|-------|---------|----------|
| gpt-4o | 128K | Best overall |
| gpt-4-turbo | 128K | Complex reasoning |
| gpt-4o-mini | 128K | Fast, cost effective |
| gpt-3.5-turbo | 16K | Simple tools |

### CLI Usage

```bash
# Default (gpt-4o)
mcp-factory generate "Create data tools" --provider openai

# Specific model
mcp-factory generate "Create simple tools" \
  --provider openai \
  --model gpt-4o-mini
```

### API Usage

```typescript
import { ToolFactoryAgent, LLMProvider } from 'mcp-tool-factory';

const agent = new ToolFactoryAgent({
  config: {
    provider: LLMProvider.OPENAI,
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  },
});
```

### Rate Limits

| Tier | Requests/min | Tokens/min |
|------|-------------|------------|
| Free | 3 | 40,000 |
| Tier 1 | 500 | 30,000 |
| Tier 2 | 5,000 | 450,000 |

### Troubleshooting

**"Incorrect API key"**
```bash
# Test with curl
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

---

## Google Gemini

### Setup

1. Get API key from [aistudio.google.com](https://aistudio.google.com/apikey)
2. Set environment variable:

```bash
export GOOGLE_API_KEY=AIza...
```

### Available Models

| Model | Context | Best For |
|-------|---------|----------|
| gemini-2.0-flash | 1M | Fast, large context |
| gemini-1.5-pro | 2M | Complex, huge context |
| gemini-1.5-flash | 1M | Balance speed/quality |

### CLI Usage

```bash
# Default (gemini-2.0-flash)
mcp-factory generate "Create tools" --provider google

# Specific model
mcp-factory generate "Create complex tools" \
  --provider google \
  --model gemini-1.5-pro
```

### API Usage

```typescript
import { ToolFactoryAgent, LLMProvider } from 'mcp-tool-factory';

const agent = new ToolFactoryAgent({
  config: {
    provider: LLMProvider.GOOGLE,
    model: 'gemini-2.0-flash',
    apiKey: process.env.GOOGLE_API_KEY,
  },
});
```

### Rate Limits

| Tier | Requests/min | Tokens/min |
|------|-------------|------------|
| Free | 15 | 32,000 |
| Pay-as-you-go | 360 | 4,000,000 |

### Troubleshooting

**"API key not valid"**
```bash
# Test with curl
curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_API_KEY"
```

---

## Claude Code OAuth

For use within Claude Code environment.

### Setup

```bash
export CLAUDE_CODE_OAUTH_TOKEN=your-oauth-token
```

### Usage

```bash
mcp-factory generate "Create tools" --provider claude_code
```

### API Usage

```typescript
import { ToolFactoryAgent, LLMProvider } from 'mcp-tool-factory';

const agent = new ToolFactoryAgent({
  config: {
    provider: LLMProvider.CLAUDE_CODE,
  },
});
```

---

## Provider Comparison

### Quality Matrix

| Aspect | Anthropic | OpenAI | Google |
|--------|-----------|--------|--------|
| Code Quality | Excellent | Very Good | Good |
| Tool Design | Excellent | Very Good | Good |
| Following Instructions | Excellent | Very Good | Good |
| Error Handling | Excellent | Good | Good |

### Speed Comparison

| Provider | Model | Avg Response Time |
|----------|-------|-------------------|
| OpenAI | gpt-4o-mini | ~1-2s |
| Google | gemini-2.0-flash | ~1-3s |
| Anthropic | claude-sonnet | ~2-4s |
| Anthropic | claude-opus | ~4-8s |

### Cost per 1M Tokens (approximate)

| Provider | Model | Input | Output |
|----------|-------|-------|--------|
| Anthropic | claude-sonnet | $3 | $15 |
| Anthropic | claude-opus | $15 | $75 |
| OpenAI | gpt-4o | $5 | $15 |
| OpenAI | gpt-4o-mini | $0.15 | $0.60 |
| Google | gemini-1.5-pro | $1.25 | $5 |
| Google | gemini-2.0-flash | $0.075 | $0.30 |

---

## Best Practices

### 1. Use the Right Model for the Job

- **Complex APIs**: claude-opus, gpt-4
- **Simple tools**: claude-haiku, gpt-4o-mini, gemini-flash
- **Large context**: gemini-1.5-pro (2M context)

### 2. Handle Rate Limits

```typescript
import { ToolFactoryAgent } from 'mcp-tool-factory';

const agent = new ToolFactoryAgent({
  config: {
    maxTokens: 4096,  // Limit output tokens
    temperature: 0,    // Deterministic output
  },
});
```

### 3. Use Environment Variables

Never hardcode API keys:

```typescript
// Good
const agent = new ToolFactoryAgent();  // Auto-detects from env

// Also good
const agent = new ToolFactoryAgent({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Bad - never do this
const agent = new ToolFactoryAgent({
  apiKey: 'sk-ant-api03-...',  // Don't hardcode!
});
```

### 4. Fallback Providers

Configure multiple providers for resilience:

```typescript
async function createAgentWithFallback() {
  const providers = [
    { provider: LLMProvider.ANTHROPIC, key: process.env.ANTHROPIC_API_KEY },
    { provider: LLMProvider.OPENAI, key: process.env.OPENAI_API_KEY },
    { provider: LLMProvider.GOOGLE, key: process.env.GOOGLE_API_KEY },
  ];

  for (const { provider, key } of providers) {
    if (key) {
      return new ToolFactoryAgent({
        config: { provider, apiKey: key },
      });
    }
  }

  throw new Error('No API key configured');
}
```

---

## Environment Variables Reference

| Variable | Provider | Required |
|----------|----------|----------|
| `ANTHROPIC_API_KEY` | Anthropic | For Anthropic |
| `OPENAI_API_KEY` | OpenAI | For OpenAI |
| `GOOGLE_API_KEY` | Google | For Google |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code | For Claude Code |

## Next Steps

- [Examples](examples.md) - See providers in action
- [API Reference](api-reference.md) - Programmatic usage
- [Troubleshooting](troubleshooting.md) - Common issues
