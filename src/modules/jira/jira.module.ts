import { Module } from '@nestjs/common';
import { JiraClientService } from './jira-client.service';

@Module({
  providers: [JiraClientService],
  exports: [JiraClientService],
})
export class JiraModule {}
