import {Express, RequestHandler} from "express";
import {HttpError, HttpStatuses} from "../common/http-error";
import {FirebaseAuthService} from "../service/firebase-auth-service";
import {Controller} from "./controller";

export class UsersMeController extends Controller {
  constructor(private authService: FirebaseAuthService) {
    super();
  }
  override init(app: Express) {
    app.get("/users/me", this.getMe.bind(this));
    app.post("/users/me", this.postMe.bind(this));
  }
  private getMe: RequestHandler = async (request, response) => {
    this.handleRequest(async () => {
      const userRecord = await this.authService.getUser(request.headers.authorization);
      response.status(HttpStatuses.ok.code).json({result: userRecord});
    }, response);
  };
  private postMe: RequestHandler = async (request, response) => {
    const {name} = request.body;
    if (!name) {
      throw new HttpError(HttpStatuses.badRequest, "변경할 이름을 전달해주세요.");
    }
    this.handleRequest(async () => {
      const userRecord = await this.authService.updateUser(request.headers.authorization, name);
      response.status(HttpStatuses.ok.code).json({result: userRecord});
    }, response);
  };
}
