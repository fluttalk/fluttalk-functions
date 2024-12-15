export interface User {
  friendIds: string[];
}

export interface UserRecord {
  uid: string;
  email?: string;
  displayName?: string;
}

export const isUser = (obj: any): obj is User => {
  return obj && Array.isArray(obj.friendIds);
};
