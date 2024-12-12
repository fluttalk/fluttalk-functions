export interface User {
  friendIds: string[];
}

export const isUser = (obj: any): obj is User => {
  return obj && Array.isArray(obj.friendIds);
};
