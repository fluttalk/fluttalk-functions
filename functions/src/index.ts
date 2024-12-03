import {onRequest} from "firebase-functions/v2/https";
import admin from "firebase-admin";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";

admin.initializeApp();

interface User {
  friendIds: string[];
}

const isUser = (obj: any): obj is User => {
  return obj && Array.isArray(obj.friendIds);
};

const HttpStatuses = {
  ok: {code: 200, name: "OK"},
  badRequest: {code: 400, name: "BadRequest"},
  unauthorized: {code: 401, name: "Unauthorized"},
  forbidden: {code: 404, name: "Forbidden"},
  notFound: {code: 404, name: "NotFound"},
  conflict: {code: 409, name: "Conflict"},
  unknown: {code: 500, name: "Unknown"},
} as const;

type HttpStatus = (typeof HttpStatuses)[keyof typeof HttpStatuses];

class HttpError implements Error {
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

export const getMe = onRequest(async (request, response) => {
  try {
    const authorization = request.headers.authorization;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new HttpError(HttpStatuses.unauthorized, "인증 정보를 확인할 수 없습니다.");
    } else {
      const idToken = authorization.split("Bearer ")[1];
      const auth = admin.auth();
      const decodedIdToken = await auth.verifyIdToken(idToken);
      const userRecord = await auth.getUser(decodedIdToken.uid);
      userRecord.uid;
      response.status(HttpStatuses.ok.code).json({result: userRecord});
    }
  } catch (error) {
    if (error instanceof HttpError) {
      response.status(error.code).json({...error});
    } else {
      response.sendStatus(HttpStatuses.unknown.code);
    }
  }
});

export const updateMe = onRequest(async (request, response) => {
  try {
    const authorization = request.headers.authorization;
    const {name} = request.body;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new HttpError(HttpStatuses.unauthorized, "인증 정보를 확인할 수 없습니다.");
    } else if (!name) {
      throw new HttpError(HttpStatuses.badRequest, "변경할 이름을 전달해주세요.");
    } else {
      const idToken = authorization.split("Bearer ")[1];
      const auth = admin.auth();
      const decodedIdToken = await auth.verifyIdToken(idToken);
      const userRecord = await auth.updateUser(decodedIdToken.uid, {displayName: name});
      response.status(HttpStatuses.ok.code).json({result: userRecord});
    }
  } catch (error) {
    if (error instanceof HttpError) {
      response.status(error.code).json({...error});
    } else {
      response.sendStatus(HttpStatuses.unknown.code);
    }
  }
});

export const getFriends = onRequest(async (request, response) => {
  try {
    const authorization = request.headers.authorization;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new HttpError(HttpStatuses.unauthorized, "인증 정보를 확인할 수 없습니다.");
    } else {
      const idToken = authorization.split("Bearer ")[1];
      const auth = admin.auth();
      const decodedIdToken = await auth.verifyIdToken(idToken);
      const documentSnapshot = await getFirestore().collection("users").doc(`${decodedIdToken.uid}`).get();
      const data = documentSnapshot.data();
      if (documentSnapshot.exists && isUser(data)) {
        const userIdentifiers = data.friendIds.map((friendId) => ({uid: friendId}));
        const result = await auth.getUsers(userIdentifiers);
        response.status(HttpStatuses.ok.code).json({results: result.users});
      } else {
        response.status(HttpStatuses.ok.code).json({results: []});
      }
    }
  } catch (error) {
    if (error instanceof HttpError) {
      response.status(error.code).json({...error});
    } else {
      response.sendStatus(HttpStatuses.unknown.code);
    }
  }
});

