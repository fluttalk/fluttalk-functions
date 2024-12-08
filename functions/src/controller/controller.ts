import {Response, Express} from "express";
import {HttpError, HttpStatuses} from "../common/http-error";

export abstract class Controller {
  abstract init(app: Express): void;

  protected async handleRequest(
    handler: () => Promise<void>,
    response: Response
  ) {
    try {
      await handler();
    } catch (error) {
      if (error instanceof HttpError) {
        response.status(error.code).json({...error});
      } else {
        response.sendStatus(HttpStatuses.unknown.code);
      }
    }
  }
}
