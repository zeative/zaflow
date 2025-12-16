Baik, saya akan rebuild dan test. Silakan jalankan:

```bash
# Rebuild
bun run build

# Test agentic mode dengan debug logs
bun run example:agentic
```

**Yang sudah saya tambahkan:**

1. Debug logging di `GroqProvider` untuk track:

   - Berapa tools yang dikirim
   - Model apa yang digunakan
   - Response finish_reason
   - Apakah ada tool_calls di response

2. Debug logging di `ZaFlow.runAgentic()` untuk track:
   - Tool calls dari native provider
   - Tool calls yang di-parse dari content (fallback)

**Kemungkinan masalah:**

- Model `moonshotai/kimi-k2-instruct-0905` mungkin **tidak support tool calling** di Groq
- Coba ganti ke model yang pasti support seperti `llama-3.1-70b-versatile` atau `mixtral-8x7b-32768`

Atau buat file test sederhana dulu untuk validasi:

```typescript
// test-tool.ts
import { defineProvider, defineTool, ZaFlow } from './src';
import { z } from 'zod';

const tool = defineTool({
  name: 'add',
  description: 'Add two numbers',
  schema: z.object({
    a: z.number(),
    b: z.number(),
  }),
  execute: async (args) => {
    console.log('[TOOL EXECUTED]', args);
    return { result: args.a + args.b };
  },
});

const provider = defineProvider({
  name: 'groq',
  type: 'groq',
  apiKey: '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',
  defaultModel: 'llama-3.1-70b-versatile', // Model yang support tool calling
});

const flow = new ZaFlow({
  mode: 'agentic',
  provider,
  model: 'llama-3.1-70b-versatile',
  tools: [tool],
});

flow.run('Calculate 5 + 3', { detailed: true }).then((res) => {
  console.log('\nResponse:', res.content);
  console.log('Metadata:', res.metadata);
});
```

Jalankan test ini untuk memastikan tool calling berfungsi dengan model yang benar.
