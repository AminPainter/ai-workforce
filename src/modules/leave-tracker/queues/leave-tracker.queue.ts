export const LEAVE_TRACKER_QUEUE = 'leave-tracker';

export interface LeaveMessageJob {
  threadId: string;
  messageId: string;
  text: string;
  userId: string;
  postedAt: string;
}
