import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

export interface Environment {
  id: string;
  name: string;
  baseUrl: string | null;
  variables: Record<string, string>;
  isDefault: boolean;
}

export function useEnvironments(projectId: string | undefined) {
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      setEnvs(await api.listEnvironments(projectId));
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return { envs, loading, reload: load };
}
