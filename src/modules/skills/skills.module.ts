import { Module } from '@nestjs/common';
import { SkillsService } from './services/skills.service.js';
import { SkillLoaderService } from './services/skill-loader.service.js';

@Module({
  providers: [SkillsService, SkillLoaderService],
  exports: [SkillsService],
})
export class SkillsModule {}
