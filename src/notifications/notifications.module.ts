import { Module } from '@nestjs/common';
import { PushService } from './push.service.js';
import { DevicesModule } from '../devices/devices.module.js';

@Module({
  imports: [DevicesModule],
  providers: [PushService],
})
export class NotificationsModule {}
