export const SNACK_TRACKER_QUEUE = 'snack-tracker';

export interface SnacksPledgeJob {
  threadId: string;
  messageId: string;
  text: string;
  userId: string;
  userName: string;
  fullName: string;
}
