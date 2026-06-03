import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const StandingsQuerySchema = z.object({
  group: z.string().length(1).toUpperCase().optional(),
});

export class StandingsQueryDto extends createZodDto(StandingsQuerySchema) {}
