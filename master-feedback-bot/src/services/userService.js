import assert from 'assert';
import {MessageForward, User} from '../db';
import {encryptNumberWithConfigIV} from '../helpers/cryptoHelper';
import {getTelegram} from './botService';

/**
 * Send information about a message sender to chats
 *
 * @param {[number]} chatIds A target telegram chat ids
 * @param {object} message A message
 */
export async function sendUserInfo(chatIds, message) {
  assert(chatIds, 'The "chatIds" is required');
  assert(message, 'The "message" is required');
  assert(message.message_id, 'The "message.message_id" is required');
  assert(message.chat, 'The "message.chat" is required');
  assert(message.from, 'The "message.from" is required');

  const dbMessageForward = await MessageForward.findOne({
    toChatId: encryptNumberWithConfigIV(message.chat.id),
    toMessageId: message.message_id,
  });

  const user = message.forward_from || message.from;
  const userId = dbMessageForward ? dbMessageForward.fromUserId : user.id;
  const dbUser = userId && (await User.findOne({tgUserId: encryptNumberWithConfigIV(userId)}));
  const chat = message.forward_from_chat;

  const firstName = dbUser?.firstName || (!dbMessageForward ? user.first_name : undefined);
  const initFirstName = dbUser?.initFirstName;
  const lastName = dbUser?.lastName || (!dbMessageForward ? user.last_name : undefined);
  const initLastName = dbUser?.initLastName;
  const username = dbUser?.username || (!dbMessageForward ? user.username : undefined);
  const firstUsername = dbUser?.firstUsername;

  const chatText = chat
    ? '\nЧат: ' +
      `[${chat.id ? `🆔${chat.id}` : 'нет_идентификатора'}], ` +
      `[${chat.username ? `@${chat.username}` : 'нет_ника'}], ` +
      `[${chat.title || 'нет_заголовка'}]`
    : '';
  const profileText =
    `Имя: [${firstName || 'нет_имени'}] [${lastName || 'нет_фамилии'}]\n` +
    `Начальное имя: [${initFirstName || 'нет_имени'}] [${initLastName || 'нет_фамилии'}]\n` +
    `Текущий ник: [${username ? `@${username}` : 'нет_ника'}]\n` +
    `Первый ник: [${firstUsername ? `@${firstUsername}` : 'нет_ника'}]` +
    chatText;
  const userIdText = userId && `🆔: [${userId}](tg://user?id=${userId})`;

  for (const chatId of chatIds) {
    await getTelegram().sendMessage(chatId, profileText);

    if (userIdText) {
      await getTelegram().sendMessage(chatId, userIdText, {parse_mode: 'MarkdownV2'});
    }
  }
}
