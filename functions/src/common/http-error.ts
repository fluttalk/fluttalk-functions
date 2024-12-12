export const HttpStatuses = {
  ok: {code: 200, name: "OK"},
  badRequest: {code: 400, name: "BadRequest"},
  unauthorized: {code: 401, name: "Unauthorized"},
  forbidden: {code: 403, name: "Forbidden"},
  notFound: {code: 404, name: "NotFound"},
  conflict: {code: 409, name: "Conflict"},
  unknown: {code: 500, name: "Unknown"},
} as const;

type HttpStatus = (typeof HttpStatuses)[keyof typeof HttpStatuses];

export class HttpError implements Error {
  code: number;
  name: string;
  message: string;
  stack?: string | undefined;
  constructor(status: HttpStatus, message: string) {
    this.code = status.code;
    this.name = status.name;
    this.message = message;
  }
}
