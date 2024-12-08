import {HttpError, HttpStatuses} from "../common/http-error";
import {FirebaseAuthService} from "../service/firebase-auth-service";
import FirebaseFirestoreService from "../service/firebase-firestore-service";
import {Controller} from "./controller";
import {Express, RequestHandler} from "express";
import {isUser} from "./friends-controller";

interface ChatMessage {
  id: string,
  chatId: string,
  sender: string,
  content: string,
  sentAt: number,
}

interface Chat {
  id: string,
  title: string,
  members: string[],
  createdAt: number,
  updatedAt: number,
  lastMessage?: ChatMessage,
}

const isChat = (obj: any): obj is Chat => {
  return obj && Array.isArray(obj.members);
};

function isString(obj: any): obj is string {
  return (obj && typeof obj === "string");
}

export class ChatsController extends Controller {
  constructor(
    private authService: FirebaseAuthService,
    private storeService: FirebaseFirestoreService,
  ) {
    super();
  }
  override init(app: Express) {
    app.get("/chats", this.getChats.bind(this));
    app.post("/chats", this.postChats.bind(this));
  }
  private getChats: RequestHandler = async (request, response) => {
    const {startAt} = request.query;
    this.handleRequest(async () => {
      const user = await this.authService.getUser(request.headers.authorization);
      const pagination = await this.storeService.getPagination(
        "chats",
        {fieldName: "members", opStr: "array-contains", value: user.uid},
        {fieldName: "updatedAt", directionStr: "desc"},
        isChat,
        isString(startAt) ? startAt : undefined,
      );
      response.status(HttpStatuses.ok.code).json({
        nextKey: pagination?.nextKey,
        results: pagination?.results,
      });
    }, response);
  };

  private postChats: RequestHandler = async (request, response) => {
    const {email, title} = request.body;
    if (!email) {
      throw new HttpError(HttpStatuses.badRequest, "채팅을 시작할 유저의 이메일을 전달해주세요.");
    } else if (!title) {
      throw new HttpError(HttpStatuses.badRequest, "채팅방의 이름을 전달해주세요.");
    }
    this.handleRequest(async () => {
      const user = await this.authService.getUser(request.headers.authorization);
      const otherUser = await this.authService.getUserByEmail(email);
      if (!isUser(user) || !user.friendIds.includes(otherUser.uid)) {
        throw new HttpError(HttpStatuses.forbidden, `${email}유저와의 친구가 아닙니다.`);
      }
      const willCreateChatDocumentRef = await this.storeService.create("chats");
      const now = Date.now();
      const chat: Chat = {
        id: willCreateChatDocumentRef.id,
        title: title,
        members: [user.uid, otherUser.uid],
        createdAt: now,
        updatedAt: now,
      };
      await this.storeService.update("chats", chat.id, chat);
      response.status(HttpStatuses.ok.code).json({result: chat});
    }, response);
  };
}
