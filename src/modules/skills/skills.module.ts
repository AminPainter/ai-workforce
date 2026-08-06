import { Module } from '@nestjs/common';
import { SkillsService } from './services/skills.service';
import { SkillLoaderService } from './services/skill-loader.service';

@Module({
  providers: [SkillsService, SkillLoaderService],
  exports: [SkillsService],
})
export class SkillsModule {}
