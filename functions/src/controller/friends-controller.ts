import {HttpError, HttpStatuses} from "../common/http-error";
import {FirebaseAuthService} from "../service/firebase-auth-service";
import FirebaseFirestoreService from "../service/firebase-firestore-service";
import {Controller} from "./controller";
import {Express, RequestHandler} from "express";

export interface User {
  friendIds: string[];
}

export const isUser = (obj: any): obj is User => {
  return obj && Array.isArray(obj.friendIds);
};

export class FriendsController extends Controller {
  constructor(
    private authService: FirebaseAuthService,
    private storeService: FirebaseFirestoreService,
  ) {
    super();
  }

  override init(app: Express) {
    app.get("/friends", this.getFriends.bind(this));
    app.post("/friends/add", this.addFriendByEmail.bind(this));
    app.post("/friends/remove", this.removeFriendByEmail.bind(this));
  }

  private getFriends: RequestHandler = async (request, response) => {
    this.handleRequest(async () => {
      const decodedIdToken = await this.authService.verifyIdToken(request.headers.authorization);
      const user = await this.storeService.get<User>("users", decodedIdToken.uid, isUser);
      if ( user != null && user.friendIds.length > 0 ) {
        const friendUsers = await Promise.all(user.friendIds.map((friendId) => this.authService.getUserByUid(friendId)));
        response.status(HttpStatuses.ok.code).json({results: friendUsers});
      } else {
        response.status(HttpStatuses.ok.code).json({results: []});
      }
    }, response);
  };

  private addFriendByEmail: RequestHandler = async (request, response) => {
    const {email} = request.body;
    if (!email) {
      throw new HttpError(HttpStatuses.badRequest, "추가할 친구의 이메일을 전달해주세요.");
    }
    this.handleRequest(async () => {
      const foundUser = await this.authService.getUserByEmail(email);
      const decodedIdToken = await this.authService.verifyIdToken(request.headers.authorization);
      const user = await this.storeService.get<User>("users", decodedIdToken.uid, isUser);
      if (!user ) {
        throw new HttpError(HttpStatuses.notFound, `${decodedIdToken.uid} 유저 정보를 찾을 수 없습니다.`);
      } else if (user.friendIds.includes(foundUser.uid)) {
        throw new HttpError(HttpStatuses.conflict, "이미 친구로 등록된 유저입니다.");
      } else {
        const willUpdateFriendIds = {
          friendIds: user.friendIds?.length > 0 ? [...user.friendIds, foundUser.uid] : [foundUser.uid],
        };
        await this.storeService.update<User>("users", decodedIdToken.uid, willUpdateFriendIds);
        response.status(HttpStatuses.ok.code).json({result: foundUser});
      }
    }, response);
  };

  private removeFriendByEmail: RequestHandler = async (request, response) => {
    const {email} = request.body;
    if (!email) {
      throw new HttpError(HttpStatuses.badRequest, "삭제할 친구의 이메일을 전달해주세요.");
    }
    this.handleRequest(async () => {
      const foundUser = await this.authService.getUserByEmail(email);
      const decodedIdToken = await this.authService.verifyIdToken(request.headers.authorization);
      const user = await this.storeService.get<User>("users", decodedIdToken.uid, isUser);
      if (!user ) {
        throw new HttpError(HttpStatuses.notFound, `${decodedIdToken.uid} 유저 정보를 찾을 수 없습니다.`);
      } else if (!user.friendIds.includes(foundUser.uid)) {
        throw new HttpError(HttpStatuses.notFound, "친구로 등록되지 않은 유저입니다.");
      } else {
        const willUpdateFriendIds = {
          friendIds: user.friendIds.filter((friendId) => friendId != foundUser.uid),
        };
        await this.storeService.update<User>("users", decodedIdToken.uid, willUpdateFriendIds);
        response.status(HttpStatuses.ok.code).json({result: foundUser});
      }
    }, response);
  };
}
