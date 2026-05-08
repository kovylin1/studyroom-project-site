import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { universitySchema } from '../schema/university';

const universities = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/universities' }),
  schema: universitySchema,
});

export const collections = { universities };
