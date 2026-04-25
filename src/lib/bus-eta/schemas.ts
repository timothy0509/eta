import { z } from 'zod'

import { BUS_COMPANIES } from './constants'

export const languageSchema = z.enum(['en', 'zh'])

export const routeSearchParamsSchema = z.object({
  keyword: z.string().trim().min(1),
  language: languageSchema.default('en'),
  limit: z.number().int().positive().max(100).default(40),
})

export const routeStopsParamsSchema = z.object({
  routeId: z.string().trim().min(1),
  company: z.enum(BUS_COMPANIES),
  language: languageSchema.default('en'),
})

export const stopEtaParamsSchema = z.object({
  routeId: z.string().trim().min(1),
  seq: z.number().int().nonnegative(),
  language: languageSchema.default('en'),
})
