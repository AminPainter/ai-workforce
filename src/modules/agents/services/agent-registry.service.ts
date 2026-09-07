import { Agent } from 'ai';

// The SDK `Agent` is generic over its tool set and its structured `output`; both are
// invariant in the positions we touch, so a tool-typed or output-typed agent is not
// assignable to the default empty-tools / no-output `Agent`. Widen the generics so any
// agent — plain `ToolLoopAgent`, one with `Output.object(...)`, future `HarnessAgent` —
// fits the map.
type AnyRegisteredAgent = Agent<never, any, any, any>;

type WithToolsContext<OPTIONS> = Omit<OPTIONS, 'toolsContext'> & {
  toolsContext?: Record<string, Record<string, unknown>>;
};

export type RegisteredAgent = Omit<
  AnyRegisteredAgent,
  'stream' | 'generate'
> & {
  stream(
    options: WithToolsContext<Parameters<AnyRegisteredAgent['stream']>[0]>,
  ): ReturnType<AnyRegisteredAgent['stream']>;
  generate(
    options: WithToolsContext<Parameters<AnyRegisteredAgent['generate']>[0]>,
  ): ReturnType<AnyRegisteredAgent['generate']>;
};

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
