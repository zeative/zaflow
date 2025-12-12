<div align="center">
  <img alt="ZaFlow - Lightweight TypeScript library for building efficient AI agent flows." src="https://socialify.git.ci/zeative/zaflow/image?custom_description=Lightweight+TypeScript+library+for+building+efficient+AI+agent+flows.&custom_language=TypeScript&description=1&font=Inter&language=1&owner=1&pattern=Charlie+Brown&theme=Auto">

  <h1 align="center">Lightweight TypeScript library for building efficient AI agent flows.</h1>

<a href="https://www.npmjs.com/package/zaflow"><img src="https://img.shields.io/npm/v/zaflow.svg" alt="NPM Version"></a>
<a href="https://www.npmjs.com/package/zaflow"><img src="https://img.shields.io/npm/dw/zaflow?label=npm&color=%23CB3837" alt="NPM Downloads"></a>
<a href="https://github.com/zeative/zaflow/releases"><img src="https://img.shields.io/npm/dt/zaflow" alt="NPM Downloads"></a>
<a href="https://github.com/zeative/zaflow"><img src="https://img.shields.io/github/languages/code-size/zeative/zaflow" alt="GitHub Code Size"></a>
<a href="https://github.com/zeative/zaflow"><img src="https://img.shields.io/badge/TypeScript-5.0%2B-blue?style=flat-square&logo=typescript" alt="TypeScript"></a>
<a href="https://github.com/zeative/zaflow"><img src="https://img.shields.io/github/license/zeative/zaflow" alt="GitHub License"></a>
<a href="https://discord.gg/SfnWWYUe"><img alt="Discord" src="https://img.shields.io/discord/1105833273415962654?logo=discord&label=discord"></a>

  <p align="center"><b>Build powerful AI agents in minutes, not hours.</b><br>A blazing-fast, lightweight orchestration library for multi-agent workflows, tool calling, and flow control.</p>

</div>

