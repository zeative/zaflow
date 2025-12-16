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

    let instructions = `You are the main orchestrator coordinating specialized agents.

${agentXML}

To delegate a task to an agent, use this format:
<agent_call>
<name>agent_name</name>
<task>Task description for the agent</task>
</agent_call>

You can make multiple agent calls. Each agent will execute their assigned task and return results.
After receiving all agent results, synthesize them into a final comprehensive answer.
`;

    if (tools && tools.length > 0) {
      instructions += `\nYou also have direct access to these tools for tasks you handle yourself:\n`;
      for (const tool of tools) {
        instructions += `- ${tool.name}: ${tool.description}\n`;
      }
      instructions += `\nUse <tool_call> format for direct tool usage.`;
    }

    instructions += `\n\n🚨 CRITICAL: Analyze the user's request and delegate to the most appropriate agent(s). Use the agents' specialized capabilities effectively. Output the <agent_call> XML format when delegating.`;

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
