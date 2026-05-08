// Единая форма данных университета.
// Сейчас — JS-описание + пример, чтобы дашборд показывал схему.
// Потом перенесём в TS + Zod (см. раздел 5 в inbox/Site.md).

window.STUDYROOM_UNIVERSITY_SCHEMA = {
  fields: [
    { key: 'slug',           type: 'string',                example: 'oxford', note: 'URL-friendly идентификатор, уникален' },
    { key: 'name',           type: 'string',                example: 'University of Oxford' },
    { key: 'country',        type: 'string',                example: 'United Kingdom' },
    { key: 'city',           type: 'string',                example: 'Oxford' },
    { key: 'programs',       type: 'Program[]',             note: 'Список программ' },
    { key: 'tuition',        type: '{ currency, byProgram }', note: 'Стоимость по программам' },
    { key: 'deadlines',      type: '{ [programSlug]: ISODate }' },
    { key: 'requirements',   type: '{ language, gpa, exams[] }' },
    { key: 'scholarships',   type: 'Scholarship[]' },
    { key: 'lastChecked',    type: 'ISODate',               note: 'Когда последний раз скрейпили' },
    { key: 'sourceUrl',      type: 'url',                   note: 'Откуда брали данные' },
    { key: 'sourceHash',     type: 'string',                note: 'Хэш исходной страницы — чтобы ловить diff' },
  ],

  example: {
    slug: 'oxford',
    name: 'University of Oxford',
    country: 'United Kingdom',
    city: 'Oxford',
    programs: [
      { slug: 'cs-bsc', title: 'Computer Science, BSc', durationYears: 3, level: 'bachelor' },
    ],
    tuition: {
      currency: 'GBP',
      byProgram: { 'cs-bsc': 38000 },
    },
    deadlines: {
      'cs-bsc': '2026-10-15',
    },
    requirements: {
      language: { ielts: 7.5, toefl: 110 },
      gpa: 3.7,
      exams: ['MAT'],
    },
    scholarships: [
      { name: 'Reach Oxford', amountUSD: 35000, deadline: '2026-03-01' },
    ],
    lastChecked: '2026-05-01T08:00:00Z',
    sourceUrl: 'https://www.ox.ac.uk/admissions',
    sourceHash: 'sha256:placeholder',
  },

  // Когда заведём TS-проект, заменим на zod.object({...}).
  // Файл на универ — data/universities/{slug}.json (см. раздел 5 в Site.md).
};
