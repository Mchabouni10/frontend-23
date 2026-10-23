import { PROJECT_TEMPLATES, cloneTemplate } from './projectTemplates';

test('templates produce independent category data', () => {
  const first = cloneTemplate(PROJECT_TEMPLATES[0]);
  const second = cloneTemplate(PROJECT_TEMPLATES[0]);
  first[0].name = 'Changed';
  expect(second[0].name).not.toBe('Changed');
  expect(first[0].workItems.length).toBeGreaterThan(0);
});
