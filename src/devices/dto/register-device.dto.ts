import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RegisterDeviceSchema = z.object({
  deviceId: z.string().min(1).max(64),
  platform: z.enum(['ios', 'android']),
  pushToken: z.string().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  country: z.string().length(2).optional(),
});

export const UpdateTokenSchema = z.object({
  pushToken: z.string().optional(),
});

export class RegisterDeviceDto extends createZodDto(RegisterDeviceSchema) {}
export class UpdateTokenDto extends createZodDto(UpdateTokenSchema) {}
