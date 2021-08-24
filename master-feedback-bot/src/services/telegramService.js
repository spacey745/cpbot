import _ from 'lodash';
import {botConfig} from 'config';
import {serializeError} from 'serialize-error';
import {getReplyToMsgId, halveMessage, halveMessageEntities} from '../helpers/telegramHelper';
import {encryptNumberWithConfigIV} from '../helpers/cryptoHelper';
import {MessageForward, User} from '../db';
import {TgMessage} from '../tg/message';
import {
  editForwardedMessage,
  MessageLevels,
  sendToMasterChat,
  TELEGRAM_MESSAGE_CAPTION_LIMIT,
  TELEGRAM_MESSAGE_TEXT_LIMIT,
} from './messageService';
import {getBot, getBotId, getBotUsername, isPooling} from './botService';
import {sendUserInfo} from './userService';
import {BotErrorTypes} from '../utils/botErrors';

const {
  SERVER_URL,
  WEBHOOK_PATH,
  ADMIN_GROUP_ID,
  MASTER_ADMIN_GROUP_ID,
  PROXY_PORT,
  ADMIN_MIRROR_GROUP_ID,
  CUSTOM_STRINGS,
  ADMIN_FAV_GROUP_ID,
} = botConfig;

let bot = getBot();

/**
 * Значения текстовых ответов
 * @type helloAdmin: string - Приветствие для админа
 * @type helloUser: string - Приветствие для пользователя
 * @type replyWrong: string - Если админ написал сам себе, уведомляем его
 */
let replyText = {
  helloAdmin: 'Привет админ, ждем сообщения от пользователей',
  helloUser:
    _.get(CUSTOM_STRINGS, 'onStart') || 'Приветствую, отправьте мне сообщение. Постараюсь ответить в ближайшее время.',
  replyWrong: 'Для ответа пользователю используйте функцию Ответить/Reply.',
  bannedMessage: 'Вы заблокированы',
  onEachMessage: _.get(CUSTOM_STRINGS, 'onEachMessage') || '',
};

const allowedUpdateTypes = [
  'photo',
  'text',
  'sticker',
  'document',
  'voice',
  'video',
  'audio',
  'video_note',
  'animation',
];

/**
 * Проверяем пользователя на права
 * @param {number} chatId
 * @returns {boolean}
 */
let isAdminGroup = (chatId) => {
  if (!ADMIN_GROUP_ID || !chatId) {
    console.log('chatId in isAdminGroup', chatId);
    return false;
  }
  return chatId === ADMIN_GROUP_ID || chatId === ADMIN_FAV_GROUP_ID;
};

/**
 * Forward a message to a chat
 *
 * @param {object} ctx Bot context
 * @param {string} chatId A chat id
 * @param {object} message A message to forward
 * @param {MessageForward} [replyToMessageForward] A message forward used to attach "replyToId"
 * @return {Promise<void>}
 */
async function forwardMessage(ctx, chatId, message, replyToMessageForward) {
  let sentMsg;
  if (message.text) {
    sentMsg = await ctx.telegram.sendMessage(chatId, message.text, {
      ..._.pick(message, 'entities'),
      ...(replyToMessageForward ? {reply_to_message_id: replyToMessageForward.toMessageId} : {}),
    });
  } else {
    sentMsg = await ctx.telegram.copyMessage(chatId, message.chat.id, message.message_id, {
      ..._.pick(message, 'caption', 'caption_entities'),
      ...(replyToMessageForward ? {reply_to_message_id: replyToMessageForward.toMessageId} : {}),
    });
  }

  await MessageForward.create({
    fromUserId: ctx.from.id,
    fromChatId: ctx.chat.id,
    toChatId: chatId,
    fromMessageId: ctx.message.message_id,
    toMessageId: sentMsg.message_id,
    ...(replyToMessageForward ? {replyToId: replyToMessageForward.id} : {}),
  });
}

/**
 * Forward a message from context to an admin chat
 *
 * @param {object} ctx Bot context
 * @param {string} adminChatId An admin chat id
 * @param {string} messageHeader A header which should be added to the forwarding message copy
 * @param {MessageForward} [replyToMessageForward] A message forward used to attach "replyToId" to the forwarding
 *  message copy
 * @return {Promise<void>}
 */
