export interface ChatMessage {
  id: string,
  chatId: string,
  sender: string,
  content: string,
  sentAt: number
}

export function isMessage(obj: any): obj is ChatMessage {
  return (
    obj &&
    typeof obj.id === "string" &&
    typeof obj.chatId === "string" &&
    typeof obj.sender === "string" &&
    typeof obj.content === "string" &&
    typeof obj.sentAt === "number"
  );
}
