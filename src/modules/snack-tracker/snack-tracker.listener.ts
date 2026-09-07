import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SnackTrackerService } from './services/snack-tracker.service';
import {
  SLACK_BAKAR_MESSAGE_EVENT,
  type SlackBakarEvent,
} from '../slack/slack.events';

@Injectable()
export class SnackTrackerListener {
  private readonly logger = new Logger(SnackTrackerListener.name);

  constructor(private readonly snackTrackerService: SnackTrackerService) {}

  @OnEvent(SLACK_BAKAR_MESSAGE_EVENT)
  async onBakarMessage({ thread, message }: SlackBakarEvent): Promise<void> {
    try {
      await this.snackTrackerService.handlePotentialSnacksPledge(
        thread,
        message,
      );
    } catch (error) {
      this.logger.error(`bakar message handling failed: ${error}`);
    }
  }
}
