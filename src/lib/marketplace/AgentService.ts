import type { AgentManifest } from '@/app/components/marketplace/AgentRegistry';

export class AgentService {
  private static instance: AgentService;
  private apiBase = '/api/marketplace';

  private constructor() {}

  public static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  async getAgents(
    filters: {
      category?: string;
      search?: string;
      featuredOnly?: boolean;
      minRating?: number;
    } = {}
  ): Promise<AgentManifest[]> {
    const params = new URLSearchParams();

    if (filters.category && filters.category !== 'all') {
      params.append('category', filters.category);
    }

    if (filters.search) {
      params.append('search', filters.search);
    }

    if (filters.featuredOnly) {
      params.append('featured', 'true');
    }

    if (filters.minRating) {
      params.append('minRating', filters.minRating.toString());
    }

    const response = await fetch(`${this.apiBase}/agents?${params.toString()}`);

    if (!response.ok) {
      throw new Error('Failed to fetch agents');
    }

    const data = await response.json();
    return data.agents || [];
  }

  async getAgentById(id: string): Promise<AgentManifest> {
    const response = await fetch(`${this.apiBase}/agents/${id}`);

    if (!response.ok) {
      throw new Error('Failed to fetch agent');
    }

    return response.json();
  }

  async installAgent(agentId: string): Promise<boolean> {
    const response = await fetch(`${this.apiBase}/agents/${agentId}/install`, {
      method: 'POST',
    });

    return response.ok;
  }

  async uninstallAgent(agentId: string): Promise<boolean> {
    const response = await fetch(`${this.apiBase}/agents/${agentId}/uninstall`, {
      method: 'POST',
    });

    return response.ok;
  }

  async executeAgent(
    agentId: string,
    input: any,
    apiKey: string
  ): Promise<{ success: boolean; result: any }> {
    const response = await fetch(`${this.apiBase}/agents/${agentId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ input })
    });

    if (!response.ok) {
      throw new Error('Failed to execute agent');
    }

    return response.json();
  }

  async getInstalledAgents(): Promise<string[]> {
    if (typeof window === 'undefined') return [];

    const installed = localStorage.getItem('installed-agents');
    return installed ? JSON.parse(installed) : [];
  }

  async saveInstalledAgents(agentIds: string[]): Promise<void> {
    if (typeof window === 'undefined') return;

    localStorage.setItem('installed-agents', JSON.stringify(agentIds));
  }
}

export const agentService = AgentService.getInstance();