export const addFriendByEmail = onRequest(async (request, response) => {
  try {
    const authorization = request.headers.authorization;
    const {email} = request.body;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new HttpError(HttpStatuses.unauthorized, "인증 정보를 확인할 수 없습니다.");
    } else if (!email) {
      throw new HttpError(HttpStatuses.badRequest, "추가할 친구의 이메일을 전달해주세요.");
    } else {
      const idToken = authorization.split("Bearer ")[1];
      const auth = admin.auth();
      const decodedIdToken = await auth.verifyIdToken(idToken);
      const friendRecord = await auth.getUserByEmail(email).catch((reason) => {
        throw new HttpError(HttpStatuses.notFound, reason);
      });
      const documentRef = getFirestore().collection("users").doc(decodedIdToken.uid);
      const snapshot = await documentRef.get();
      if (snapshot.exists) {
        const data = snapshot.data();
        if (isUser(data) && data.friendIds.includes(friendRecord.uid)) {
          throw new HttpError(HttpStatuses.conflict, "이미 친구로 등록된 유저입니다.");
        }
        await documentRef.update({friendIds: FieldValue.arrayUnion(friendRecord.uid)});
      } else {
        await documentRef.set({friendIds: [friendRecord.uid]});
      }
      response.status(HttpStatuses.ok.code).json({result: friendRecord});
    }
  } catch (error) {
    if (error instanceof HttpError) {
      response.status(error.code).json({...error});
    } else {
      response.sendStatus(HttpStatuses.unknown.code);
    }
  }
});

export const removeFriendByEmail = onRequest(async (request, response) => {
  try {
    const authorization = request.headers.authorization;
    const {email} = request.body;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new HttpError(HttpStatuses.unauthorized, "인증 정보를 확인할 수 없습니다.");
    } else if (!email) {
      throw new HttpError(HttpStatuses.badRequest, "삭제할 친구의 이메일을 전달해주세요.");
    } else {
      const idToken = authorization.split("Bearer ")[1];
      const auth = admin.auth();
      const decodedIdToken = await auth.verifyIdToken(idToken);
      const friendRecord = await auth.getUserByEmail(email).catch((reason) => {
        throw new HttpError(HttpStatuses.notFound, reason);
      });
      const documentRef = getFirestore().collection("users").doc(decodedIdToken.uid);
      const snapshot = await documentRef.get();
      if (snapshot.exists) {
        const data = snapshot.data();
        if (!isUser(data) || !data.friendIds.includes(friendRecord.uid)) {
          throw new HttpError(HttpStatuses.notFound, "친구로 등록되지 않은 유저입니다.");
        } else {
          await documentRef.set({
            ...data,
            friendIds: data.friendIds.filter((friendId) => friendId != friendRecord.uid),
          });
          response.status(HttpStatuses.ok.code).json({result: friendRecord});
        }
      } else {
        throw new HttpError(HttpStatuses.notFound, "유저 정보를 확인할 수 없습니다.");
      }
    }
  } catch (error) {
    if (error instanceof HttpError) {
      response.status(error.code).json({...error});
    } else {
      response.sendStatus(HttpStatuses.unknown.code);
    }
  }
});

function isString(obj: any): obj is string {
  return (obj && typeof obj === "string");
}

export const getChats = onRequest(async (request, response) => {
  try {
    const authorization = request.headers.authorization;
    const {startAt} = request.query;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new HttpError(HttpStatuses.unauthorized, "인증 정보를 확인할 수 없습니다.");
    } else {
      const idToken = authorization.split("Bearer ")[1];
      const auth = admin.auth();
      const decodedIdToken = await auth.verifyIdToken(idToken);
      const collectionRef = getFirestore().collection("chats");
      const count = 100;
      let query = collectionRef.where("members", "array-contains", decodedIdToken.uid).orderBy("updatedAt", "desc").limit(count + 1);
      if (isString(startAt)) {
        const startAtSnapshot = await collectionRef.doc(startAt).get();
        if (startAtSnapshot.exists) {
          query = query.startAt(startAtSnapshot);
        } else {
          throw new HttpError(HttpStatuses.notFound, `${startAt}으로 전달한 document를 찾을 수 없습니다.`);
        }
      }

      const snapshot = await query.get();
      console.log(snapshot.docs.length);
      if (snapshot.empty) {
        response.status(HttpStatuses.ok.code).json({nextKey: null, results: []});
      } else {
        const datas = snapshot.docs.slice(0, count).map((doc) => doc.data());
        response.status(HttpStatuses.ok.code).json({
          nextKey: snapshot.docs.length > count ? snapshot.docs[count].id : null,
          results: datas,
        });
      }
    }
  } catch (error) {
    console.log(error);
    if (error instanceof HttpError) {
      response.status(error.code).json({...error});
    } else {
      response.sendStatus(HttpStatuses.unknown.code);
    }
  }
});

