import express from 'express';
import mongoose from 'mongoose';
import {Umzug, MongoDBStorage} from 'umzug';
import {botConfig} from 'config';

const MIGRATION_COLLECTION_NAME = 'migration';
const {MONGO_DB_URL} = botConfig;
export const app = express();

mongoose.connect(MONGO_DB_URL, {
  keepAlive: 1,
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.connection.on('error', (err) => {
  throw err;
});
mongoose.connection.on('open', () => {
  makeMigration();
});

/**
 * Execute migration scripts if required
 */
function makeMigration() {
  const storage = new MongoDBStorage({
    connection: mongoose.connection.client.db(),
    collectionName: MIGRATION_COLLECTION_NAME,
  });
  const umzug = new Umzug({
    storage,
    migrations: {glob: 'migrations/*.js'},
    logger: console,
  });

  (async () => {
    await umzug.up();
    process.exit(0);
  })();
}
