import { apiFetch } from './apiClient';
import { ApiError } from './errors';
import { getTodayDate } from '../../utils/dateUtils';
import type {
  CreateMindfulnessSessionBody,
  MindfulnessSessionResponse,
  MindfulnessDaySummaryResponse,
} from '@workspace/shared';

export const fetchMindfulnessDaySummary = (
  date: string,
  userId?: string
): Promise<MindfulnessDaySummaryResponse> => {
  const params = new URLSearchParams({ date });
  if (userId) params.set('userId', userId);

  return apiFetch<MindfulnessDaySummaryResponse>({
    endpoint: `/api/v2/mindfulness/day-summary?${params.toString()}`,
    serviceName: 'Mindfulness API',
    operation: 'fetch day summary',
  });
};

let lastMindfulnessSupport: boolean | null = null;

/**
 * Whether the active server keeps mindfulness sessions. Servers before the
 * mindfulness feature have no such route (404) and file an unknown health
 * type as a custom measurement, so synced sessions would land there as junk
 * categories. On any other failure the last answer is reused, and a first
 * failure assumes support (current servers), as the water probe does.
 */
export const serverSupportsMindfulnessSessions = async (): Promise<boolean> => {
  try {
    await fetchMindfulnessDaySummary(getTodayDate());
    lastMindfulnessSupport = true;
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      lastMindfulnessSupport = false;
    } else if (lastMindfulnessSupport === null) {
      return true;
    }
  }
  return lastMindfulnessSupport;
};

export const updateMindfulnessSession = (
  id: string,
  data: Partial<CreateMindfulnessSessionBody>
): Promise<MindfulnessSessionResponse> => {
  return apiFetch<MindfulnessSessionResponse>({
    endpoint: `/api/v2/mindfulness/entries/${id}`,
    method: 'PUT',
    body: data,
    serviceName: 'Mindfulness API',
    operation: 'update mindfulness session',
  });
};

export const createMindfulnessSession = (
  data: CreateMindfulnessSessionBody
): Promise<MindfulnessSessionResponse> => {
  return apiFetch<MindfulnessSessionResponse>({
    endpoint: '/api/v2/mindfulness/entries',
    method: 'POST',
    body: data,
    serviceName: 'Mindfulness API',
    operation: 'create mindfulness session',
  });
};

export const deleteMindfulnessSession = (
  id: string
): Promise<{ success: boolean }> => {
  return apiFetch<{ success: boolean }>({
    endpoint: `/api/v2/mindfulness/entries/${id}`,
    method: 'DELETE',
    serviceName: 'Mindfulness API',
    operation: 'delete mindfulness session',
  });
};
