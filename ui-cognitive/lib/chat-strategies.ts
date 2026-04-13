/**
 * Truncate a message array to the last `maxCount` messages.
 * Ensures the most recent messages are always kept.
 */
export const truncateMessages = <T>(messages: T[], maxCount: number): T[] => {
  if (messages.length <= maxCount) {
    return messages;
  }

  return messages.slice(-maxCount);
};