async function forwardToAdminChat(ctx, adminChatId, messageHeader, replyToMessageForward) {
  const messageHeaderLength = messageHeader.length + 1;

  const [text1, text2, textSeparator] =
    halveMessage(ctx.message.text, TELEGRAM_MESSAGE_TEXT_LIMIT - messageHeaderLength) || [];
  const [textEntities1, textEntities2] = (text1 && halveMessageEntities(ctx.message.entities, text1.length)) || [];

  const [caption1, caption2, captionSeparator] =
    halveMessage(ctx.message.caption, TELEGRAM_MESSAGE_CAPTION_LIMIT - messageHeaderLength) || [];
  const [captionEntities1, captionEntities2] =
    (caption1 && halveMessageEntities(ctx.message.caption_entities, caption1.length)) || [];

  const shiftEntitiesOffset = (entities, length) =>
    entities &&
    _.map(entities, (entity) => ({
      ...entity,
      offset: entity.offset + length,
    }));

  const messageToSend = {
    ...ctx.message,
    text: text1 && `${messageHeader}\n${text1 || ''}${textSeparator || ''}`,
    caption: caption1 && `${messageHeader}\n${caption1 || ''}${captionSeparator || ''}`,
    ...(ctx.message.entities ? {entities: shiftEntitiesOffset(textEntities1, messageHeaderLength)} : {}),
    ...(ctx.message.caption_entities
      ? {caption_entities: shiftEntitiesOffset(captionEntities1, messageHeaderLength)}
      : {}),
  };
  await forwardMessage(ctx, adminChatId, messageToSend, replyToMessageForward);

  if (text2 || caption2) {
    const message = {
      text: `${messageHeader}\n${text2 || ''}${caption2 || ''}`,
      ...(textEntities2 || captionEntities2
        ? {entities: shiftEntitiesOffset(textEntities2 || captionEntities2, messageHeaderLength)}
        : {}),
    };
    await forwardMessage(ctx, adminChatId, message, replyToMessageForward);
  }
}

/**
 * Forward a message from context to admin chats
 *
 * @param {object} ctx Bot context
 * @param {User} dbUser A db user related to ctx message
 * @param {string} messageHeader A header which should be added to the forwarding message copy
 */
let forwardToAdminChats = async (ctx, dbUser, messageHeader) => {
  const chatId = getChatId(ctx);
  console.log('forwardToAdmin', chatId);

  if (!chatId) {
    console.log(ctx.update);
    return;
  }

  if (isAdminGroup(chatId)) {
    ctx.reply(replyText.replyWrong);
  } else if (ADMIN_GROUP_ID) {
    const adminChatIds = [getAdminChatId(dbUser)];
    if (ADMIN_MIRROR_GROUP_ID) {
      adminChatIds.push(ADMIN_MIRROR_GROUP_ID);
    }

    for (const adminChatId of adminChatIds) {
      let replyToMessageForward = await MessageForward.findOne(
        {
          fromUserId: encryptNumberWithConfigIV(ctx.from.id),
          toChatId: encryptNumberWithConfigIV(adminChatId),
          replyToId: null,
          deleted: {$ne: true},
        },
        null,
        {sort: {created: -1}},
      );

      try {
        await forwardToAdminChat(ctx, adminChatId, messageHeader, replyToMessageForward);
      } catch (e) {
        const errorDescription = _.get(e, 'response.description', '');
        if (!replyToMessageForward || errorDescription.indexOf('replied message not found') < 0) {
          console.log('Err to send message in admin chat', e);
          throw e;
        }

        console.log('admin deleted message', replyToMessageForward.toMessageId);
        await replyToMessageForward.updateOne({deleted: true});

        await forwardToAdminChat(ctx, adminChatId, messageHeader);
      }
    }

    if (replyText.onEachMessage) {
      ctx.reply(replyText.onEachMessage);
    }
  } else {
    console.log('chatId in forwardToAdmin', chatId);
    ctx.telegram.sendMessage(
      MASTER_ADMIN_GROUP_ID,
      `adminGroupId is missing for - Name: ${getBotUsername(ctx)}, Message from chatId: ${chatId}`,
    );
  }
};

