export interface PushToken {
  value: string;
}

export function isPushToken(obj: any): obj is PushToken {
  return (obj != null && typeof obj.value === "string");
}

type FcmException = {
  code: string;
}

export function isFcmException(obj: any): obj is FcmException {
  return (
    obj &&
    typeof obj.code === "string"
  );
}

export const SendMessageResult = {
  success: "success",
  failedByExpired: "expired",
  failedByUnknown: "unknown",
} as const;

export type SendMessageResultType = (typeof SendMessageResult)[keyof typeof SendMessageResult];
