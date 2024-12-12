import {Controller} from "./controller";
import {FirebaseAuthService} from "../service/firebase-auth-service";
import {Express, RequestHandler} from "express";
import {HttpError, HttpStatuses} from "../common/http-error";
import FirebaseFirestoreService from "../service/firebase-firestore-service";
import {Chat, isChat} from "../data/chat";
import {ChatMessage, isMessage} from "../data/chat-message";
import {isPushToken, SendMessageResult} from "../data/push-token";
import FirebaseMessagingService from "../service/firebase-messaging-service";

export class MessagesController extends Controller {
  constructor(
    authService: FirebaseAuthService,
    private storeService: FirebaseFirestoreService,
    private messagingService: FirebaseMessagingService,
  ) {
    super(authService);
  }

  init(app: Express): void {
    app.post("/messages", this.postMessage.bind(this));
    app.get("/messages", this.getMessages.bind(this));
    app.get("/messages/latest", this.getLatestMessages.bind(this));
  }

  private getMessages: RequestHandler = async (request, response) => {
    const {chatId, startAt} = request.query;
    if (!chatId) {
      throw new HttpError(HttpStatuses.badRequest, "채팅방의 아이디를 전달해주세요.");
    }
    this.handleRequest(request, response, async (user) => {
      const chat = await this.storeService.get<Chat>("chats", `${chatId}`, isChat);
      if (!chat) {
        throw new HttpError(HttpStatuses.notFound, "채팅방을 찾을 수 없습니다.");
      } else if (!chat.members.includes(user.uid)) {
        throw new HttpError(HttpStatuses.forbidden, `${chatId} 채팅방의 유저가 아니기 때문에 메시지를 조회할 수 없습니다.`);
      }
      const page = await this.storeService.getPage(
        "messages",
        {fieldName: "chatId", opStr: "==", value: chatId},
        {fieldName: "sentAt", directionStr: "desc"},
        isMessage,
        startAt ? `${startAt}` : undefined,
      );
      response.status(HttpStatuses.ok.code).json(page ?? {nextKey: null, results: []});
    });
  };

  private getLatestMessages: RequestHandler = async (request, response) => {
    const {chatId, lastNewestSentAt} = request.query;
    if (!chatId) {
      throw new HttpError(HttpStatuses.badRequest, "메시지를 조회할 채팅방의 아이디를 전달해주세요.");
    } else if (!lastNewestSentAt) {
      throw new HttpError(HttpStatuses.badRequest, "신규 메시지 조회에 사용할 마지막 최신 메시지의 시간을 전달하세요.");
    }
    this.handleRequest(request, response, async (user) => {
      const chat = await this.storeService.get<Chat>("chats", `${chatId}`, isChat);
      if (!chat) {
        throw new HttpError(HttpStatuses.notFound, "채팅방을 찾을 수 없습니다.");
      } else if (!chat.members.includes(user.uid)) {
        throw new HttpError(HttpStatuses.forbidden, `${chatId} 채팅방의 유저가 아니기 때문에 메시지를 조회할 수 없습니다.`);
      }
      const datas = await this.storeService.getLatestAtBefore(
        "messages",
        {fieldName: "chatId", opStr: "==", value: chatId},
        {fieldName: "sentAt", directionStr: "desc"},
        isMessage,
        parseInt(`${lastNewestSentAt}`),
      );
      response.status(HttpStatuses.ok.code).json({results: datas});
    });
  };

  private postMessage: RequestHandler = async (request, response) => {
    const {chatId, content} = request.body;
    if (!chatId) {
      throw new HttpError(HttpStatuses.badRequest, "메시지 전송을 위해 채팅 chatId를 전달해주세요.");
    } else if (!content) {
      throw new HttpError(HttpStatuses.badRequest, "전송할 메시지의 본문을 전달해주세요");
    }
    this.handleRequest(request, response, async (userRecord) => {
      const chat = await this.storeService.get("chats", chatId, isChat);
      if (!chat) {
        throw new HttpError(HttpStatuses.notFound, "채팅방을 찾을 수 없습니다.");
      } else if (!chat.members.includes(userRecord.uid)) {
        throw new HttpError(HttpStatuses.forbidden, `${chatId}에 접근할 수 없습니다.`);
      }
      const newMessageDocRef = await this.storeService.create("messages");
      const chatMessage: ChatMessage = {
        id: newMessageDocRef.id,
        chatId: chatId,
        sender: userRecord.uid,
        content: content,
        sentAt: Date.now(),
      };
      await this.storeService.update("messages", newMessageDocRef.id, chatMessage);
      await this.storeService.update("chats", chat.id, {
        lastMessage: chatMessage,
      });
      this.sendPushMessages(chat, chatMessage);
      response.status(HttpStatuses.ok.code).json({result: chatMessage});
    });
  };

  private sendPushMessages = (chat: Chat, chatMessage: ChatMessage) => {
    const receiversUids = chat.members.filter((member) => member !== chatMessage.sender);
    const getPushTokenPromises = receiversUids.map((uid) => this.storeService.get("pushTokens", uid, isPushToken));
    getPushTokenPromises.forEach(async (getPushTokenPromise, index) => {
      const pushToken = await getPushTokenPromise;
      if (pushToken && pushToken.value) {
        const result = await this.messagingService.send(pushToken.value, "Fluttalk", chatMessage.content);
        if (result === SendMessageResult.failedByExpired ) {
          const receiversUid = receiversUids[index];
          this.storeService.delete("pushTokens", receiversUid);
        }
      }
    });
  };
}
