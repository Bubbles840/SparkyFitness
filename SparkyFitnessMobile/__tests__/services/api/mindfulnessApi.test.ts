import { serverSupportsMindfulnessSessions } from '../../../src/services/api/mindfulnessApi';
import { apiFetch } from '../../../src/services/api/apiClient';
import { ApiError } from '../../../src/services/api/errors';

jest.mock('../../../src/services/api/apiClient', () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

// The probe keeps its last answer in module state, so these tests run in
// order: the never-answered case first.
describe('serverSupportsMindfulnessSessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('assumes support when the very first probe fails for another reason', async () => {
    mockApiFetch.mockRejectedValue(new Error('offline'));

    await expect(serverSupportsMindfulnessSessions()).resolves.toBe(true);
  });

  test('reports no support when the server has no mindfulness routes', async () => {
    mockApiFetch.mockRejectedValue(
      new ApiError('Server error: 404', 404, 'Not Found')
    );

    await expect(serverSupportsMindfulnessSessions()).resolves.toBe(false);
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: expect.stringMatching(
          /^\/api\/v2\/mindfulness\/day-summary\?date=\d{4}-\d{2}-\d{2}$/
        ),
      })
    );
  });

  test('reuses the last answer when a later probe fails for another reason', async () => {
    mockApiFetch.mockRejectedValue(new Error('offline'));

    await expect(serverSupportsMindfulnessSessions()).resolves.toBe(false);
  });

  test('reports support when the day summary answers', async () => {
    mockApiFetch.mockResolvedValue({ date: '2026-10-21', sessions: [] });

    await expect(serverSupportsMindfulnessSessions()).resolves.toBe(true);
  });
});
