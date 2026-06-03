import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const NewsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const FanZoneQuerySchema = z.object({
  city: z.string().uuid().optional(),
});

export const VisaQuerySchema = z.object({
  nationality: z.string().optional(),
  host: z.string().optional(),
});

export class NewsQueryDto extends createZodDto(NewsQuerySchema) {}
export class FanZoneQueryDto extends createZodDto(FanZoneQuerySchema) {}
export class VisaQueryDto extends createZodDto(VisaQuerySchema) {}
