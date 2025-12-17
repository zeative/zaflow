import type { Tool } from '../types/tool';
import type { Agent } from '../types/agent';

/**
 * Agent delegation protocol formatter
 * XML format for delegating tasks to agents
 */
export class AgentDelegationFormatter {
  /**
   * Format agents as XML for prompt injection
   */
  static formatAgentsAsXML(agents: Agent[]): string {
    let xml = '<available_agents>\n';

    for (const agent of agents) {
      const capabilities = agent.capabilities?.join(', ') || 'general tasks';
      xml += `  <agent name="${agent.name}" role="${agent.role}" capabilities="${capabilities}"/>\n`;
    }

    xml += '</available_agents>';
    return xml;
  }

  /**
   * Generate agent delegation instructions
   */
  static generateAgentInstructions(agents: Agent[], tools?: Tool[]): string {
    const agentXML = this.formatAgentsAsXML(agents);

    let instructions = `🚨 MANDATORY DELEGATION PROTOCOL 🚨

You are an orchestrator that coordinates specialized agents. You have specialized agents available to handle tasks.

${agentXML}

⚠️ CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:

1. AGENT DELEGATION IS REQUIRED: When specialized agents are available that match the user's request, you MUST delegate to them. Direct responses are FORBIDDEN.

2. DECISION PROCESS (follow this step-by-step):
   Step 1: Read the user's request carefully
   Step 2: Check if ANY available agent's role/capabilities match the request
   Step 3: If YES → You MUST use <agent_call> XML format (see below)
   Step 4: If NO agents match → Only then respond directly

3. DELEGATION FORMAT (REQUIRED when agents match):
<agent_call>
<name>exact_agent_name</name>
<task>Clear task description for the agent</task>
</agent_call>

4. EXAMPLES OF WHEN TO DELEGATE:
   - User asks for "analysis" → Delegate to "Analisis AI" (analysis agent)
   - User asks for "search" → Delegate to "Search Agent" (search agent)
   - User asks for "calculation" → Delegate to "Calculator Agent" (math agent)
   - ANY task that matches agent capabilities → MUST DELEGATE

5. MULTIPLE AGENTS: You can call multiple agents if needed. Each gets its own <agent_call> block.

6. AFTER DELEGATION: After agents complete their tasks, you will receive their results. Then synthesize into a final answer.
`;

    if (tools && tools.length > 0) {
      instructions += `\n📋 DIRECT TOOLS (only use if NO agent is appropriate):\n`;
      for (const tool of tools) {
        instructions += `- ${tool.name}: ${tool.description}\n`;
      }
      instructions += `\nUse <tool_call> format for direct tool usage (only when no agent matches).`;
    }

    instructions += `\n\n⛔ FORBIDDEN BEHAVIORS:
- Responding directly when a specialized agent is available
- Ignoring available agents
- Making up agent names that don't exist
- Skipping the <agent_call> XML format

✅ REQUIRED BEHAVIORS:
- Always check if agents match the request
- Always use proper <agent_call> XML format
- Always include both <name> and <task> tags
- Always delegate when agents are available

REMEMBER: If there's an agent that can help, you MUST delegate. This is not optional.`;

    return instructions;
  }

  /**
   * Parse agent delegation from XML in content
   */
  static parseAgentCalls(content: string): Array<{ name: string; task: string }> {
    const calls: Array<{ name: string; task: string }> = [];

    const regex = /<agent_call[^>]*>(.*?)<\/agent_call>/gs;
    const matches = content.matchAll(regex);

    for (const match of matches) {
      const callContent = match[1];

      const nameMatch = /<name>(.*?)<\/name>/.exec(callContent);
      const taskMatch = /<task>(.*?)<\/task>/s.exec(callContent);

      if (nameMatch && taskMatch) {
        calls.push({
          name: nameMatch[1].trim(),
          task: taskMatch[1].trim(),
        });
      }
    }

    return calls;
  }

  /**
   * Check if content contains agent calls
   */
  static hasAgentCalls(content: string): boolean {
    return content.includes('<agent_call>');
  }
}
