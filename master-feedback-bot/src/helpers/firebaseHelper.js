import admin from 'firebase-admin';
import {botConfig} from 'config';

const {FIREBASE_CONFIG_JSON, DB_TABLE, FIREBASE_DB_URL} = botConfig;

const parsedServiceAccount = FIREBASE_CONFIG_JSON || require('../../config/fb-config.json');
admin.initializeApp({
  credential: admin.credential.cert(parsedServiceAccount),
  databaseURL: FIREBASE_DB_URL,
});

if (!DB_TABLE) console.error('DB_TABLE is missing!');
const db = admin.database().ref('server').child(DB_TABLE);

const usersRef = db.child('users');
const listsRef = db.child('lists');
const banRef = listsRef.child('banned');
const favRef = listsRef.child('favorites');
const msgSendersRef = listsRef.child('msgSenders');

export function getUsersRef() {
  return usersRef;
}

export function getMsgSendersRef() {
  return msgSendersRef;
}

export function getFavRef() {
  return favRef;
}

export function getBanRef() {
  return banRef;
}
