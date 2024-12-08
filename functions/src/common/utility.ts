import {HttpError, HttpStatuses} from "./http-error";

export const getBearerToken = (authorizationHeader: string | undefined): string => {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    throw new HttpError(HttpStatuses.unauthorized, "인증 정보를 확인할 수 없습니다.");
  }
  const splitedBearer = authorizationHeader.split("Bearer ");
  if ( splitedBearer.length > 1 ) {
    return splitedBearer[1];
  } else {
    throw new HttpError(HttpStatuses.unauthorized, "인증 정보를 확인할 수 없습니다.");
  }
};
