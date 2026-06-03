import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const TeamQuerySchema = z.object({
  group: z.string().length(1).toUpperCase().optional(),
  confederation: z.string().optional(),
});

export class TeamQueryDto extends createZodDto(TeamQuerySchema) {}
