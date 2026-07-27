import { Agent } from 'ai';

// The SDK `Agent` is generic over its tool set and its structured `output`; both are
// invariant in the positions we touch, so a tool-typed or output-typed agent is not
// assignable to the default empty-tools / no-output `Agent`. Widen the generics so any
// agent — plain `ToolLoopAgent`, one with `Output.object(...)`, future `HarnessAgent` —
// fits the map.
export type RegisteredAgent = Agent<never, any, any, any>;

export class AgentRegistry {
  constructor(
    private readonly agents: Map<string, RegisteredAgent> = new Map(),
  ) {}

  register(key: string, agent: RegisteredAgent): void {
    this.agents.set(key, agent);
  }

  get(key: string): RegisteredAgent {
    const agent = this.agents.get(key);
    if (!agent) throw new Error(`No agent registered for key "${key}"`);
    return agent;
  }

  keys(): string[] {
    return [...this.agents.keys()];
  }
}