export async function botInit(expressApp) {
  if (!isPooling()) {
    console.log('SERVER_URL', SERVER_URL, 'PROXY_PORT', PROXY_PORT);
    const wh = `${SERVER_URL}:${PROXY_PORT}/${WEBHOOK_PATH}`;
    bot.telegram.setWebhook(wh).catch((e) => console.warn('telegram.setWebhook err', e));
    expressApp.use(bot.webhookCallback('/'));
  }

  bot.catch(async (err, ctx) => {
    switch (err.type) {
      case BotErrorTypes.CLIENT: {
        return ctx.reply(err.message);
      }
      case BotErrorTypes.SERVER: {
        await sendToMasterChat(MessageLevels.ERROR, err.message, err.meta);
        break;
      }
      default: {
        await sendToMasterChat(MessageLevels.ERROR, err.message, {
          updateType: ctx.updateType,
          error: serializeError(err),
        });
      }
    }
    if (!err.isSilent) {
      await ctx.reply('❌ Ошибка при обработке запроса. Обратитесь в техподдержку или повторите операцию позже');
    }
  });

  /**
   * Старт бота
   */
  bot.start((ctx) => {
    if (!isAdminGroup(getChatId(ctx))) ctx.reply(replyText.helloUser);
  });

  bot.on('message', async (ctx) => {
    const chatId = getChatId(ctx);
    console.log('DEBUG', 'bot.on("message")', {chatId});

    if (ADMIN_MIRROR_GROUP_ID && chatId === ADMIN_MIRROR_GROUP_ID) {
      return;
    }

    const tgMessage = ctx.message;
    if (tgMessage.group_chat_created) {
      return sendToMasterChat(MessageLevels.WARN, 'A bot was added to a new group chat', {chatId});
    }
    if (tgMessage.migrate_to_chat_id) {
      return sendToMasterChat(MessageLevels.WARN, 'A group chat was migrated to another id', {
        fromChatId: chatId,
        toChatId: ctx.update.message.migrate_to_chat_id,
      });
    }
    if (tgMessage.migrate_from_chat_id) {
      // Ignore as it goes together with "migrate_to_chat_id" type message
      return;
    }

    const isAllowedUpdateType = _.some(allowedUpdateTypes, (updateType) => tgMessage[updateType]);
    if (!isAllowedUpdateType) {
      return sendToMasterChat(MessageLevels.WARN, 'A message with not allowed update type was sent', {
        userId: ctx.message.from.id,
        chatId,
        messageKeys: _.keys(tgMessage),
      });
    }

    if (isAdminGroup(chatId)) {
      if (getReplyToId(ctx) && isReplyToForward(ctx)) {
        const reply = getText(ctx);
        const isInfoRequest = reply.startsWith('/инфо') || reply.startsWith('/info');
        const replyToMessageForward = await getReplyToMessageForward(ctx);
        const userId = replyToMessageForward?.fromUserId;
        const isReplyToBotReq = isReplyToBot(ctx);
        if (isInfoRequest) {
          const chatIds = [chatId, ...(botConfig.ADMIN_MIRROR_GROUP_ID ? [botConfig.ADMIN_MIRROR_GROUP_ID] : [])];
          return sendUserInfo(chatIds, tgMessage.reply_to_message);
        } else if (isReplyToBot(ctx)) {
          if (!replyToMessageForward) {
            return ctx.reply(
              '❌ На это сообщение невозможно ответить так как настройки пользователя несовместимы с предыдущей версией бота. ' +
                'На все новые сообщения от этого пользователя уже можно будет отвечать.',
            );
          }

          const isBanRequest = reply.startsWith('/бан') || reply.startsWith('/ban');
          const isUnBanRequest = reply.startsWith('/отбан') || reply.startsWith('/unban');
          const isFavoriteRequest = reply === '/favorite' || reply === '/избранный';
          const isUnFavoriteRequest = reply === '/unfavorite';
          if (isBanRequest || isUnBanRequest) {
            if (!userId) {
              const botUsername = getBotUsername(ctx);
              const notifyAdminText = `Command failed: ${botUsername}.\nMessage from chatId: ${chatId}.\nCommand: ${reply}`;
              await notifyAdmin({ctx, text: notifyAdminText});
              return ctx.reply('❌ Заблокировать не получилось. Обратитесь в техподдержку');
            } else {
              await User.updateOne(
                {tgUserId: encryptNumberWithConfigIV(userId)},
                {isBanned: !!isBanRequest},
                {upsert: true},
              ).catch((e) => {
                ctx.reply(`${isUnBanRequest ? 'Отменить бан' : 'Банить'} не получилось`);
                console.log('Err in banUser', e);
              });
              const msg = `Пользователь ${isUnBanRequest ? 'раз' : 'за'}блокирован`;
              console.log(msg);
              return ctx.reply(msg);
            }
          } else if (isFavoriteRequest || isUnFavoriteRequest) {
            if (!userId) {
              const botUsername = getBotUsername(ctx);
              const notifyAdminText = `Command failed: ${botUsername}.\nMessage from chatId: ${chatId}.\nCommand: ${reply}`;
              await notifyAdmin({ctx, text: notifyAdminText});
              return ctx.reply('❌ Операция не получилась. Обратитесь в техподдержку');
            } else {
              await User.updateOne(
                {tgUserId: encryptNumberWithConfigIV(userId)},
                {isFavorite: !!isFavoriteRequest},
                {upsert: true},
              ).catch((e) => {
                const botUsername = getBotUsername(ctx);
                const notifyAdminText = `Command failed: ${botUsername}.\nMessage from chatId: ${chatId}.\nCommand: ${reply}`;
                notifyAdmin({ctx, text: notifyAdminText});
                ctx.reply('❌ Операция не получилась. Обратитесь в техподдержку');
                console.log('Err in banUser', e);
              });

              const msg = `Пользователь ${isFavoriteRequest ? 'добавлен в избранные' : 'удален из избранных'}`;
              console.log(msg);
              return ctx.reply(msg);
            }
          } else if (reply && reply.charAt(0) === '/') {
            const botUsername = getBotUsername(ctx);
            const notifyAdminText = `Unknown command: ${botUsername}.\nMessage from chatId: ${chatId}.\nCommand: ${reply}`;
            await notifyAdmin({ctx, text: notifyAdminText});
            return ctx.reply(`Я не знаком с командой ${reply} 🧐`);
          } else {
            const messageCopyInUserChat = await ctx.telegram
              .copyMessage(replyToMessageForward.fromChatId, tgMessage.chat.id, tgMessage.message_id, {
                reply_to_message_id: replyToMessageForward.fromMessageId,
                allow_sending_without_reply: true,
              })
              .catch((e) => {
                console.error(`err forwardBackToUser sendCopy - `, e);
                ctx.reply(`Ошибка: ${e.description || e.message}. user_id ${replyToMessageForward.fromUserId}`);
              });
            console.log('reply to user - ', replyToMessageForward.fromUserId, chatId);

            await MessageForward.create({
              fromChatId: chatId,
              toUserId: replyToMessageForward.fromUserId,
              toChatId: replyToMessageForward.fromChatId,
              fromMessageId: tgMessage.message_id,
              toMessageId: messageCopyInUserChat.message_id,
              replyToId: replyToMessageForward.id,
            });

            if (ADMIN_MIRROR_GROUP_ID) {
              const replyToMessageForwardInMirrorChat = await MessageForward.findOne({
                toChatId: encryptNumberWithConfigIV(ADMIN_MIRROR_GROUP_ID),
                fromMessageId: replyToMessageForward.fromMessageId,
              });

              const messageCopyInMirrorChat = await ctx.telegram
                .copyMessage(ADMIN_MIRROR_GROUP_ID, tgMessage.chat.id, tgMessage.message_id, {
                  reply_to_message_id: replyToMessageForwardInMirrorChat.toMessageId,
                  allow_sending_without_reply: true,
                })
                .catch((e) => {
                  console.error(`err forwardBackToUser sendCopyMirror - `, e);

                  const notifyAdminText =
                    `Error to duplicate an admin message to a user in mirror chat. ` +
                    `Error: ${e.description || e.message}`;
                  notifyAdmin({ctx, text: notifyAdminText});
                });

              await MessageForward.create({
                fromChatId: ADMIN_MIRROR_GROUP_ID,
                toUserId: replyToMessageForward.fromUserId,
                toChatId: replyToMessageForward.fromChatId,
                fromMessageId: messageCopyInMirrorChat.message_id,
                toMessageId: messageCopyInUserChat.message_id,
                replyToId: replyToMessageForwardInMirrorChat.id,
              });
            }
            return;
          }
        }
        if (ADMIN_MIRROR_GROUP_ID) await ctx.forwardMessage(ADMIN_MIRROR_GROUP_ID, ctx.from.id, tgMessage.id);
      }
    } else {
      const message = new TgMessage(ctx, tgMessage);
      if (!message.chat.isPersonal()) {
        return;
      }

      const sender = message.sender;
      if (await sender.isBanned()) {
        return ctx.reply(replyText.bannedMessage);
      }

      await sender.save().catch((e) => console.log('err saving user', e));

      // перенаправляем админу
      const dbUser = await sender.getDbInstance();
      const tgUser = sender.getTgInstance();

      let messageHeader = `${tgUser.first_name || ''} ${tgUser.last_name || ''} @${tgUser.username || ''}\n`;
      if (dbUser) {
        messageHeader = `#${dbUser.maskUid}\n${messageHeader}`;
      }
      await forwardToAdminChats(ctx, dbUser, messageHeader);
    }
  });

  bot.on('edited_message', async (ctx) => {
    const message = ctx.update.edited_message;
    const chatId = message.chat?.id;
    console.log('DEBUG', 'bot.on("edited_message")', {chatId});

    if (!isAdminGroup(chatId)) {
      return;
    }
    if (!message.reply_to_message) {
      return;
    }

    await editForwardedMessage(message);
  });

  // bot.start(async ctx => {});
  if (isPooling()) {
    bot.launch();
  }
}

