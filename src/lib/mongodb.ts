import { MongoClient } from "mongodb";

const options = {};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

/**
 * Returns a cached MongoClient promise. The connection is only created on the
 * first call, so importing this module during `next build` is safe.
 */
export default function getClientPromise(): Promise<MongoClient> {
  if (clientPromise) return clientPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please add your Mongo URI to .env.local");
  }

  const dbName = process.env.MONGODB_DB ?? process.env.NODE_ENV;

  function connectAndPatch(): Promise<MongoClient> {
    const client = new MongoClient(uri!, options);
    return client.connect().then((c) => {
      const originalDb = c.db.bind(c);
      c.db = (name) => originalDb(name || dbName);
      return c;
    });
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = connectAndPatch();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    clientPromise = connectAndPatch();
  }

  return clientPromise;
}
