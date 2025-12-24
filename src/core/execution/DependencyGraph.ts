import { Graph } from 'graphlib';
import { ToolCall } from '../../types/provider';

export class DependencyGraph {
  private graph: Graph;

  constructor() {
    this.graph = new Graph({ directed: true });
  }

  addNode(id: string, toolCall: ToolCall) {
    this.graph.setNode(id, toolCall);
  }

  addDependency(fromId: string, toId: string) {
    this.graph.setEdge(fromId, toId);
  }

  getExecutionOrder(): string[] {
    return alg.topsort(this.graph);
  }
}

// graphlib types might be missing or different, using a simple topological sort if needed
// But graphlib has alg.topsort
import { alg } from 'graphlib';
