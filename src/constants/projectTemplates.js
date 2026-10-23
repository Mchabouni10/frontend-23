export const PROJECT_TEMPLATES = [
  {
    id: 'bathroom-refresh',
    name: 'Bathroom Refresh',
    categories: [{
      key: 'bathroom', name: 'Bathroom', workItems: [
        { name: 'Flooring', type: 'custom-work-type', customWorkTypeName: 'Flooring', measurementType: 'square-foot', surfaces: [], materialCost: 0, laborCost: 0 },
        { name: 'Paint', type: 'custom-work-type', customWorkTypeName: 'Paint', measurementType: 'square-foot', surfaces: [], materialCost: 0, laborCost: 0 },
      ],
    }],
  },
  {
    id: 'kitchen-update',
    name: 'Kitchen Update',
    categories: [{
      key: 'kitchen', name: 'Kitchen', workItems: [
        { name: 'Cabinetry', type: 'custom-work-type', customWorkTypeName: 'Cabinetry', measurementType: 'by-unit', surfaces: [], materialCost: 0, laborCost: 0 },
        { name: 'Countertops', type: 'custom-work-type', customWorkTypeName: 'Countertops', measurementType: 'square-foot', surfaces: [], materialCost: 0, laborCost: 0 },
      ],
    }],
  },
];

export function cloneTemplate(template) {
  return JSON.parse(JSON.stringify(template.categories));
}
