export const SLACK_BAKAR_MESSAGE_EVENT = 'slack.bakar.message';
export const SLACK_LEAVES_MESSAGE_EVENT = 'slack.leaves.message';

export interface SlackChannelMessageEvent {
  thread: import('chat').Thread;
  message: import('chat').Message;
}

export type SlackBakarEvent = SlackChannelMessageEvent;
export type SlackLeavesEvent = SlackChannelMessageEvent;
