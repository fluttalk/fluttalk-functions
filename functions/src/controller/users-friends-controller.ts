import {HttpError, HttpStatuses} from "../common/http-error";
import {isUser, User} from "../data/user";
import {FirebaseAuthService} from "../service/firebase-auth-service";
import FirebaseFirestoreService from "../service/firebase-firestore-service";
import {Controller} from "./controller";
import {Express, RequestHandler} from "express";

export class UsersFriendsController extends Controller {
  constructor(authService: FirebaseAuthService, private storeService: FirebaseFirestoreService) {
    super(authService);
  }

  override init(app: Express) {
    // POST, DELETE 메소드로 /friends api로 전달하기 이전의 api
    app.post("/friends/add", this.addFriendByEmail.bind(this));
    app.post("/friends/remove", this.removeFriendByEmail.bind(this));

    // GET, POST, DELETE 메소드를 사용하도록 api 엔드포인트 추가
    app.get("/friends", this.getFriends.bind(this));
    app.post("/friends", this.addFriendByEmail.bind(this));
    app.delete("/friends", this.removeFriendByEmail.bind(this));

    // users 리소스의 하위로 friends api 엔드포인트 추가
    app.get("/users/friends", this.getFriends.bind(this));
    app.post("/users/friends", this.addFriendByEmail.bind(this));
    app.delete("/users/friends", this.removeFriendByEmail.bind(this));
  }

  protected getFriends: RequestHandler = async (request, response) => {
    this.handleRequest(request, response, async (userRecord) => {
      const user = await this.storeService.get<User>("users", userRecord.uid, isUser);
      if ( user != null && user.friendIds.length > 0 ) {
        const friendUsers = await Promise.all(user.friendIds.map((friendId) => this.authService.getUserByUid(friendId)));
        response.status(HttpStatuses.ok.code).json({results: friendUsers});
      } else {
        response.status(HttpStatuses.ok.code).json({results: []});
      }
    });
  };

  protected addFriendByEmail: RequestHandler = async (request, response) => {
    const {email} = request.body;
    if (!email) {
      throw new HttpError(HttpStatuses.badRequest, "추가할 친구의 이메일을 전달해주세요.");
    }
    this.handleRequest(request, response, async () => {
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
    });
  };

  protected removeFriendByEmail: RequestHandler = async (request, response) => {
    const {email} = request.body;
    if (!email) {
      throw new HttpError(HttpStatuses.badRequest, "삭제할 친구의 이메일을 전달해주세요.");
    }
    this.handleRequest(request, response, async () => {
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
    });
  };
}
