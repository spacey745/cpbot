import _ from 'lodash';
import assert from 'assert';
import {botConfig} from 'config';
import {MessageForward} from '../db';
import {getBotUsername, getTelegram} from './botService';
import {isAdminChat} from './chatService';
import {encryptNumberWithConfigIV} from '../helpers/cryptoHelper';
import {serverError} from '../utils/botErrors';

const {MASTER_ADMIN_GROUP_ID, ADMIN_MIRROR_GROUP_ID} = botConfig;

export const TELEGRAM_MESSAGE_TEXT_LIMIT = 4096;
export const TELEGRAM_MESSAGE_CAPTION_LIMIT = 1024;

export const MessageLevels = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
};

/**
 * Send a message to the master chat
 *
 * @param {string} level A message level
 * @param {string} text A message text
 * @param {object} [meta] A message meta information
 * @return {Promise<Message>} A sent telegram message
 */
export async function sendToMasterChat(level, text, meta) {
  assert(level, 'The "level" is required');
  assert(_.values(MessageLevels).includes(level), `The "level" must be one of ${_.values(MessageLevels)}`);
  assert(text, 'The "text" is required');

  const totalMeta = {botName: getBotUsername(), ...(meta || {})};
  console.log(level, text, totalMeta || '');

  let totalText = `${level} ${text}${totalMeta ? ` ${JSON.stringify(totalMeta)}` : ''}`;
  if ([...totalText].length > TELEGRAM_MESSAGE_TEXT_LIMIT) {
    totalText = totalText.substring(0, TELEGRAM_MESSAGE_TEXT_LIMIT - 3) + '...';
  }
  return getTelegram().sendMessage(MASTER_ADMIN_GROUP_ID, totalText);
}

/**
 * Edit a message created in other chats based on the provided message
 *
 * @param {Message} message A telegram message
 * @return {Promise<void>}
 */
export async function editForwardedMessage(message) {
  assert(message, 'The "message" is required');

  const chatId = message.chat?.id;
  if (!isAdminChat(chatId)) {
    throw serverError('Unsupported logic. Can not edit messages from a not admin chats', {chatId});
  }

  const adminMessageForwards = await MessageForward.find({
    fromChatId: encryptNumberWithConfigIV(chatId),
    fromMessageId: message.message_id,
  });
  if (_.isEmpty(adminMessageForwards)) {
    return;
  }

  if (adminMessageForwards.length > 1) {
    throw serverError('Unsupported logic. Can not edit messages split to several parts', {
      fromChatId: chatId,
      fromMessageId: message.message_id,
    });
  }

  const [adminMessageForward] = adminMessageForwards;
  const mirrorMessageForward = await MessageForward.findOne({
    fromChatId: encryptNumberWithConfigIV(ADMIN_MIRROR_GROUP_ID),
    toChatId: encryptNumberWithConfigIV(adminMessageForward.toChatId),
    toMessageId: adminMessageForward.toMessageId,
  });

  await Promise.all([
    editMessage(message, adminMessageForward.toChatId, adminMessageForward.toMessageId),
    editMessage(message, mirrorMessageForward.fromChatId, mirrorMessageForward.fromMessageId),
  ]);
}

/**
 * Edit a message from another chat based on a provided original message
 *
 * @param {Message} originalMessage An original telegram message
 * @param {number} targetChatId A target chat id
 * @param {number} targetMessageId A target message id
 */
async function editMessage(originalMessage, targetChatId, targetMessageId) {
  if (originalMessage.text) {
    const entities = originalMessage.entities ? {entities: originalMessage.entities} : {};
    return getTelegram().editMessageText(targetChatId, targetMessageId, undefined, originalMessage.text, {...entities});
  }
  if (originalMessage.caption) {
    const captionEntities = originalMessage.caption_entities
      ? {caption_entities: originalMessage.caption_entities}
      : {};
    return getTelegram().editMessageCaption(targetChatId, targetMessageId, undefined, originalMessage.caption, {
      ...captionEntities,
    });
  }

  throw serverError('Unrecognized edited message', {
    messageProps: _.keys(originalMessage),
  });
}
