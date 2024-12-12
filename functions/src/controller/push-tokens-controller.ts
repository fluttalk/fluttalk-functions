import {Express, RequestHandler} from "express";
import {FirebaseAuthService} from "../service/firebase-auth-service";
import {Controller} from "./controller";
import FirebaseFirestoreService from "../service/firebase-firestore-service";
import {HttpError, HttpStatuses} from "../common/http-error";
import {PushToken} from "../data/push-token";

export class PushTokensController extends Controller {
  constructor(authService: FirebaseAuthService, private storeService: FirebaseFirestoreService) {
    super(authService);
  }

  init(app: Express): void {
    app.post("/pushTokens", this.postPushTokens.bind(this));
  }

  private postPushTokens: RequestHandler = async (request, response) => {
    const {pushToken} = request.body;
    if (!pushToken) {
      throw new HttpError(HttpStatuses.badRequest, "푸시 메시지 수신에 사용될 pushToken을 전달해주세요");
    }
    this.handleRequest(request, response, async (user) => {
      await this.storeService.update<PushToken>("pushTokens", user.uid, {value: pushToken});
      response.sendStatus(HttpStatuses.ok.code);
    });
  };
}
