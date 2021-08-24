import {botConfig} from 'config';

const {ADMIN_GROUP_ID, ADMIN_FAV_GROUP_ID} = botConfig;

/**
 * Check is a chat id an id of an admin chat
 *
 * @param {number} chatId A chat id
 * @returns {boolean} Is admin chat flag
 */
export function isAdminChat(chatId) {
  return chatId === ADMIN_GROUP_ID || chatId === ADMIN_FAV_GROUP_ID;
}
