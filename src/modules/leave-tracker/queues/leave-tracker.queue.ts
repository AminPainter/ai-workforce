export const LEAVE_TRACKER_QUEUE = 'leave-tracker';

export interface LeaveMessageJob {
  threadId: string;
  messageId: string;
  text: string;
  rawText: string;
  userId: string;
  userName: string;
  postedAt: string;
}
