export const SLACK_BAKAR_MESSAGE_EVENT = 'slack.bakar.message';

export interface SlackBakarEvent {
  thread: import('chat').Thread;
  message: import('chat').Message;
}
