import _ from 'lodash';
import express from 'express';
import mongoose from 'mongoose';
import {botInit} from './src/services/telegramService';
import http from 'http';
import {botConfig} from 'config';

const {ADMIN_GROUP_ID, ADMIN_FAV_GROUP_ID, ADMIN_MIRROR_GROUP_ID, MASTER_ADMIN_GROUP_ID, MONGO_DB_URL, PORT} =
  botConfig;
if (
  (ADMIN_GROUP_ID && !_.isNumber(ADMIN_GROUP_ID)) ||
  (ADMIN_FAV_GROUP_ID && !_.isNumber(ADMIN_FAV_GROUP_ID)) ||
  (ADMIN_MIRROR_GROUP_ID && !_.isNumber(ADMIN_MIRROR_GROUP_ID)) ||
  (MASTER_ADMIN_GROUP_ID && !_.isNumber(MASTER_ADMIN_GROUP_ID))
) {
  throw new Error('An admin group config value must be a number');
}

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
  createServer();
});

/**
 * Create HTTP server
 */
function createServer() {
  botInit(app);

  app.get('/alive', (req, res) => {
    return res.status(200).send('Alive');
  });

  // no ssl because communication is internal
  http.createServer(app).listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
