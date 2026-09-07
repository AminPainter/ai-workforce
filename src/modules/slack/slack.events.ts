export const SLACK_BAKAR_MESSAGE_EVENT = 'slack.bakar.message';
export const SLACK_BAKAR_MENTION_EVENT = 'slack.bakar.mention';

export interface SlackBakarEvent {
  thread: import('chat').Thread;
  message: import('chat').Message;
}
