# Model
## UserMetadata
```dart
class UserMetadata {
  DateTime lastSignInTime;
  UserMetadata({required this.lastSignInTime});
  factory UserMetadata.fromJson(Map<String, dynamic> json) {
    DateFormat format = DateFormat("EEE, dd MMM yyyy HH:mm:ss 'GMT'");
    DateTime dateTime = format.parseUTC(json['lastSignInTime'] as String);
    return UserMetadata(
      lastSignInTime: dateTime,
    );
  }
}
```
## User
```dart
class User {
  String email;
  String uid;
  String displayName;
  UserMetadata userMetadata;
  User({
    required this.uid,
    required this.email,
    required this.displayName,
    required this.userMetadata,
  });
  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      uid: json['uid'] as String,
      email: json['email'] as String,
      displayName: json['displayName'] as String? ?? '',
      userMetadata: UserMetadata.fromJson(json['metadata']),
    );
  }
}
```

## UserResponse
```dart
class UserResponse {
  final User user;

  UserResponse({required this.user});

  factory UserResponse.fromJson(Map<String, dynamic> json) {
    return UserResponse(user: User.fromJson(json['result']));
  }
}
```
## UsersResponse
```dart
class UsersResponse {
  final List<User> users;

  UsersResponse({required this.users});

  factory UsersResponse.fromJson(Map<String, dynamic> json) {
    var list = json['results'] as List;
    List<User> users = list.map((i) => User.fromJson(i)).toList();
    return UsersResponse(users: users);
  }
}
```
## Chat
```dart
class Chat {
  String id;
  String title;
  List<String> members;
  DateTime createdAt;
  DateTime updatedAt;
  Message? lastMessage;

  Chat({
    required this.id,
    required this.title,
    required this.members,
    required this.createdAt,
    required this.updatedAt,
    this.lastMessage,
  });

  factory Chat.fromJson(Map<String, dynamic> json) {
    return Chat(
      id: json['id'] as String,
      title: json['title'] as String,
      members: List<String>.from(json['members']),
      createdAt: DateTime.fromMillisecondsSinceEpoch(json['createdAt']),
      updatedAt: DateTime.fromMillisecondsSinceEpoch(json['updatedAt']),
      lastMessage: json['lastMessage'] != null
          ? Message.fromJson(json['lastMessage'])
          : null,
    );
  }

  String get lastMessageContent => lastMessage?.content ?? '';
}
```
## Chats
```dart
class ChatsResponse {
  final List<Chat> chats;
  final String? nextKey;

  ChatsResponse({required this.nextKey, required this.chats});

  factory ChatsResponse.fromJson(Map<String, dynamic> json) {
    var list = json['results'] as List;
    var nextKey = json['nextKey'] != null ? json['nextKey'] as String : null;
    List<Chat> chats = list.map((i) => Chat.fromJson(i)).toList();
    return ChatsResponse(nextKey: nextKey, chats: chats);
  }
}
```
## Message
```dart
class Message {
  String id;
  String chatId;
  String sender;
  String content;
  int sentAt;

  Message({
    required this.id,
    required this.chatId,
    required this.sender,
    required this.content,
    required this.sentAt,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as String,
      chatId: json['chatId'] as String,
      sender: json['sender'] as String,
      content: json['content'] as String,
      sentAt: json['sentAt'] as int,
    );
  }
}
```
## MessageResponse
```dart
class MessageResponse {
  final Message message;

  MessageResponse({required this.message});

  factory MessageResponse.fromJson(Map<String, dynamic> json) {
    return MessageResponse(message: Message.fromJson(json['result']));
  }
}
```
## MessagesResponse
```dart
class MessagesResponse {
  final List<Message> messages;
  final String? nextKey;

  MessagesResponse({required this.nextKey, required this.messages});

  factory MessagesResponse.fromJson(Map<String, dynamic> json) {
    var list = json['results'] as List;
    var nextKey = json['nextKey'] != null ? json['nextKey'] as String : null;
    List<Message> messages = list.map((i) => Message.fromJson(i)).toList();
    return MessagesResponse(nextKey: nextKey, messages: messages);
  }
}
```
# Protocol
## getMe
### **설명**
`getMe` 함수는 사용자의 인증 정보를 확인하고, 해당 사용자의 정보를 반환하는 Firebase Cloud Function입니다.

