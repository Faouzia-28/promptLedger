/**
 * SWR hooks for data fetching with caching
 */

import useSWR, { SWRConfiguration } from 'swr';
import api from './api';

const fetcher = async (url: string) => {
  const res = await api.get(url);
  return res.data;
};

const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  dedupingInterval: 60000,
};

export function useBehaviorUnits() {
  return useSWR('/units', fetcher, swrConfig);
}

export function useGitHubIntegrations() {
  return useSWR('/github/integrations', fetcher, swrConfig);
}

export function useBehaviorUnit(unitId: string) {
  return useSWR(unitId ? `/units/${unitId}` : null, fetcher, swrConfig);
}

export function useBehaviorVersions(unitId: string) {
  return useSWR(unitId ? `/units/${unitId}/versions` : null, fetcher, swrConfig);
}

export function useDriftEvents(filters?: { severity?: string; unit_id?: string; resolved?: boolean }) {
  const queryParams = new URLSearchParams();

  if (filters?.severity) {
    queryParams.set('severity', filters.severity);
  }

  if (filters?.unit_id) {
    queryParams.set('unit_id', filters.unit_id);
  }

  if (typeof filters?.resolved === 'boolean') {
    queryParams.set('resolved', String(filters.resolved));
  }

  const query = queryParams.toString();
  return useSWR(`/drift/events?${query}`, fetcher, swrConfig);
}

export function useDriftEvent(eventId: string) {
  return useSWR(eventId ? `/drift/events/${eventId}` : null, fetcher, swrConfig);
}

export function useEvalRuns(unitId?: string) {
  return useSWR(unitId ? `/evals/units/${unitId}/runs` : null, fetcher, swrConfig);
}

export function useAuditLog(skip: number = 0, limit: number = 50) {
  return useSWR(`/compliance/audit-log?skip=${skip}&limit=${limit}`, fetcher, swrConfig);
}

export function useCurrentUser() {
  const { data, error, isLoading } = useSWR('/auth/me', fetcher, swrConfig);
  return {
    user: data,
    isLoading,
    error,
    isAuthenticated: !!data && !error,
  };
}
