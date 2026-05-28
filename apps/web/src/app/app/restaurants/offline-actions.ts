type OfflineActionStatus =
  | "queued"
  | "syncing"
  | "synced"
  | "failed"
  | "conflicted"
  | "rejected";

export interface RestaurantOfflineAction {
  actionType: string;
  actorUserId: string;
  createdAt: string;
  deviceId: string;
  entityId?: string;
  entityType: "restaurant_table" | "order" | "payment";
  id: string;
  idempotencyKey: string;
  occurredAt: string;
  payload: unknown;
  propertyId: string;
  restaurantId?: string;
  retryCount: number;
  status: OfflineActionStatus;
  tenantId: string;
  syncMessage?: string;
}

const databaseName = "rayaan-pos-offline";
const databaseVersion = 1;
const storeName = "actions";
const offlineQueueMaxRetries = Number(
  process.env.NEXT_PUBLIC_OFFLINE_QUEUE_MAX_RETRIES ?? "3",
);

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(storeName)) {
        const store = database.createObjectStore(storeName, { keyPath: "id" });

        store.createIndex("status", "status");
        store.createIndex("createdAt", "createdAt");
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
) {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = callback(store);
    let result: T;

    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error);
    }

    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export async function countQueuedRestaurantActions() {
  const actions = await listQueuedRestaurantActions();

  return actions.length;
}

export async function enqueueRestaurantAction(action: RestaurantOfflineAction) {
  await withStore("readwrite", (store) => store.put(action));
}

export async function listQueuedRestaurantActions() {
  return withStore<RestaurantOfflineAction[]>("readonly", (store) =>
    store.getAll(),
  ).then((actions) =>
    actions
      .filter(
        (action) =>
          (action.status === "queued" || action.status === "failed") &&
          action.retryCount < offlineQueueMaxRetries,
      )
      .sort((first, second) => first.createdAt.localeCompare(second.createdAt)),
  );
}

export async function markRestaurantActionsSynced(actionIds: string[]) {
  const actions = await withStore<RestaurantOfflineAction[]>("readonly", (store) =>
    store.getAll(),
  );
  const syncedAt = new Date().toISOString();

  await withStore("readwrite", (store) => {
    for (const action of actions) {
      if (actionIds.includes(action.id)) {
        store.put({ ...action, createdAt: syncedAt, status: "synced" });
      }
    }
  });
}

export async function markRestaurantActionsFailed(actionIds: string[]) {
  const actions = await withStore<RestaurantOfflineAction[]>("readonly", (store) =>
    store.getAll(),
  );

  await withStore("readwrite", (store) => {
    for (const action of actions) {
      if (actionIds.includes(action.id)) {
        const retryCount = action.retryCount + 1;

        store.put({
          ...action,
          retryCount,
          status: retryCount >= offlineQueueMaxRetries ? "rejected" : "failed",
          syncMessage:
            retryCount >= offlineQueueMaxRetries
              ? `Retry limit reached after ${offlineQueueMaxRetries} attempts.`
              : action.syncMessage,
        });
      }
    }
  });
}

export async function markRestaurantActionsTerminal(
  results: Array<{ id: string; message?: string; status: "conflicted" | "rejected" }>,
) {
  const actions = await withStore<RestaurantOfflineAction[]>("readonly", (store) =>
    store.getAll(),
  );

  await withStore("readwrite", (store) => {
    for (const action of actions) {
      const result = results.find((candidate) => candidate.id === action.id);

      if (result) {
        store.put({
          ...action,
          status: result.status,
          syncMessage: result.message,
        });
      }
    }
  });
}