### **URL**
[GET] https://getme-cwpwobd65q-uc.a.run.app

### **요청 헤더**
`Authorization`: Bearer 토큰 형식으로 사용자의 인증 정보를 포함해야 합니다.

## **요청 및 응답 예시**
```dart
final response = await dio.get(
    "https://getme-cwpwobd65q-uc.a.run.app",
    options: Options(
      headers: {
        'Authorization': 'Bearer $idToken',
        'Content-Type': 'application/json'
      },
    ),
);

UserResponse.fromJson(response.data);
```

# updateMe
### **설명**
사용자의 이름을 업데이트하는 API입니다. 성공적으로 업데이트되면, 업데이트된 사용자 정보를 포함한 응답을 반환합니다.

### **URL**
[POST] https://updateme-cwpwobd65q-uc.a.run.app

### **요청 헤더**
`Authorization`: Bearer 토큰 형식으로 사용자의 인증 정보를 포함해야 합니다.

## **요청 및 응답 예시**
```dart
final response = await dio.post(
    "https://updateme-cwpwobd65q-uc.a.run.app",
    options: Options(
      headers: {
        'Authorization': 'Bearer $idToken',
        'Content-Type': 'application/json'
      },
    ),
    data: {"name": name},
);

UserResponse.fromJson(response.data);
```

## getFriends
### **설명**
사용자의 친구 목록을 반환하는 API입니다.

### **URL**
[GET] https://getfriends-cwpwobd65q-uc.a.run.app

### **요청 헤더**
`Authorization`: Bearer 토큰 형식으로 사용자의 인증 정보를 포함해야 합니다.

## **요청 및 응답 예시**
```dart
final response = await dio.get(
    "https://getfriends-cwpwobd65q-uc.a.run.app",
    options: Options(
      headers: {
        'Authorization': 'Bearer $idToken',
        'Content-Type': 'application/json'
      },
    ),
);
UsersResponse.fromJson(response.data);
```

# addFriendByEmail
### **설명**
email에 해당하는 친구를 추가하는 API입니다.
### **URL**
[POST] https://addfriendbyemail-cwpwobd65q-uc.a.run.app

### **요청 헤더**
`Authorization`: Bearer 토큰 형식으로 사용자의 인증 정보를 포함해야 합니다.

## **요청 및 응답 예시**
```dart
final response = await dio.post(
  "https://addfriendbyemail-cwpwobd65q-uc.a.run.app",
  options: Options(
    headers: {
      'Authorization': 'Bearer $idToken',
      'Content-Type': 'application/json'
    },
  ),
  data: {"email": email},
);
UserResponse.fromJson(response.data);
```

# removeFriendByEmail
### **설명**
등록된 친구 중 email에 해당하는 친구를 제거하는 API

### **URL**
[POST] https://removefriendbyemail-cwpwobd65q-uc.a.run.app

### **요청 헤더**
`Authorization`: Bearer 토큰 형식으로 사용자의 인증 정보를 포함해야 합니다.

## **요청 및 응답 예시**
```dart
final response = await dio.post(
  "https://removefriendbyemail-cwpwobd65q-uc.a.run.app",
  options: Options(
    headers: {
      'Authorization': 'Bearer $idToken',
      'Content-Type': 'application/json'
    },
  ),
  data: {"email": email},
);
final removedUser = UserResponse.fromJson(response.data)
```

# getChats
### **설명**
유저가 참여하고 있는 채팅방 목록을 페이지네이션으로 반환하는 API

### **URL**
[GET] https://getchats-cwpwobd65q-uc.a.run.app

### **요청 헤더**
`Authorization`: Bearer 토큰 형식으로 사용자의 인증 정보를 포함해야 합니다.