async function notifyAdmin({ctx, text}) {
  return ctx.telegram.sendMessage(MASTER_ADMIN_GROUP_ID, text);
}

async function getReplyToMessageForward(ctx) {
  const toMessageId = getReplyToMsgId(ctx.message);
  if (!toMessageId) {
    console.error(`No toMessageId in getReplyToMessageForward - ${ctx.message}`);
    return;
  }
  console.log(`toMessageId in getReplyToMessageForward - ${toMessageId}`);
  return MessageForward.findOne({
    toChatId: encryptNumberWithConfigIV(getChatId(ctx)),
    toMessageId,
  });
}

function getForwardFromIdFromMsg(msg) {
  return _.get(msg, 'forward_from.id');
}

function getChatId(ctx) {
  return _.get(ctx.message, 'chat.id');
}

function getReplyToId(ctx) {
  return ctx.message?.reply_to_message?.from?.id;
}

function isReplyToBot(ctx) {
  return getReplyToId(ctx) === getBotId();
}

function isReplyToForward(ctx) {
  return !!_.get(ctx.message, 'reply_to_message');
}

const getUser = (ctx) => {
  return (
    _.get(ctx.update, 'callback_query.from') ||
    _.get(ctx.update, 'message.from') ||
    _.get(ctx.update, 'edited_message.from')
  );
};

const getUserId = (ctx) => {
  return (
    _.get(ctx.update, 'callback_query.from.id') ||
    _.get(ctx.update, 'message.from.id') ||
    _.get(ctx.update, 'edited_message.from.id') + ''
  );
};

export const getText = (ctx) => {
  return _.get(ctx, 'update.message.text') || _.get(ctx, 'update.message.caption') || '';
};

function getAdminChatId(dbUser) {
  return ADMIN_FAV_GROUP_ID && _.get(dbUser, 'isFavorite') ? ADMIN_FAV_GROUP_ID : ADMIN_GROUP_ID;
}

function isPersonalChat(ctx) {
  const chatType = _.get(ctx, 'message.chat.type');
  return chatType === 'private';
}