interface Message {
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
  lastMessage?: Message,
}

const isChat = (obj: any): obj is Chat => {
  return obj && Array.isArray(obj.members);
};

export const sendMessage = onRequest(async (request, response) => {
  try {
    const authorization = request.headers.authorization;
    const {chatId, content} = request.body;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new HttpError(HttpStatuses.unauthorized, "인증 정보를 확인할 수 없습니다.");
    } else if (!chatId) {
      throw new HttpError(HttpStatuses.badRequest, "메시지 전송을 위해 채팅 chatId를 전달해주세요.");
    } else if (!content) {
      throw new HttpError(HttpStatuses.badRequest, "메시지의 컨텐트를 전달해주세요");
    } else {
      const idToken = authorization.split("Bearer ")[1];
      const auth = admin.auth();
      const firestore = getFirestore();
      const decodedIdToken = await auth.verifyIdToken(idToken);
      const chat = await firestore.collection("chats").doc(chatId).get();
      if (!chat.exists) {
        throw new HttpError(HttpStatuses.notFound, `${chatId}에 해당하는 채팅방을 찾을 수 없습니다.`);
      }
      const chatData = chat.data();
      if (!isChat(chatData)) {
        throw new HttpError(HttpStatuses.unknown, `${chatId}로 가져온 데이터를 처리하는 과정에서 알 수 없는 오류가 발생했습니다.`);
      }
      if (!chatData.members.includes(decodedIdToken.uid)) {
        throw new HttpError(HttpStatuses.forbidden, `${chatId}에 접근할 수 없습니다.`);
      }
      const newMssageDocRef = firestore.collection("messages").doc();
      const message: Message = {
        id: newMssageDocRef.id,
        chatId: chatId,
        sender: decodedIdToken.uid,
        content: content,
        sentAt: Date.now(),
      };
      await newMssageDocRef.set(message);
      await firestore.collection("chats").doc(chatId).update({
        lastMessage: message,
      });
      response.status(HttpStatuses.ok.code).json({result: message});
    }
  } catch (error) {
    console.error(error);
    if (error instanceof HttpError) {
      response.status(error.code).json({...error});
    } else {
      response.sendStatus(HttpStatuses.unknown.code);
    }
  }
});

export const createChat = onRequest(async (request, response) => {
  try {
    const authorization = request.headers.authorization;
    const {email, title} = request.body;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new HttpError(HttpStatuses.unauthorized, "인증 정보를 확인할 수 없습니다.");
    } else if (!email) {
      throw new HttpError(HttpStatuses.badRequest, "채팅을 시작할 유저의 이메일을 전달해주세요.");
    } else if (!title) {
      throw new HttpError(HttpStatuses.badRequest, "채팅방의 이름을 전달해주세요.");
    } else {
      const idToken = authorization.split("Bearer ")[1];
      const auth = admin.auth();
      const decodedIdToken = await auth.verifyIdToken(idToken);
      const otherUserRecord = await auth.getUserByEmail(email).catch((reason) => {
        throw new HttpError(HttpStatuses.notFound, reason);
      });

      const user = await getFirestore().collection("users").doc(decodedIdToken.uid).get();
      const userData = user.data();
      if (!isUser(userData) || !userData.friendIds.includes(otherUserRecord.uid)) {
        throw new HttpError(HttpStatuses.forbidden, `${email}유저와의 친구가 아닙니다.`);
      }

      const willCreateChatDocumentRef = getFirestore().collection("chats").doc();
      const now = Date.now();
      const chat: Chat = {
        id: willCreateChatDocumentRef.id,
        title: title,
        members: [decodedIdToken.uid, otherUserRecord.uid],
        createdAt: now,
        updatedAt: now,
      };
      await willCreateChatDocumentRef.set(chat);
      response.status(HttpStatuses.ok.code).json({result: chat});
    }
  } catch (error) {
    console.error(error);
    if (error instanceof HttpError) {
      response.status(error.code).json({...error});
    } else {
      response.sendStatus(HttpStatuses.unknown.code);
    }
  }
});

