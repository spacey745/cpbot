import {Schema, model} from 'mongoose';
import {encryptedNumberWithFixedIV} from '../types/encryptedValueTypes';

const messageForwardSchema = new Schema({
  fromUserId: encryptedNumberWithFixedIV,
  toUserId: encryptedNumberWithFixedIV,
  fromChatId: encryptedNumberWithFixedIV,
  toChatId: encryptedNumberWithFixedIV,
  fromMessageId: {type: Number},
  toMessageId: {type: Number},
  replyToId: {type: Schema.Types.ObjectId},
  created: {type: Date, default: Date.now},
  deleted: {type: Boolean},
});

messageForwardSchema.index({toChatId: 1, toMessageId: 1});
messageForwardSchema.index({toChatId: 1, fromMessageId: 1});

export const MessageForward = model('MessageForward', messageForwardSchema);
