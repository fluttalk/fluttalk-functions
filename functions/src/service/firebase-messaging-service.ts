import {Message} from "firebase-admin/lib/messaging/messaging-api";
import admin from "firebase-admin";
import {isFcmException, SendMessageResult, SendMessageResultType} from "../data/push-token";

export default class FirebaseMessagingService {
  async send(pushToken: string, title: string, body: string): Promise<SendMessageResultType> {
    const pushMessage: Message = {
      token: pushToken,
      notification: {title: title, body: body},
    };
    try {
      await admin.messaging().send(pushMessage);
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
