import {DecodedIdToken} from "firebase-admin/lib/auth/token-verifier";
import {HttpError, HttpStatuses} from "../common/http-error";
import {Auth, UserRecord} from "firebase-admin/auth";
import {getBearerToken} from "../common/utility";
import admin from "firebase-admin";

export class FirebaseAuthService {
  constructor(private auth: Auth) {}
  verifyIdToken(authorizationHeader: string | undefined): Promise<DecodedIdToken> {
    try {
      const auth = admin.auth();
      const bearerToken = getBearerToken(authorizationHeader);
      return auth.verifyIdToken(bearerToken);
    } catch (error) {
      throw new HttpError(HttpStatuses.unauthorized, "토큰이 유효하지 않습니다.");
    }
  }
  async getUser(authorizationHeader: string | undefined): Promise<UserRecord> {
    const decodedIdToken = await this.verifyIdToken(authorizationHeader);
    return this.getUserByUid(decodedIdToken.uid);
  }
  async getUserByUid(uid: string): Promise<UserRecord> {
    return this.auth.getUser(uid);
  }
  getUserByEmail(email: string): Promise<UserRecord> {
    try {
      return this.auth.getUserByEmail(email);
    } catch (e) {
      throw new HttpError(HttpStatuses.notFound, `${email}에 해당하는 유저 정보를 찾을 수 없습니다.`);
    }
  }
  async updateUser(authorizationHeader: string | undefined, displayName: string): Promise<UserRecord> {
    const decodedIdToken = await this.verifyIdToken(authorizationHeader);
    return this.auth.updateUser(decodedIdToken.uid, {displayName});
  }
}
