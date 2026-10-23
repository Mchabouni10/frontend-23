import { clearDraftLocally, getDraftLocally, saveDraftLocally } from './draftStorage';

describe('draftStorage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a project draft', () => {
    const draft = { customer: { firstName: 'A' }, categories: [], projectId: null };
    saveDraftLocally(draft);
    expect(getDraftLocally()).toMatchObject(draft);
  });

  it('clears a recovered draft', () => {
    saveDraftLocally({ customer: { firstName: 'A' } });
    clearDraftLocally();
    expect(getDraftLocally()).toBeNull();
  });
});