export const getMessages = onRequest(async (request, response) => {
  try {
    const authorization = request.headers.authorization;
    const {chatId, startAt} = request.query;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new HttpError(HttpStatuses.unauthorized, "인증 정보를 확인할 수 없습니다.");
    } else if (!chatId) {
      throw new HttpError(HttpStatuses.badRequest, "채팅방의 아이디를 전달해주세요.");
    } else {
      const idToken = authorization.split("Bearer ")[1];
      const auth = admin.auth();
      const firestore = getFirestore();
      const decodedIdToken = await auth.verifyIdToken(idToken);
      const chatSnapshot = await firestore.collection("chats").doc(chatId as string).get();
      const chat = chatSnapshot.data();
      if (!isChat(chat)) {
        throw new HttpError(HttpStatuses.unknown, "채팅방 정보를 처리하는데 문제가 발생했습니다.");
      } else if (!chat.members.includes(decodedIdToken.uid)) {
        throw new HttpError(HttpStatuses.forbidden, "채팅방 정보를 처리하는데 문제가 발생했습니다.");
      }

      const collectionRef = firestore.collection("messages");
      const count = 20;
      let query = collectionRef.where("chatId", "==", chatId).orderBy("sentAt", "desc").limit(count + 1);
      if (isString(startAt)) {
        const startSnapshot = await collectionRef.doc(startAt).get();
        if (!startSnapshot.exists) {
          throw new HttpError(HttpStatuses.notFound, `${startAt}으로 전달한 document를 찾을 수 없습니다.`);
        } else {
          query = query.startAt(startSnapshot);
        }
      }

      const snapshot = await query.get();
      if (snapshot.docs.length === 0) {
        response.status(HttpStatuses.ok.code).json({nextKey: null, results: []});
      } else {
        const datas = snapshot.docs.slice(0, count).map((doc) => doc.data());
        console.log(datas);
        response.status(HttpStatuses.ok.code).json({
          nextKey: snapshot.docs.length > count ? snapshot.docs[count].id : null,
          results: datas,
        });
      }
    }
  } catch (error) {
    console.log(error);
    if (error instanceof HttpError) {
      response.status(error.code).json({...error});
    } else {
      response.sendStatus(HttpStatuses.unknown.code);
    }
  }
});

export const getNewMessages = onRequest(async (request, response) => {
  try {
    const authorization = request.headers.authorization;
    const {chatId, lastNewestSentAt} = request.query;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new HttpError(HttpStatuses.unauthorized, "인증 정보를 확인할 수 없습니다.");
    } else if (!chatId) {
      throw new HttpError(HttpStatuses.badRequest, "채팅방의 아이디를 전달해주세요.");
    } else if (!lastNewestSentAt) {
      throw new HttpError(HttpStatuses.badRequest, "신규 메시지 조회에 사용할 마지막 최신 메시지의 시간을 전달하세요.");
    } else {
      logger.info(authorization);
      logger.info(request.url);
      const idToken = authorization.split("Bearer ")[1];
      const auth = admin.auth();
      const firestore = getFirestore();
      const decodedIdToken = await auth.verifyIdToken(idToken);
      const chatSnapshot = await firestore.collection("chats").doc(chatId as string).get();
      const chat = chatSnapshot.data();
      if (!isChat(chat)) {
        throw new HttpError(HttpStatuses.unknown, "채팅방 정보를 처리하는데 문제가 발생했습니다.");
      } else if (!chat.members.includes(decodedIdToken.uid)) {
        throw new HttpError(HttpStatuses.forbidden, "채팅방 정보를 처리하는데 문제가 발생했습니다.");
      }

      const collectionRef = firestore.collection("messages");
      const query = collectionRef.where("chatId", "==", chatId).orderBy("sentAt", "desc").endBefore(parseInt(lastNewestSentAt as string));
      const snapshot = await query.get();
      logger.info(`empty : ${snapshot.empty}`);
      if (snapshot.empty) {
        response.status(HttpStatuses.ok.code).json({nextKey: null, results: []});
      } else {
        const datas = snapshot.docs.map((doc) => doc.data());
        logger.info(datas);
        response.status(HttpStatuses.ok.code).json({
          results: datas,
        });
      }
    }
  } catch (error) {
    console.log(error);
    if (error instanceof HttpError) {
      response.status(error.code).json({...error});
    } else {
      response.sendStatus(HttpStatuses.unknown.code);
    }
  }
});
