import {DocumentReference, Firestore, OrderByDirection, WhereFilterOp} from "firebase-admin/firestore";
import {HttpError, HttpStatuses} from "../common/http-error";

interface FirestoreWhere {
  fieldName: string,
  opStr: WhereFilterOp,
  value: any
}

interface FirestoreOrder {
  fieldName: string,
  directionStr?: OrderByDirection,
}

interface Page<T> {
  nextKey: string | null,
  results: T[],
}

export default class FirebaseFirestoreService {
  constructor(private firestore: Firestore) {}

  async create(collection: string): Promise<DocumentReference> {
    return this.firestore.collection(collection).doc();
  }

  async get<T>(collection: string, document: string, converter: (obj: any) => obj is T): Promise<T | undefined> {
    const documentSnapshot = await this.firestore.collection(collection).doc(document).get();
    if (!documentSnapshot.exists) {
      return undefined;
    }
    const data = documentSnapshot.data();
    if ( converter(data)) {
      return data;
    } else {
      throw new HttpError(HttpStatuses.unknown, `${collection}/${document} 경로에 데이터를 처리할 수 없습니다.`);
    }
  }

  async getPage<T>(collection: string, where: FirestoreWhere, order: FirestoreOrder, typeGuard: (obj: any) => obj is T, startAt?: string): Promise<Page<T>> {
    const collectionRef = this.firestore.collection(collection);
    const count = 100;
    let query = collectionRef.where(where.fieldName, where.opStr, where.value).orderBy(order.fieldName, order.directionStr).limit(count + 1);
    if (startAt) {
      const startAtSnapshot = await collectionRef.doc(startAt).get();
      if (startAtSnapshot.exists) {
        query = query.startAt(startAtSnapshot);
      } else {
        throw new HttpError(HttpStatuses.notFound, `${startAt}으로 전달한 document를 찾을 수 없습니다.`);
      }
    }
    const snapshot = await query.get();
    if (snapshot.empty) {
      const empty: Page<T> = {
        nextKey: null, results: [],
      };
      return empty;
    } else {
      const datas = snapshot.docs
        .slice(0, count)
        .map((doc) => doc.data())
        .map((data) => typeGuard(data) ? data : null)
        .filter(Boolean) as T[];

      const page: Page<T> = {
        nextKey: snapshot.docs.length > count ? snapshot.docs[count].id : null,
        results: datas,
      };
      return page;
    }
  }
  async getLatestAtBefore<T>(collection: string, where: FirestoreWhere, order: FirestoreOrder, converter: (obj: any) => T, beforeValue: any): Promise<T[]> {
    const collectionRef = this.firestore.collection(collection);
    const query = collectionRef.where(where.fieldName, where.opStr, where.value).orderBy(order.fieldName, order.directionStr).endBefore(beforeValue);
    const snapshot = await query.get();
    if (snapshot.empty) {
      return [];
    } else {
      return snapshot.docs
        .map((doc) => doc.data())
        .map((data) => converter(data) ? data : null)
        .filter(Boolean) as T[];
    }
  }

  async update<T>(collection: string, document: string, partial: Partial<T>) {
    const documentRef = this.firestore.collection(collection).doc(document);
    const documentSnapshot = await documentRef.get();
    if (documentSnapshot.exists) {
      await documentRef.update({...partial});
    } else {
      await documentRef.set({...partial});
    }
  }

  delete(collection: string, document: string) {
    this.firestore.collection(collection).doc(document);
  }
}
