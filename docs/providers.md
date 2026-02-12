# Providers Guide

Configure and use different LLM providers with MCP Tool Factory.

## Overview

MCP Tool Factory supports **10 LLM providers** through the [Vercel AI SDK](https://sdk.vercel.ai/). A single `UnifiedLLMProvider` class handles all AI SDK-backed providers with lazy dynamic imports — only the `@ai-sdk/*` package for your chosen provider is loaded at runtime.

| Provider | Best For | Default Model | Package |
|----------|----------|---------------|---------|
| Anthropic | Highest quality | claude-sonnet-4-5-20250929 | `@ai-sdk/anthropic` |
| OpenAI | Fast generation | gpt-5.2 | `@ai-sdk/openai` |
| Google | Cost effective | gemini-3-pro-preview | `@ai-sdk/google` |
| Mistral | European AI, code | mistral-large-2411 | `@ai-sdk/mistral` |
| DeepSeek | Ultra low cost | deepseek-chat | `@ai-sdk/deepseek` |
| Groq | Ultra-fast inference | llama-3.3-70b-versatile | `@ai-sdk/groq` |
| xAI | Reasoning | grok-4-0709 | `@ai-sdk/xai` |
| Azure | Enterprise compliance | gpt-4o | `@ai-sdk/azure` |
| Cohere | RAG, enterprise search | command-a-03-2025 | `@ai-sdk/cohere` |
| Claude Code | Claude Code users | claude-sonnet-4-5-20250929 | (built-in) |

## Provider Selection

### Automatic Detection

The factory auto-detects providers from environment variables:

```bash
# Set one of these
export ANTHROPIC_API_KEY=sk-ant-api03-...
export OPENAI_API_KEY=sk-...
export GOOGLE_API_KEY=AIza...
export MISTRAL_API_KEY=...
export DEEPSEEK_API_KEY=...
export GROQ_API_KEY=...
export XAI_API_KEY=...
export AZURE_OPENAI_API_KEY=...
export COHERE_API_KEY=...
```

Priority order:
1. `ANTHROPIC_API_KEY` → Anthropic
2. `CLAUDE_CODE_OAUTH_TOKEN` → Claude Code
3. `OPENAI_API_KEY` → OpenAI
4. `GOOGLE_API_KEY` → Google
5. Other providers checked in order

### Explicit Selection (CLI)

```bash
mcp-factory generate "..." --provider anthropic
mcp-factory generate "..." --provider openai
mcp-factory generate "..." --provider google
mcp-factory generate "..." --provider mistral
mcp-factory generate "..." --provider deepseek
mcp-factory generate "..." --provider groq
mcp-factory generate "..." --provider xai
mcp-factory generate "..." --provider azure
mcp-factory generate "..." --provider cohere
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
| claude-opus-4-6 | 200K | Most intelligent, adaptive thinking |
| claude-sonnet-4-5-20250929 | 200K | Best for agents & coding (recommended) |
| claude-opus-4-5-20251101 | 200K | Previous most intelligent |
| claude-haiku-4-5-20251001 | 200K | Fastest, near-frontier performance |
| claude-sonnet-4-20250514 | 200K | Claude 4.0, balance of speed/quality |

### CLI Usage

```bash
# Default (claude-sonnet-4-5-20250929)
mcp-factory generate "Create weather tools"

# Specific model
mcp-factory generate "Create complex analytics tools" \
  --provider anthropic \
  --model claude-opus-4-6
```

### API Usage

```typescript
import { ToolFactoryAgent, LLMProvider } from 'mcp-tool-factory';

const agent = new ToolFactoryAgent({
  config: {
    provider: LLMProvider.ANTHROPIC,
    model: 'claude-sonnet-4-5-20250929',
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
| gpt-5.2 | 400K | Most capable (recommended) |
| gpt-5.2-codex | 400K | Advanced agentic coding |
| gpt-5.1 | 400K | Reasoning control |
| gpt-5 | 400K | State-of-the-art coding |
| gpt-5-mini | 128K | Fast, efficient |
| o3 | 200K | Reasoning for math, science |
| o4-mini | 200K | Fast reasoning |

> **Note:** Temperature is automatically omitted for o-series and gpt-5.x models that use the OpenAI responses API.

### CLI Usage

```bash
# Default (gpt-5.2)
mcp-factory generate "Create data tools" --provider openai

# Specific model
mcp-factory generate "Create simple tools" \
  --provider openai \
  --model gpt-5-mini
```

### API Usage

```typescript
import { ToolFactoryAgent, LLMProvider } from 'mcp-tool-factory';

const agent = new ToolFactoryAgent({
  config: {
    provider: LLMProvider.OPENAI,
    model: 'gpt-5.2',
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
| gemini-3-pro-preview | 1M | State-of-the-art reasoning (recommended) |
| gemini-3-flash-preview | 1M | Pro intelligence at Flash speed |
| gemini-2.5-pro | 1M | Advanced reasoning |
| gemini-2.5-flash | 1M | Fast with controllable thinking |
| gemini-2.5-flash-lite | 1M | Lowest cost, massive scale |

### CLI Usage

```bash
# Default (gemini-3-pro-preview)
mcp-factory generate "Create tools" --provider google

# Specific model
mcp-factory generate "Create complex tools" \
  --provider google \
  --model gemini-2.5-pro
```

### API Usage

```typescript
import { ToolFactoryAgent, LLMProvider } from 'mcp-tool-factory';

const agent = new ToolFactoryAgent({
  config: {
    provider: LLMProvider.GOOGLE,
    model: 'gemini-3-pro-preview',
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

---

## Mistral AI

### Setup

1. Get API key from [console.mistral.ai](https://console.mistral.ai/)
2. Set environment variable:

```bash
export MISTRAL_API_KEY=...
```

### Available Models

| Model | Best For |
|-------|---------|
| mistral-large-2411 | Top-tier reasoning, function calling (recommended) |
| mistral-small-2506 | 24B params, improved function calling |
| magistral-medium-2506 | Multi-step reasoning, chain-of-thought |
| codestral-2508 | Code generation, 80+ languages, FIM support |
| pixtral-large-2411 | 124B multimodal, frontier image understanding |

---

## DeepSeek

### Setup

```bash
export DEEPSEEK_API_KEY=...
```

### Available Models

| Model | Best For |
|-------|---------|
| deepseek-chat | V3.2 general purpose, 671B MoE (recommended) |
| deepseek-reasoner | V3.2 extended reasoning, chain-of-thought |

---

## Groq

### Setup

```bash
export GROQ_API_KEY=...
```

### Available Models

| Model | Best For |
|-------|---------|
| llama-3.3-70b-versatile | 128K context, ultra-fast (recommended) |
| llama-3.1-8b-instant | Ultra-fast for simple tasks |
| meta-llama/llama-4-maverick-17b-128e-instruct | 128 experts MoE, multimodal |
| qwen/qwen-3-32b | General purpose |
| deepseek-r1-distill-llama-70b | Reasoning |

---

## xAI Grok

### Setup

```bash
export XAI_API_KEY=...
```

### Available Models

| Model | Best For |
|-------|---------|
| grok-4-0709 | Flagship reasoning model (recommended) |
| grok-4-fast-reasoning | Optimized reasoning speed |
| grok-3-beta | General purpose, 131K context |
| grok-code-fast-1 | Specialized code generation |

---

## Azure OpenAI

### Setup

```bash
export AZURE_OPENAI_API_KEY=...
```

Uses the same models as OpenAI but hosted on Azure for enterprise compliance.

---

## Cohere

### Setup

```bash
export COHERE_API_KEY=...
```

### Available Models

| Model | Best For |
|-------|---------|
| command-a-03-2025 | 111B, strongest, 256K context (recommended) |
| command-a-vision-07-2025 | Multimodal, 128K context, OCR |
| command-a-reasoning | Chain-of-thought thinking |
| command-r-plus-08-2024 | Previous flagship |
| command-r7b-12-2024 | Smallest, fastest, edge deployment |

---

## Provider Comparison

### Cost per 1M Tokens

MCP Tool Factory includes a built-in pricing table for 50+ models. Use `--compare-costs` to see a cost comparison before generation.

| Provider | Model | Input | Output |
|----------|-------|-------|--------|
| Anthropic | claude-sonnet-4-5 | $3.00 | $15.00 |
| Anthropic | claude-opus-4-6 | $15.00 | $75.00 |
| OpenAI | gpt-5.2 | $2.00 | $8.00 |
| Google | gemini-3-pro | $1.25 | $10.00 |
| Google | gemini-2.5-flash | $0.15 | $0.60 |
| Mistral | mistral-large | $2.00 | $6.00 |
| DeepSeek | deepseek-chat | $0.27 | $1.10 |
| Groq | llama-3.3-70b | $0.59 | $0.79 |
| xAI | grok-4 | $2.00 | $10.00 |
| Cohere | command-a | $2.50 | $10.00 |

### CLI Cost Comparison

```bash
mcp-factory generate "Create weather tools" --compare-costs
```

Output:
```
Provider Cost Comparison (estimated for ~15,000 input + ~10,000 output tokens):
  groq/llama-3.3-70b-versatile      $0.0168
  deepseek/deepseek-chat             $0.0151
  google/gemini-2.5-flash            $0.0083
  openai/gpt-5.2                     $0.1100
  anthropic/claude-sonnet-4-5        $0.1950   ★ selected
```

---

## Best Practices

### 1. Use the Right Model for the Job

- **Complex APIs**: claude-opus-4-6, gpt-5.2, gemini-3-pro
- **Simple tools**: claude-haiku-4-5, gpt-5-mini, gemini-2.5-flash
- **Ultra-fast inference**: Groq (llama-3.3-70b)
- **Ultra low cost**: DeepSeek, gemini-2.5-flash-lite
- **Large context**: Gemini models (1M context)

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
| `MISTRAL_API_KEY` | Mistral | For Mistral |
| `DEEPSEEK_API_KEY` | DeepSeek | For DeepSeek |
| `GROQ_API_KEY` | Groq | For Groq |
| `XAI_API_KEY` | xAI | For xAI |
| `AZURE_OPENAI_API_KEY` | Azure | For Azure |
| `COHERE_API_KEY` | Cohere | For Cohere |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code | For Claude Code |

## Next Steps

- [Examples](examples.md) - See providers in action
- [API Reference](api-reference.md) - Programmatic usage
- [Troubleshooting](troubleshooting.md) - Common issues
