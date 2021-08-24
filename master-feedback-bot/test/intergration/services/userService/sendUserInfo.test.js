import Chance from 'chance';
import cleanStateBetweenTests from '../../../cleanStateBetweenTests';
import {sendUserInfo} from '../../../../src/services/userService';
import sinon from 'sinon';
import nock from 'nock';
import {botConfig} from 'config';
import {MessageForward, User} from '../../../../src/db';

const chance = new Chance();

describe('User Service: Send User Info Tests', () => {
  cleanStateBetweenTests();

  let sendMessageStub;

  before('stub telegram services', () => {
    sendMessageStub = sinon.stub();

    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/sendMessage')
      .reply((uri, body) => {
        sendMessageStub(body);
        return [200, chance.telegram.httpResponse({result: chance.telegram.message()})];
      })
      .persist();
  });

  beforeEach('reset stubs history', () => {
    sinon.resetHistory();
  });

  it('should require "chatIds"', async () => {
    await sendUserInfo(undefined, chance.telegram.message()).should.be.rejectedWith('The "chatIds" is required');
  });

  it('should require "message"', async () => {
    await sendUserInfo(chance.natural(), undefined).should.be.rejectedWith('The "message" is required');
  });

  it('should require "message.message_id"', async () => {
    await sendUserInfo(chance.natural(), {}).should.be.rejectedWith('The "message.message_id" is required');
  });

  it('should require "message.chat"', async () => {
    await sendUserInfo(chance.natural(), {message_id: chance.natural()}).should.be.rejectedWith(
      'The "message.chat" is required',
    );
  });

  it('should require "message.from"', async () => {
    await sendUserInfo(chance.natural(), {
      message_id: chance.natural(),
      chat: chance.telegram.chat(),
    }).should.be.rejectedWith('The "message.from" is required');
  });

  it('should send only an empty profile when a user is empty', async () => {
    const chatId = chance.natural();
    const message = chance.telegram.message();
    message.from = {};

    await sendUserInfo([chatId], message);

    const profileText =
      `Имя: [нет_имени] [нет_фамилии]\n` +
      `Начальное имя: [нет_имени] [нет_фамилии]\n` +
      `Текущий ник: [нет_ника]\n` +
      `Первый ник: [нет_ника]`;
    sinon.assert.calledOnceWithExactly(sendMessageStub, {
      'chat_id': chatId,
      'text': profileText,
    });
  });

  it('should send an empty profile and a user id when only user id is provided', async () => {
    const chatId = chance.natural();
    const message = chance.telegram.message();
    message.from = {id: chance.natural()};

    await sendUserInfo([chatId], message);

    sinon.assert.calledTwice(sendMessageStub);

    const profileText =
      `Имя: [нет_имени] [нет_фамилии]\n` +
      `Начальное имя: [нет_имени] [нет_фамилии]\n` +
      `Текущий ник: [нет_ника]\n` +
      `Первый ник: [нет_ника]`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': profileText,
    });

    const userIdText = `🆔: [${message.from.id}](tg://user?id=${message.from.id})`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': userIdText,
      'parse_mode': 'MarkdownV2',
    });
  });

  it('should send a profile without initial data and a user id when full user info is provided', async () => {
    const chatId = chance.natural();
    const message = chance.telegram.message();

    await sendUserInfo([chatId], message);

    sinon.assert.calledTwice(sendMessageStub);

    const profileText =
      `Имя: [${message.from.first_name}] [${message.from.last_name}]\n` +
      `Начальное имя: [нет_имени] [нет_фамилии]\n` +
      `Текущий ник: [@${message.from.username}]\n` +
      `Первый ник: [нет_ника]`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': profileText,
    });

    const userIdText = `🆔: [${message.from.id}](tg://user?id=${message.from.id})`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': userIdText,
      'parse_mode': 'MarkdownV2',
    });
  });

  it('should send the user and chat information when a message is forwarded from another chat', async () => {
    const chatId = chance.natural();
    const message = chance.telegram.message({
      forward_from: chance.telegram.user(),
      forward_from_chat: chance.telegram.chat(),
    });

    await sendUserInfo([chatId], message);

    sinon.assert.calledTwice(sendMessageStub);

    const profileText =
      `Имя: [${message.forward_from.first_name}] [${message.forward_from.last_name}]\n` +
      `Начальное имя: [нет_имени] [нет_фамилии]\n` +
      `Текущий ник: [@${message.forward_from.username}]\n` +
      `Первый ник: [нет_ника]\n` +
      `Чат: [🆔${message.forward_from_chat.id}], [@${message.forward_from_chat.username}], [${message.forward_from_chat.title}]`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': profileText,
    });

    const userIdText = `🆔: [${message.forward_from.id}](tg://user?id=${message.forward_from.id})`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': userIdText,
      'parse_mode': 'MarkdownV2',
    });
  });

  it('should send the user and chat information when a message is forwarded from another chat with empty data', async () => {
    const chatId = chance.natural();
    const message = chance.telegram.message({
      forward_from: chance.telegram.user(),
      forward_from_chat: {},
    });

    await sendUserInfo([chatId], message);

    sinon.assert.calledTwice(sendMessageStub);

    const profileText =
      `Имя: [${message.forward_from.first_name}] [${message.forward_from.last_name}]\n` +
      `Начальное имя: [нет_имени] [нет_фамилии]\n` +
      `Текущий ник: [@${message.forward_from.username}]\n` +
      `Первый ник: [нет_ника]\n` +
      `Чат: [нет_идентификатора], [нет_ника], [нет_заголовка]`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': profileText,
    });

    const userIdText = `🆔: [${message.forward_from.id}](tg://user?id=${message.forward_from.id})`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': userIdText,
      'parse_mode': 'MarkdownV2',
    });
  });

  it('should send full information when the user exists in the database', async () => {
    const chatId = chance.natural();
    const message = chance.telegram.message();
    const dbUser = await User.create(chance.db.user({tgUserId: message.from.id}));

    await sendUserInfo([chatId], message);

    sinon.assert.calledTwice(sendMessageStub);

    const profileText =
      `Имя: [${dbUser.firstName}] [${dbUser.lastName}]\n` +
      `Начальное имя: [${dbUser.initFirstName}] [${dbUser.initLastName}]\n` +
      `Текущий ник: [@${dbUser.username}]\n` +
      `Первый ник: [@${dbUser.firstUsername}]`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': profileText,
    });

    const userIdText = `🆔: [${message.from.id}](tg://user?id=${message.from.id})`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': userIdText,
      'parse_mode': 'MarkdownV2',
    });
  });

  it('should take data from telegram user when the user exists in the database without data', async () => {
    const chatId = chance.natural();
    const message = chance.telegram.message();
    await User.create({tgUserId: message.from.id});

    await sendUserInfo([chatId], message);

    sinon.assert.calledTwice(sendMessageStub);

    const profileText =
      `Имя: [${message.from.first_name}] [${message.from.last_name}]\n` +
      `Начальное имя: [нет_имени] [нет_фамилии]\n` +
      `Текущий ник: [@${message.from.username}]\n` +
      `Первый ник: [нет_ника]`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': profileText,
    });

    const userIdText = `🆔: [${message.from.id}](tg://user?id=${message.from.id})`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': userIdText,
      'parse_mode': 'MarkdownV2',
    });
  });

  it('should send full information for a message forwarded by the bot', async () => {
    const chatId = chance.natural();
    const message = chance.telegram.message();

    const messageForward = await MessageForward.create(
      chance.db.messageForward({
        toChatId: message.chat.id,
        toMessageId: message.message_id,
      }),
    );
    const dbUser = await User.create(
      chance.db.user({
        tgUserId: messageForward.fromUserId,
      }),
    );

    await sendUserInfo([chatId], message);

    sinon.assert.calledTwice(sendMessageStub);

    const profileText =
      `Имя: [${dbUser.firstName}] [${dbUser.lastName}]\n` +
      `Начальное имя: [${dbUser.initFirstName}] [${dbUser.initLastName}]\n` +
      `Текущий ник: [@${dbUser.username}]\n` +
      `Первый ник: [@${dbUser.firstUsername}]`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': profileText,
    });

    const userIdText = `🆔: [${dbUser.tgUserId}](tg://user?id=${dbUser.tgUserId})`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': userIdText,
      'parse_mode': 'MarkdownV2',
    });
  });

  it('should take data from database only when a user message is forwarded by the bot', async () => {
    const chatId = chance.natural();
    const message = chance.telegram.message();

    const messageForward = await MessageForward.create(
      chance.db.messageForward({
        toChatId: message.chat.id,
        toMessageId: message.message_id,
      }),
    );
    const dbUser = await User.create({
      tgUserId: messageForward.fromUserId,
    });

    await sendUserInfo([chatId], message);

    sinon.assert.calledTwice(sendMessageStub);

    const profileText =
      `Имя: [нет_имени] [нет_фамилии]\n` +
      `Начальное имя: [нет_имени] [нет_фамилии]\n` +
      `Текущий ник: [нет_ника]\n` +
      `Первый ник: [нет_ника]`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': profileText,
    });

    const userIdText = `🆔: [${dbUser.tgUserId}](tg://user?id=${dbUser.tgUserId})`;
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': chatId,
      'text': userIdText,
      'parse_mode': 'MarkdownV2',
    });
  });

  it('should send user info in several chats', async () => {
    const chatIds = chance.n(chance.natural, 3);
    const message = chance.telegram.message();

    await sendUserInfo(chatIds, message);

    sinon.assert.callCount(sendMessageStub, chatIds.length * 2);

    for (const chatId of chatIds) {
      const profileText =
        `Имя: [${message.from.first_name}] [${message.from.last_name}]\n` +
        `Начальное имя: [нет_имени] [нет_фамилии]\n` +
        `Текущий ник: [@${message.from.username}]\n` +
        `Первый ник: [нет_ника]`;
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': chatId,
        'text': profileText,
      });

      const userIdText = `🆔: [${message.from.id}](tg://user?id=${message.from.id})`;
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': chatId,
        'text': userIdText,
        'parse_mode': 'MarkdownV2',
      });
    }
  });
});
