import ZaFlow, { defineAgent, defineTool, defineProvider } from '../src';
import { z } from 'zod';

/**
 * AUTONOMOUS Mode Example
 * Multi-agent workflow with specialized agents
 */

async function main() {
  // Define tools
  const searchTool = defineTool({
    name: 'web_search',
    description: 'Search the web for information',
    schema: z.object({
      query: z.string().describe('Search query'),
    }),
    execute: async (args) => {
      console.log(`[TOOL] Searching for: ${args.query}...`);
      // Simulated search
      return {
        results: [
          {
            title: 'AI Trends 2024',
            snippet: 'Latest developments in AI including LLMs, multimodal models, and agent systems...',
          },
          {
            title: 'Machine Learning Advances',
            snippet: 'Recent breakthroughs in ML research and applications...',
          },
        ],
      };
    },
  });

  const analysisTool = defineTool({
    name: 'analyze_data',
    description: 'Analyze data and extract insights',
    schema: z.object({
      data: z.string().describe('Data to analyze'),
    }),
    execute: async (args) => {
      console.log('[TOOL] Analyzing data...');
      return {
        insights: 'Key trends: Growth in agentic AI, focus on efficiency, integration with existing workflows',
        summary: 'Analysis shows significant progress in AI agent systems',
      };
    },
  });

  // Define sub-agents
  const researchAgent = defineAgent({
    name: 'researcher',
    role: 'research specialist',
    systemPrompt: 'You are an expert researcher. Find accurate and relevant information.',
    tools: [searchTool],
    model: 'llama-3.1-8b-instant',
    config: {
      temperature: 0.3,
    },
    capabilities: ['research', 'information_gathering', 'web_search'],
  });

  const analystAgent = defineAgent({
    name: 'analyst',
    role: 'data analyst',
    systemPrompt: 'You are a data analyst. Analyze information and extract insights.',
    tools: [analysisTool],
    model: 'llama-3.1-8b-instant',
    config: {
      temperature: 0.5,
    },
    capabilities: ['analysis', 'data_processing', 'insights'],
  });

  // Define provider
  const provider = defineProvider({
    name: 'groq',
    type: 'groq',
    apiKey: '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',
    defaultModel: 'moonshotai/kimi-k2-instruct-0905',
  });

  // Create flow in AUTONOMOUS mode
  const flow = new ZaFlow({
    mode: 'autonomous',
    provider,
    model: 'moonshotai/kimi-k2-instruct-0905',
    agents: [researchAgent, analystAgent],
    tools: [searchTool, analysisTool],
    config: {
      temperature: 0.7,
      maxTokens: 4000,
    },
    hooks: {
      onAgentStart: (agentName) => {
        console.log(`\n[AGENT] ${agentName} started`);
      },
      onAgentComplete: (agentName, output) => {
        console.log(`[AGENT] ${agentName} completed`);
      },
      onToolCall: (toolName, args) => {
        console.log(`[TOOL] ${toolName} called`);
      },
    },
  });

  for await (const chunk of flow.stream('Research the latest AI trends and analyze their market impact')) {
    process.stdout.write(chunk);
  }
}

main().catch(console.error);