> **🚧 BETA VERSION** — This library is currently in active development and not yet recommended for production use. APIs may change without notice. Use at your own risk and feel free to report issues or contribute!

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Providers](#-providers)
- [Execution Modes](#-execution-modes)
- [Tools](#%EF%B8%8F-tools)
- [Agents](#-agents)
- [Flow Control](#-flow-control)
- [Multimodal Support](#-multimodal-support)
- [Output Formatting](#-output-formatting)
- [ExecutionContext API](#-executioncontext-api)
- [TypeScript Types](#-typescript-types)

---

## 🚀 Overview

**ZaFlow** is a lightweight yet powerful TypeScript library for building AI agent flows. Designed for developers who want full control with a simple, intuitive API.

### Why ZaFlow?

| Feature                  | Benefit                                                      |
| ------------------------ | ------------------------------------------------------------ |
| 🪶 **Lightweight**       | Bundle size < 30KB, zero bloat                               |
| 🔌 **Multi-Provider**    | OpenAI, Groq, Ollama, or custom provider                     |
| 🤖 **3 Execution Modes** | Single, Agentic, Autonomous                                  |
| 🛠️ **Tools & Agents**    | Define tools with Zod schema validation                      |
| 🎯 **Flow Control**      | Steps, conditions, loops, parallel execution                 |
| 📷 **Multimodal**        | Image, audio, file support with smart media reference system |
| 📝 **Output Format**     | Auto, JSON, WhatsApp formatting                              |

---

## ✨ Features

```
┌─────────────────────────────────────────────────────────┐
│                      ZaFlow Core                        │
├───────────────┬───────────────┬─────────────────────────┤
│   Providers   │    Agents     │         Tools           │
│ ─────────────►│ ─────────────►│ ────────────────────►   │
│ OpenAI        │ defineAgent() │ defineTool()            │
│ Groq          │ needsMedia    │ Zod Schema              │
│ Ollama        │ delegation    │ Auto-retry              │
│ Custom        │               │ Caching                 │
├───────────────┴───────────────┴─────────────────────────┤
│                   Execution Modes                       │
│  ┌──────────┐    ┌──────────┐    ┌────────────────┐    │
│  │  Single  │    │ Agentic  │    │   Autonomous   │    │
│  │ (1 call) │    │ (+ tools)│    │(+ tools/agents)│    │
│  └──────────┘    └──────────┘    └────────────────┘    │
├─────────────────────────────────────────────────────────┤
│                    Flow Control                         │
│     step() ──► if/then/else ──► loop() ──► parallel()  │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Installation

```bash
# npm
npm install zaflow

# pnpm
pnpm add zaflow

# bun
bun add zaflow
```

### Peer Dependencies (optional)

```bash
# For OpenAI provider
npm install openai

# For Groq provider
npm install groq-sdk

# For Ollama provider
npm install ollama
```

---

## ⚡ Quick Start

### Basic Usage (30 seconds!)

```typescript
import { ZaFlow, groq } from 'zaflow';

const zaflow = new ZaFlow({
  provider: groq({ apiKey: 'your-api-key' }),
});

const result = await zaflow.run('Explain quantum computing in one sentence');
console.log(result.output);
```

### With Tools

```typescript
import { ZaFlow, groq, defineTool } from 'zaflow';
import { z } from 'zod';

const calculator = defineTool({
  name: 'calculator',
  description: 'Perform mathematical calculations',
  schema: z.object({
    expression: z.string().describe('Math expression like "2 + 2"'),
  }),
  handler: ({ expression }) => eval(expression),
});

const zaflow = new ZaFlow({ provider: groq({ apiKey: 'xxx' }) }).registerTools([calculator]);

const result = await zaflow.run('What is 15 * 7 + 23?', { mode: 'agentic' });
```

---

## 🔌 Providers

### Built-in Providers

```typescript
import { openai, groq, ollama, createProvider } from 'zaflow';

// OpenAI
const openaiProvider = openai({
  apiKey: 'sk-xxx',
  model: 'gpt-4o-mini',
});

// Groq (super fast!)
const groqProvider = groq({
  apiKey: 'gsk_xxx',
  model: 'llama-3.3-70b-versatile',
});

// Ollama (local)
const ollamaProvider = ollama({
  host: 'http://localhost:11434',
  model: 'llama3.2',
});
```

### Custom Provider

```typescript
import { createProvider } from 'zaflow';

const customAI = createProvider({
  name: 'my-ai',
  handler: async ({ prompt, messages }) => {
    const res = await fetch('https://my-api.com/chat', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
    const json = await res.json();
    return json.response;
  },
});

const zaflow = new ZaFlow({ provider: customAI });
```

---

## 🎮 Execution Modes

### 1. Single Mode

One chat call without tools. Fastest and most token-efficient.

```typescript
const result = await zaflow.run('Hello!', { mode: 'single' });
```

### 2. Agentic Mode (Default)

AI can automatically call tools when needed.

```typescript
const result = await zaflow.run('Search weather in Jakarta', {
  mode: 'agentic',
  maxToolCalls: 5,
});
```

### 3. Autonomous Mode

AI can call tools AND delegate to other agents.

```typescript
const result = await zaflow.run('Analyze this image and generate a poem', {
  mode: 'autonomous',
  maxIterations: 10,
});
```

---

## 🛠️ Tools

### Defining a Tool

```typescript
import { defineTool } from 'zaflow';
import { z } from 'zod';

const weatherTool = defineTool({
  name: 'get_weather',
  description: 'Get current weather for a city',
  schema: z.object({
    city: z.string().describe('City name'),
    unit: z.enum(['celsius', 'fahrenheit']).optional(),
  }),
  handler: async ({ city, unit = 'celsius' }) => {
    const data = await fetchWeatherAPI(city);
    return `${city}: ${data.temp}°${unit === 'celsius' ? 'C' : 'F'}`;
  },
  config: {
    timeout: 10000,
    cacheable: true,
    cacheTTL: 300000,
    retryable: true,
    maxRetries: 3,
  },
});
```

### Tool with Media Handling

```typescript
const imageAnalyzer = defineTool({
  name: 'analyze_image',
  description: 'Analyze image content',
  schema: z.object({ media: z.string() }),
  handles: ['image'],
  handler: async ({ media }) => {
    return await visionAPI.analyze(media);
  },
});
```

---

## 🤖 Agents

### Defining an Agent

```typescript
import { defineAgent, groq } from 'zaflow';

const codeReviewer = defineAgent({
  name: 'Code Reviewer',
  provider: groq({ apiKey: 'xxx' }),
  model: 'llama-3.3-70b-versatile',
  prompt: `You are an expert code reviewer. 
           Review code for bugs, security issues, and best practices.`,
  temperature: 0.3,
  tools: [lintTool, securityScanTool],
});

const contentWriter = defineAgent({
  name: 'Content Writer',
  provider: groq({ apiKey: 'xxx' }),
  prompt: 'You are a creative content writer.',
  temperature: 0.8,
});

zaflow.registerAgents([codeReviewer, contentWriter]);
```

### Agent with Media Support

```typescript
const visionAgent = defineAgent({
  name: 'Vision Analyzer',
  provider: openai({ apiKey: 'xxx' }),
  needsMedia: ['image'],
  prompt: 'You analyze images and describe their content.',
});
```

---

## 🔄 Flow Control

### Steps

```typescript
zaflow
  .step('fetch', async (ctx) => {
    return await fetch('https://api.example.com/data').then((r) => r.json());
  })
  .step('process', async (ctx) => {
    const data = ctx.previous;
    return processData(data);
  })
  .step('respond', async (ctx) => {
    return await ctx.ai(`Summarize: ${JSON.stringify(ctx.previous)}`);
  });
```

### Conditional Flow

```typescript
zaflow
  .step('classify', async (ctx) => {
    return await ctx.ai('Classify this as positive or negative: ' + ctx.input);
  })
  .if((ctx) => ctx.previous.includes('positive'))
  .then([ZaFlow.step('celebrate', async () => '🎉 Great feedback!')])
  .else([
    ZaFlow.step('improve', async (ctx) => {
      return await ctx.ai('Suggest improvements for: ' + ctx.input);
    }),
  ])
  .endif();
```

### Loop

```typescript
zaflow.loop({
  condition: (ctx) => ctx.get('retryCount', 0) < 3,
  maxIterations: 5,
  steps: [
    ZaFlow.step('attempt', async (ctx) => {
      const count = ctx.get('retryCount', 0);
      ctx.set('retryCount', count + 1);
      return await tryOperation();
    }),
  ],
});
```

### Parallel Execution

```typescript
zaflow
  .parallel([
    ZaFlow.step('task1', async () => await fetchFromAPI1()),
    ZaFlow.step('task2', async () => await fetchFromAPI2()),
    ZaFlow.step('task3', async () => await fetchFromAPI3()),
  ])
  .step('combine', async (ctx) => {
    const [result1, result2, result3] = ctx.parallel;
    return combineResults(result1, result2, result3);
  });
```

---

## 📷 Multimodal Support

### Image Input

```typescript
import { msg, text, image, imageBase64 } from 'zaflow';

// From URL
const messages = [msg.user([text('What is in this image?'), image('https://example.com/photo.jpg')])];

// From Base64
const messages = [msg.user([text('Describe this:'), imageBase64(base64Data, 'image/png')])];

const result = await zaflow.run(messages, { mode: 'autonomous' });
```

### Smart Media Reference System (Token Efficient!)

ZaFlow automatically uses a reference system for large media files:

```typescript
// 20MB image is NOT copied to every agent
// Only reference ID is passed around
image(massive20MBBase64);

// Agents that need the image: needsMedia: ['image']
// → Receives full resolved data

// Agents that don't need the image
// → Media is stripped, saving tokens!
```

---

## 📝 Output Formatting

```typescript
// Auto (default) - raw output
const result = await zaflow.run(input, { format: 'auto' });

// JSON - parse/wrap as JSON
const result = await zaflow.run(input, { format: 'json' });

// WhatsApp - convert markdown to WhatsApp format
const result = await zaflow.run(input, { format: 'whatsapp' });
```

**WhatsApp Format Conversion:**
| Markdown | WhatsApp |
|----------|----------|
| `**bold**` | `*bold*` |
| `*italic*` | `_italic_` |
| `` `code` `` | ` ```code``` ` |
| `# Header` | `*Header*` |

---

## 🧠 ExecutionContext API

```typescript
zaflow.step('myStep', async (ctx) => {
  // Input & Output
  ctx.input; // Original input
  ctx.previous; // Previous step output
  ctx.parallel; // Array of parallel results

  // State Management
  ctx.set('key', value); // Store value
  ctx.get('key', defaultValue); // Retrieve value
  ctx.has('key'); // Check existence

  // Messages
  ctx.messages; // Full conversation history
  ctx.addMessage('user', 'Hello');

  // AI Helper
  const response = await ctx.ai('Your prompt here');
  const response = await ctx.ai({
    prompt: 'Complex prompt',
    model: 'gpt-4',
    temperature: 0.7,
    tools: [myTool],
  });

  // Stats
  ctx.tokens; // Token count
  ctx.cost; // Estimated cost
});
```

---

## 🎯 Execution Options

```typescript
const result = await zaflow.run(input, {
  mode: 'autonomous',
  format: 'whatsapp',
  maxIterations: 10,
  maxToolCalls: 20,
  maxTokens: 4096,
  timeout: 30000,
  signal: abortController.signal,

  onAgentEvent: (event) => {
    console.log(`[${event.type}] ${event.agent || event.tool}`);
  },
});
```

---

## 📊 Execution Result

```typescript
const result = await zaflow.run(input);

result.output; // Final response string
result.thinking; // AI's thinking process (if <think> tags used)
result.messages; // Full conversation history
result.steps; // Step-by-step execution results
result.events; // Agent/tool call events
result.duration; // Total execution time (ms)
result.stats.tokens.cost.agentCalls.toolCalls; // Usage statistics // Total tokens used // Estimated cost // Agent call counts // Tool call counts
```

---

## 📋 TypeScript Types

```typescript
import type {
  ZaFlowConfig,
  ProviderInterface,
  ToolDefinition,
  AgentDefinition,
  ExecutionContext,
  ExecutionOptions,
  ExecutionResult,
  Message,
  StepDefinition,
} from 'zaflow';
```

---

## 📄 License

MIT © [zaadevofc](https://github.com/zaadevofc)

---

<div align="center">
  <a href="https://discord.gg/SfnWWYUe"><img alt="Discord" src="https://discord.com/api/guilds/1105833273415962654/widget.png?style=banner2"></a>
  
  <br><br>
  Made with ❤️ by <a href="https://github.com/zaadevofc">zaadevofc</a>
</div>
