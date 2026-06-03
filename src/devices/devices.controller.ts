import { Body, Controller, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DevicesService } from './devices.service.js';
import {
  RegisterDeviceDto,
  UpdateTokenDto,
} from './dto/register-device.dto.js';

@ApiTags('Devices')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Register or update a device (idempotent)' })
  register(@Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(dto);
  }

  @Patch(':deviceId')
  @ApiOperation({ summary: 'Update push token for an existing device' })
  updateToken(
    @Param('deviceId') deviceId: string,
    @Body() dto: UpdateTokenDto,
  ) {
    return this.devicesService.updateToken(deviceId, dto);
  }
}
