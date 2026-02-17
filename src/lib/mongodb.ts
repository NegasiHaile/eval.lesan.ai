import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI!;
const dbName = process.env.MONGODB_DB ?? process.env.NODE_ENV;
const options = {};

if (!uri) {
  throw new Error("Please add your Mongo URI to .env.local");
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect().then((client) => {
      // Monkey patch .db() to use default dbName when no name is passed
      const originalDb = client.db.bind(client);
      client.db = (name) => originalDb(name || dbName);
      return client;
    });
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect().then((client) => {
    const originalDb = client.db.bind(client);
    client.db = (name) => originalDb(name || dbName);
    return client;
  });
}

export default clientPromise;
