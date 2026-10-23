import { mergeProjects } from './projectService';

describe('project synchronization merge', () => {
  test('does not duplicate a local pending project already returned by the server', () => {
    const server = [{ _id: 'p1', name: 'server copy' }];
    const local = [{ _id: 'p1', name: 'local copy', _syncStatus: 'pending' }];

    expect(mergeProjects(server, local)).toEqual([
      { _id: 'p1', name: 'local copy', _syncStatus: 'pending' },
    ]);
  });

  test('keeps pending and conflict projects while ignoring completed local copies', () => {
    const result = mergeProjects(
      [{ _id: 'p1' }],
      [
        { _id: 'p1', _syncStatus: 'pending' },
        { _id: 'p2', _syncStatus: 'conflict' },
        { _id: 'p3', _syncStatus: 'synced' },
      ],
    );

    expect(result.map((p) => p._id)).toEqual(['p1', 'p2']);
  });

  test('handles malformed API collections without crashing', () => {
    expect(mergeProjects(null, undefined)).toEqual([]);
  });
});
