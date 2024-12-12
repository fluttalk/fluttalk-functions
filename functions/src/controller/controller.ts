import {Response, Request, Express} from "express";
import {HttpError, HttpStatuses} from "../common/http-error";
import {FirebaseAuthService} from "../service/firebase-auth-service";
import {UserRecord} from "firebase-admin/auth";

export abstract class Controller {
  constructor(
    protected authService: FirebaseAuthService,
  ) {}
  abstract init(app: Express): void;

  protected async handleRequest(
    request: Request,
    response: Response,
    handler: (user: UserRecord) => Promise<void>
  ) {
    try {
      const user = await this.authService.getUser(request.headers.authorization);
      await handler(user);
    } catch (error) {
      if (error instanceof HttpError) {
        response.status(error.code).json({...error});
      } else {
        response.sendStatus(HttpStatuses.unknown.code);
      }
    }
  }
}
