import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const MatchQuerySchema = z.object({
  stage: z
    .enum(['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'])
    .optional(),
  status: z.enum(['scheduled', 'live', 'ht', 'ft', 'postponed']).optional(),
  group: z.string().length(1).toUpperCase().optional(),
  // YYYY-MM-DD — returns matches whose kickoff_utc falls on this UTC day
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional(),
  // convenience shorthand for today's UTC date
  today: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export class MatchQueryDto extends createZodDto(MatchQuerySchema) {}
