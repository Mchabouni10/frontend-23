import sendRequest from '../utilities/send-request';
import {
  saveProject,
  updateProject,
  getProjects,
  isConnectionError,
  createClientRequestId,
} from './projectService';

jest.mock('../utilities/send-request');

const validProject = {
  workflowStatus: 'active',
  categories: [
    {
      name: 'Tile',
      key: 'tile',
      workItems: [
        {
          type: 'floor-tile',
          surfaces: [{ measurementType: 'sqft', sqft: 120 }],
        },
      ],
    },
  ],
};

const setOnline = (value) =>
  jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(value);

describe('saveProject (online only, idempotent create)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setOnline(true);
  });

  test('keeps the idempotency key the caller supplies', async () => {
    sendRequest.mockResolvedValue({ _id: 'p1' });
    await saveProject({ ...validProject, clientRequestId: 'key-1' });
    expect(sendRequest.mock.calls[0][2].clientRequestId).toBe('key-1');
  });

  test('generates a key when none is supplied', async () => {
    sendRequest.mockResolvedValue({ _id: 'p1' });
    await saveProject(validProject);
    expect(sendRequest.mock.calls[0][2].clientRequestId).toEqual(expect.any(String));
  });

  test('a timeout is reported as a connection problem and nothing is queued', async () => {
    sendRequest.mockRejectedValue(Object.assign(new Error('Request timed out'), { status: 408 }));
    await expect(saveProject(validProject)).rejects.toMatchObject({ isConnectionError: true });
    expect(sendRequest).toHaveBeenCalledTimes(1);
  });

  test('retrying after a timeout re-sends the SAME key', async () => {
    sendRequest
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ _id: 'p1' });
    const payload = { ...validProject, clientRequestId: 'key-2' };
    await expect(saveProject(payload)).rejects.toMatchObject({ isConnectionError: true });
    await saveProject(payload);
    const keys = sendRequest.mock.calls.map((c) => c[2].clientRequestId);
    expect(keys).toEqual(['key-2', 'key-2']);
  });

  test('does not call the server while the browser is offline', async () => {
    setOnline(false);
    await expect(saveProject(validProject)).rejects.toMatchObject({ isConnectionError: true });
    expect(sendRequest).not.toHaveBeenCalled();
  });

  test('server validation errors are passed through, not treated as connection errors', async () => {
    const serverError = Object.assign(new Error('Validation failed.'), { status: 400 });
    sendRequest.mockRejectedValue(serverError);
    await expect(saveProject(validProject)).rejects.toBe(serverError);
  });

  test('rejects an incomplete non-draft project before sending', async () => {
    const bad = {
      workflowStatus: 'active',
      categories: [
        { name: 'Tile', key: 'tile', workItems: [{ type: 'x', surfaces: [{ measurementType: 'sqft', sqft: 0 }] }] },
      ],
    };
    await expect(saveProject(bad)).rejects.toMatchObject({ error: 'Validation failed' });
    expect(sendRequest).not.toHaveBeenCalled();
  });

  test('allows an incomplete draft', async () => {
    sendRequest.mockResolvedValue({ _id: 'p1' });
    await saveProject({ workflowStatus: 'draft', categories: [] });
    expect(sendRequest).toHaveBeenCalledTimes(1);
  });
});

describe('updateProject / getProjects', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setOnline(true);
  });

  test('update failure on a dropped connection asks the user to wait', async () => {
    sendRequest.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(updateProject('p1', validProject)).rejects.toThrow(/wait for the connection/i);
  });

  test('getProjects returns the server list only (no local copies)', async () => {
    sendRequest.mockResolvedValue([{ _id: 'p1' }]);
    await expect(getProjects()).resolves.toEqual([{ _id: 'p1' }]);
  });

  test('getProjects shares one request between simultaneous callers', async () => {
    sendRequest.mockResolvedValue([]);
    await Promise.all([getProjects(), getProjects(), getProjects()]);
    expect(sendRequest).toHaveBeenCalledTimes(1);
  });
});

describe('helpers', () => {
  test('isConnectionError ignores real server answers', () => {
    expect(isConnectionError(Object.assign(new Error('x'), { status: 500 }))).toBe(false);
    expect(isConnectionError(new TypeError('Failed to fetch'))).toBe(true);
  });

  test('createClientRequestId returns unique values', () => {
    expect(createClientRequestId()).not.toBe(createClientRequestId());
  });
});
