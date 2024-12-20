import {onRequest} from "firebase-functions/v2/https";
import admin, {auth, messaging} from "firebase-admin";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {Message} from "firebase-admin/lib/messaging/messaging-api";
import {HttpError, HttpStatuses} from "./common/http-error";
import {isUser} from "./data/user";
import {isString} from "./common/utility";
import {Chat, isChat} from "./data/chat";
import {ChatMessage} from "./data/chat-message";
import {isFcmException, isPushToken, PushToken} from "./data/push-token";
import {FirebaseAuthService} from "./service/firebase-auth-service";
import FirebaseFirestoreService from "./service/firebase-firestore-service";
import {UsersMeController} from "./controller/users-me-controller";
import {ChatsController} from "./controller/chats-controller";
import {PushTokensController} from "./controller/push-tokens-controller";
import {Controller} from "./controller/controller";
import express from "express";
import {MessagesController} from "./controller/messages-controller";
import FirebaseMessagingService from "./service/firebase-messaging-service";
import {UsersFriendsController} from "./controller/users-friends-controller";

admin.initializeApp();

const firebaseAuthService = new FirebaseAuthService(auth());
const firebaseFirestoreService = new FirebaseFirestoreService(getFirestore());
const firebaseMessagingService = new FirebaseMessagingService(messaging());

const controllers: Controller[] = [
  new UsersMeController(firebaseAuthService),
  new UsersFriendsController(firebaseAuthService, firebaseFirestoreService),
  new ChatsController(firebaseAuthService, firebaseFirestoreService),
  new PushTokensController(firebaseAuthService, firebaseFirestoreService),
  new MessagesController(firebaseAuthService, firebaseFirestoreService, firebaseMessagingService),
];

const app = express();
controllers.forEach((controller) => controller.init(app));
export const api = onRequest({timeoutSeconds: 10}, app);

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
        // const value = {friendIds: FieldValue.arrayUnion(friendRecord.uid)};
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
    if (error instanceof HttpError) {
      response.status(error.code).json({...error});
    } else {
      response.sendStatus(HttpStatuses.unknown.code);
    }
  }
});

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
      } else if (!chatData.members.includes(decodedIdToken.uid)) {
        throw new HttpError(HttpStatuses.forbidden, `${chatId}에 접근할 수 없습니다.`);
      }

      const newMssageDocRef = firestore.collection("messages").doc();
      const chatMessage: ChatMessage = {
        id: newMssageDocRef.id,
        chatId: chatId,
        sender: decodedIdToken.uid,
        content: content,
        sentAt: Date.now(),
      };
      await newMssageDocRef.set(chatMessage);
      await firestore.collection("chats").doc(chatId).update({
        lastMessage: chatMessage,
      });

      response.status(HttpStatuses.ok.code).json({result: chatMessage});
      const pushTokensCollectionRef = firestore.collection("pushTokens");
      const receiversUids = chatData.members.filter((member) => member !== decodedIdToken.uid);
      const snapshotPromises = receiversUids.map((uid) => pushTokensCollectionRef.doc(uid).get());
      snapshotPromises.forEach(async (snapshotPromise, index) => {
        const snapshot = await snapshotPromise;
        if ( snapshot.exists ) {
          const pushToken = snapshot.data();
          if ( isPushToken(pushToken) && pushToken.value ) {
            const pushMessage: Message = {
              token: pushToken.value,
              notification: {title: "Fluttalk", body: content},
            };
            try {
              await admin.messaging().send(pushMessage);
            } catch (e) {
              const receiversUid = receiversUids[index];
              if (isFcmException(e) && (e.code === "messaging/unregistered" || e.code === "messaging/invalid-argument")) {
                await pushTokensCollectionRef.doc(receiversUid).delete();
              }
            }
          }
        }
      });
    }
  } catch (error) {
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
      const chatSnapshot = await firestore.collection("chats").doc(`${chatId}`).get();
      const chat = chatSnapshot.data();
      if (!isChat(chat)) {
        throw new HttpError(HttpStatuses.unknown, "채팅방 정보를 처리하는데 문제가 발생했습니다.");
      } else if (!chat.members.includes(decodedIdToken.uid)) {
        throw new HttpError(HttpStatuses.forbidden, `${chatId} 채팅방의 유저가 아니기 때문에 메시지를 전송할 수 없습니다.`);
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
        response.status(HttpStatuses.ok.code).json({
          nextKey: snapshot.docs.length > count ? snapshot.docs[count].id : null,
          results: datas,
        });
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
      const idToken = authorization.split("Bearer ")[1];
      const auth = admin.auth();
      const firestore = getFirestore();
      const decodedIdToken = await auth.verifyIdToken(idToken);
      const chatSnapshot = await firestore.collection("chats").doc(`${chatId}`).get();
      const chat = chatSnapshot.data();
      if (!isChat(chat)) {
        throw new HttpError(HttpStatuses.unknown, "채팅방 정보를 처리하는데 문제가 발생했습니다.");
      } else if (!chat.members.includes(decodedIdToken.uid)) {
        throw new HttpError(HttpStatuses.forbidden, `${chatId}의 멤버가 아니기 때문에 메시지를 조회할 수 없습니다.`);
      }

      const collectionRef = firestore.collection("messages");
      const query = collectionRef.where("chatId", "==", chatId).orderBy("sentAt", "desc").endBefore(parseInt(`${lastNewestSentAt}`));
      const snapshot = await query.get();
      if (snapshot.empty) {
        response.status(HttpStatuses.ok.code).json({nextKey: null, results: []});
      } else {
        const datas = snapshot.docs.map((doc) => doc.data());
        response.status(HttpStatuses.ok.code).json({
          results: datas,
        });
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

export const registerPushToken = onRequest(async (request, response) => {
  try {
    const authorization = request.headers.authorization;
    const {pushToken} = request.body;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new HttpError(HttpStatuses.unauthorized, "인증 정보를 확인할 수 없습니다.");
    } else if (!pushToken) {
      throw new HttpError(HttpStatuses.badRequest, "푸시 메시지 수신에 사용될 pushToken을 전달해주세요");
    }
    const idToken = authorization.split("Bearer ")[1];
    const auth = admin.auth();
    const decodedIdToken = await auth.verifyIdToken(idToken);
    const usersPushToken: PushToken = {
      value: pushToken,
    };
    await getFirestore().collection("pushTokens").doc(decodedIdToken.uid).set(usersPushToken);
    response.sendStatus(HttpStatuses.ok.code);
  } catch (error) {
    if (error instanceof HttpError) {
      response.status(error.code).json({...error});
    } else {
      response.sendStatus(HttpStatuses.unknown.code);
    }
  }
});