## **요청 및 응답 예시**
```dart
// 조회를 시작할 chat의 아이디, startAt을 전달하지 않으면 처음부터 조회
String? startAt;
final response = await dio.get(
  "https://getchats-cwpwobd65q-uc.a.run.app",
  options: Options(
    headers: {
      'Authorization': 'Bearer $idToken',
      'Content-Type': 'application/json'
    },
  ),
  queryParameters: startAt == null ? {} : {startAt: startAt},
);
ChatsResponse.fromJson(response.data);
```

# createChat
### **설명**
친구의 이메일과 채팅방의 타이틀로 1:1 채팅방을 생성하는 API

### **URL**
[POST] https://createchats-cwpwobd65q-uc.a.run.app

### **요청 헤더**
`Authorization`: Bearer 토큰 형식으로 사용자의 인증 정보를 포함해야 합니다.

## **요청 및 응답 예시**
```dart
// 1:1 채팅방을 만들 친구의 이메일
String email;
String title; 
final response = await dio.post(
  "https://createchats-cwpwobd65q-uc.a.run.app",
  options: Options(
    headers: {
      'Authorization': 'Bearer $idToken',
      'Content-Type': 'application/json'
    },
  ),
  data: {"email": email, "title": title},
);
ChatResponse.fromJson(response.data);
```

# sendMessage
### **설명**
채팅방으로 메시지를 전송하는 API

### **URL**
[POST] https://sendmessage-cwpwobd65q-uc.a.run.app

### **요청 헤더**
`Authorization`: Bearer 토큰 형식으로 사용자의 인증 정보를 포함해야 합니다.

## **요청 및 응답 예시**
```dart
String chatId; // 전송할 채팅방의 id
String content; // 채팅방으로 전송할 메시지
final response = await dio.post(
  "https://sendmessage-cwpwobd65q-uc.a.run.app",
  options: Options(
    headers: {
      'Authorization': 'Bearer $idToken',
      'Content-Type': 'application/json'
    },
  ),
  data: {"chatId": chatId, "content": content},
);
MessageResponse.fromJson(response.data);
```

# getMessages
### **설명**
채팅방의 메시지를 페이지네이션으로 조회하는 api

### **URL**
[GET] https://getmessages-cwpwobd65q-uc.a.run.app

### **요청 헤더**
`Authorization`: Bearer 토큰 형식으로 사용자의 인증 정보를 포함해야 합니다.

## **요청 및 응답 예시**
```dart
// 메시지를 조회할 채팅방의 id
String chatId;
// 옵셔널, 조회를 시작할 채팅방의 id. MessagesResponse의 nextKey 활용
String? startAt;
final response = await dio.get(
  "https://getmessages-cwpwobd65q-uc.a.run.app",
  options: Options(
    headers: {
      'Authorization': 'Bearer $idToken',
      'Content-Type': 'application/json'
    },
  ),
  queryParameters: {"chatId": chatId, "startAt": startAt},
);
MessagesResponse.fromJson(response.data);
```

# getNewMessages
### **설명**
채팅방의 최신 메시지를 조회하는 API

### **URL**
[GET] https://getnewmessages-cwpwobd65q-uc.a.run.app

### **요청 헤더**
`Authorization`: Bearer 토큰 형식으로 사용자의 인증 정보를 포함해야 합니다.

## **요청 및 응답 예시**
```dart
// 메시지를 조회할 채팅방의 id
String chatId;
// 옵셔널, nanoseconds 이후로 전송된 메시지 조회에 사용
int lastNewestSentAt;
final response = await dio.get(
  "https://getnewmessages-cwpwobd65q-uc.a.run.app",
  options: Options(
    headers: {
      'Authorization': 'Bearer $idToken',
      'Content-Type': 'application/json'
    },
  ),
  queryParameters: {
    "chatId": chatId, 
    "lastNewestSentAt": lastNewestSentAt
  },
);
MessagesResponse.fromJson(response.data);
```