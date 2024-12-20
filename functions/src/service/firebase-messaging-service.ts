import {Message} from "firebase-admin/lib/messaging/messaging-api";
import {isFcmException, SendMessageResult, SendMessageResultType} from "../data/push-token";
import {messaging} from "firebase-admin";

export default class FirebaseMessagingService {
  constructor(private messaging: messaging.Messaging) {}
  async send(pushToken: string, title: string, body: string): Promise<SendMessageResultType> {
    const pushMessage: Message = {
      token: pushToken,
      notification: {title: title, body: body},
    };
    try {
      await this.messaging.send(pushMessage);
      return SendMessageResult.success;
    } catch (e) {
      if (isFcmException(e) && (e.code === "messaging/unregistered" || e.code === "messaging/invalid-argument")) {
        return SendMessageResult.failedByExpired;
      } else {
        return SendMessageResult.failedByUnknown;
      }
    }
  }
}
