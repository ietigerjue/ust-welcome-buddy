type MessageLike = {
  content?: unknown;
};

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

export function estimateMessagesTokens(
  messagesOrText: string | Array<string | MessageLike>
): number {
  if (typeof messagesOrText === "string") {
    return estimateTokens(messagesOrText);
  }

  return messagesOrText.reduce((total, message) => {
    if (typeof message === "string") {
      return total + estimateTokens(message);
    }

    if (typeof message.content === "string") {
      return total + estimateTokens(message.content);
    }

    if (Array.isArray(message.content)) {
      return (
        total +
        message.content.reduce((contentTotal, item) => {
          if (typeof item === "string") {
            return contentTotal + estimateTokens(item);
          }

          return contentTotal + estimateTokens(JSON.stringify(item));
        }, 0)
      );
    }

    return total + estimateTokens(String(message.content ?? ""));
  }, 0);
}

