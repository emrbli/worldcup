import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BracketService } from './bracket.service.js';

@ApiTags('Bracket')
@Controller('bracket')
export class BracketController {
  constructor(private readonly bracketService: BracketService) {}

  @Get()
  @ApiOperation({
    summary:
      'Knockout bracket by round. Teams are null (placeholders shown) until the group stage completes.',
  })
  getBracket() {
    return this.bracketService.getBracket();
  }
}
