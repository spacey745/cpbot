import {Schema, model} from 'mongoose';
import {encryptedNumberWithFixedIV, encryptedText} from '../types/encryptedValueTypes';
import {nextPushId} from '../../utils/uidGenerator';

const userSchema = new Schema({
  tgUserId: {...encryptedNumberWithFixedIV, index: true},
  firstUsername: encryptedText,
  username: encryptedText,
  initFirstName: encryptedText,
  firstName: encryptedText,
  initLastName: encryptedText,
  lastName: encryptedText,
  langCode: String,
  isFavorite: Boolean,
  isBanned: Boolean,
  maskUid: {type: String, default: nextPushId},
  created: {type: Date, default: Date.now},
  lastUsed: {type: Date, default: Date.now},
});

export const User = model('User', userSchema);
