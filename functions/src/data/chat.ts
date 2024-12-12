import {ChatMessage} from "./chat-message";

export interface Chat {
  id: string,
  title: string,
  members: string[],
  createdAt: number,
  updatedAt: number,
  lastMessage?: ChatMessage,
}

export const isChat = (obj: any): obj is Chat => {
  return obj && Array.isArray(obj.members);
};
