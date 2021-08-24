import Chance from 'chance';
import {botConfig} from 'config';
import request from 'supertest';
import nock from 'nock';
import sinon from 'sinon';
import {app} from '../../../../server';
import {MessageForward, User} from '../../../../src/db';
import cleanStateBetweenTests from '../../../cleanStateBetweenTests';
import _ from 'lodash';
import {encryptNumberWithConfigIV} from '../../../../src/helpers/cryptoHelper';
import {getBotId} from '../../../../src/services/botService';

const chance = new Chance();

describe('Telegram Service: Forward Admin Messages Tests', () => {
  cleanStateBetweenTests();

  let messageByChatId = {};
  let simpleUser;
  let favUser;
  let simpleUserMessage;
  let simpleUserMessageInAdminChat;
  let simpleUserMessageInMirrorChat;
  let favUserMessage;
  let favUserMessageInAdminChat;
  let favUserMessageInMirrorChat;
  let sendMessageStub;
  let copyMessageStub;

  beforeEach('delete existing data', async () => {
    messageByChatId = {};
    await MessageForward.deleteMany();
    await User.deleteMany();
    nock.cleanAll();
  });

  beforeEach('create users', async () => {
    simpleUser = await User.create(chance.db.user());
    favUser = await User.create(chance.db.user({isFavorite: true}));
  });

  beforeEach('generate a simple user message', () => {
    simpleUserMessage = chance.telegram.message({from: {id: simpleUser.tgUserId}});

    simpleUserMessageInAdminChat = chance.telegram.message({
      from: {id: getBotId()},
      chat: {id: botConfig.ADMIN_GROUP_ID},
    });
    simpleUserMessageInMirrorChat = chance.telegram.message({
      from: {id: getBotId()},
      chat: {id: botConfig.ADMIN_MIRROR_GROUP_ID},
    });
  });

  beforeEach('generate a favorite user message', () => {
    favUserMessage = chance.telegram.message({from: {id: favUser.tgUserId}});

    favUserMessageInAdminChat = chance.telegram.message({
      from: {id: getBotId()},
      chat: {id: botConfig.ADMIN_FAV_GROUP_ID},
    });
    favUserMessageInMirrorChat = chance.telegram.message({
      from: {id: getBotId()},
      chat: {id: botConfig.ADMIN_MIRROR_GROUP_ID},
    });
  });

  beforeEach('send a simple user message', async () => {
    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/sendMessage')
      .times(1)
      .reply(200, chance.telegram.httpResponse({result: simpleUserMessageInAdminChat}));

    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/sendMessage')
      .times(1)
      .reply(200, chance.telegram.httpResponse({result: simpleUserMessageInMirrorChat}));

    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({message: simpleUserMessage}));
    res.status.should.eql(200);
  });

  beforeEach('send a favorite user message', async () => {
    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/sendMessage')
      .times(1)
      .reply(200, chance.telegram.httpResponse({result: favUserMessageInAdminChat}));

    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/sendMessage')
      .times(1)
      .reply(200, chance.telegram.httpResponse({result: favUserMessageInMirrorChat}));

    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({message: favUserMessage}));
    res.status.should.eql(200);
  });

  beforeEach('stub telegram services', () => {
    sendMessageStub = sinon.stub();
    copyMessageStub = sinon.stub();

    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/sendMessage')
      .reply((uri, body) => {
        messageByChatId[body.chat_id] = chance.telegram.message();
        sendMessageStub(body);
        return [200, chance.telegram.httpResponse({result: messageByChatId[body.chat_id]})];
      })
      .persist();
    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/copyMessage')
      .reply((uri, body) => {
        messageByChatId[body.chat_id] = chance.telegram.message();
        copyMessageStub(body);
        return [200, chance.telegram.httpResponse({result: messageByChatId[body.chat_id]})];
      })
      .persist();
  });

  beforeEach('reset stubs history', () => {
    sinon.resetHistory();
  });

  it('should forward to a user the messages sent to simple admin chat', async () => {
    const newMessage = chance.telegram.message({
      chat: {
        id: botConfig.ADMIN_GROUP_ID,
      },
      reply_to_message: simpleUserMessageInAdminChat,
    });

    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({message: newMessage}));
    res.status.should.eql(200);

    sinon.assert.notCalled(sendMessageStub);
    sinon.assert.calledTwice(copyMessageStub);

    sinon.assert.calledWith(copyMessageStub, {
      'chat_id': simpleUserMessage.chat.id,
      'from_chat_id': newMessage.chat.id,
      'message_id': newMessage.message_id,
      'reply_to_message_id': simpleUserMessage.message_id,
      'allow_sending_without_reply': true,
    });
    sinon.assert.calledWith(copyMessageStub, {
      'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
      'from_chat_id': newMessage.chat.id,
      'message_id': newMessage.message_id,
      'reply_to_message_id': simpleUserMessageInMirrorChat.message_id,
      'allow_sending_without_reply': true,
    });
  });

  it('should forward to a user the messages sent to favorite admin chat', async () => {
    const newMessage = chance.telegram.message({
      chat: {
        id: botConfig.ADMIN_FAV_GROUP_ID,
      },
      reply_to_message: favUserMessageInAdminChat,
    });

    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({message: newMessage}));
    res.status.should.eql(200);

    sinon.assert.notCalled(sendMessageStub);
    sinon.assert.calledTwice(copyMessageStub);

    sinon.assert.calledWith(copyMessageStub, {
      'chat_id': favUserMessage.chat.id,
      'from_chat_id': newMessage.chat.id,
      'message_id': newMessage.message_id,
      'reply_to_message_id': favUserMessage.message_id,
      'allow_sending_without_reply': true,
    });
    sinon.assert.calledWith(copyMessageStub, {
      'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
      'from_chat_id': newMessage.chat.id,
      'message_id': newMessage.message_id,
      'reply_to_message_id': favUserMessageInMirrorChat.message_id,
      'allow_sending_without_reply': true,
    });
  });

  it('should forward to a user the messages with styles in text', async () => {
    const newMessage = chance.telegram.message({
      chat: {
        id: botConfig.ADMIN_GROUP_ID,
      },
      text: 'bo🏝ld italic underline strikethrough code www.google.com',
      entities: [
        {offset: 0, length: 6, type: 'bold'},
        {offset: 7, length: 6, type: 'italic'},
        {offset: 14, length: 9, type: 'underline'},
        {offset: 24, length: 13, type: 'strikethrough'},
        {offset: 38, length: 4, type: 'code'},
        {offset: 43, length: 14, type: 'link'},
      ],
      reply_to_message: simpleUserMessageInAdminChat,
    });

    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({message: newMessage}));
    res.status.should.eql(200);

    sinon.assert.notCalled(sendMessageStub);
    sinon.assert.calledTwice(copyMessageStub);

    sinon.assert.calledWith(copyMessageStub, {
      'chat_id': simpleUserMessage.chat.id,
      'from_chat_id': newMessage.chat.id,
      'message_id': newMessage.message_id,
      'reply_to_message_id': simpleUserMessage.message_id,
      'allow_sending_without_reply': true,
    });
    sinon.assert.calledWith(copyMessageStub, {
      'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
      'from_chat_id': newMessage.chat.id,
      'message_id': newMessage.message_id,
      'reply_to_message_id': simpleUserMessageInMirrorChat.message_id,
      'allow_sending_without_reply': true,
    });
  });

  it('should forward to a user the messages with styles in caption', async () => {
    const newMessage = chance.telegram.message({
      chat: {
        id: botConfig.ADMIN_GROUP_ID,
      },
      photo: [chance.telegram.photoSize()],
      caption: 'bo🏝ld italic underline strikethrough code www.google.com',
      caption_entities: [
        {offset: 0, length: 6, type: 'bold'},
        {offset: 7, length: 6, type: 'italic'},
        {offset: 14, length: 9, type: 'underline'},
        {offset: 24, length: 13, type: 'strikethrough'},
        {offset: 38, length: 4, type: 'code'},
        {offset: 43, length: 14, type: 'link'},
      ],
      reply_to_message: simpleUserMessageInAdminChat,
    });
    delete newMessage.text;

    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({message: newMessage}));
    res.status.should.eql(200);

    sinon.assert.notCalled(sendMessageStub);
    sinon.assert.calledTwice(copyMessageStub);

    sinon.assert.calledWith(copyMessageStub, {
      'chat_id': simpleUserMessage.chat.id,
      'from_chat_id': newMessage.chat.id,
      'message_id': newMessage.message_id,
      'reply_to_message_id': simpleUserMessage.message_id,
      'allow_sending_without_reply': true,
    });
    sinon.assert.calledWith(copyMessageStub, {
      'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
      'from_chat_id': newMessage.chat.id,
      'message_id': newMessage.message_id,
      'reply_to_message_id': simpleUserMessageInMirrorChat.message_id,
      'allow_sending_without_reply': true,
    });
  });

  it('should store admin chats to user messages mapping', async () => {
    const newMessage = chance.telegram.message({
      chat: {
        id: botConfig.ADMIN_GROUP_ID,
      },
      reply_to_message: simpleUserMessageInAdminChat,
    });

    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({message: newMessage}));
    res.status.should.eql(200);

    const dbMessageForwardsFromUser = await MessageForward.find({
      fromUserId: encryptNumberWithConfigIV(simpleUser.tgUserId),
    });
    const userMessageForwardByToChatId = _.keyBy(dbMessageForwardsFromUser, 'toChatId');

    const dbMessageForwardsToUser = await MessageForward.find({
      toMessageId: messageByChatId[simpleUserMessage.chat.id].message_id,
    });
    dbMessageForwardsToUser.should.have.lengthOf(2);

    dbMessageForwardsToUser[0].toObject().should.eql({
      ..._.pick(dbMessageForwardsToUser[0], '_id', '__v', 'created'),
      fromChatId: encryptNumberWithConfigIV(botConfig.ADMIN_GROUP_ID),
      fromMessageId: newMessage.message_id,
      toUserId: encryptNumberWithConfigIV(simpleUserMessage.from.id),
      toChatId: encryptNumberWithConfigIV(simpleUserMessage.chat.id),
      toMessageId: messageByChatId[simpleUserMessage.chat.id].message_id,
      replyToId: userMessageForwardByToChatId[botConfig.ADMIN_GROUP_ID]._id,
    });
    dbMessageForwardsToUser[1].toObject().should.eql({
      ..._.pick(dbMessageForwardsToUser[1], '_id', '__v', 'created'),
      fromChatId: encryptNumberWithConfigIV(botConfig.ADMIN_MIRROR_GROUP_ID),
      fromMessageId: messageByChatId[botConfig.ADMIN_MIRROR_GROUP_ID].message_id,
      toUserId: encryptNumberWithConfigIV(simpleUserMessage.from.id),
      toChatId: encryptNumberWithConfigIV(simpleUserMessage.chat.id),
      toMessageId: messageByChatId[simpleUserMessage.chat.id].message_id,
      replyToId: userMessageForwardByToChatId[botConfig.ADMIN_MIRROR_GROUP_ID]._id,
    });
  });

  it('should return an error when target message mapping does NOT exist', async () => {
    await MessageForward.deleteOne({
      toChatId: encryptNumberWithConfigIV(botConfig.ADMIN_GROUP_ID),
      toMessageId: simpleUserMessageInAdminChat.message_id,
    });

    const newMessage = chance.telegram.message({
      chat: {
        id: botConfig.ADMIN_GROUP_ID,
      },
      reply_to_message: simpleUserMessageInAdminChat,
    });

    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({message: newMessage}));
    res.status.should.eql(200);

    sinon.assert.calledOnce(sendMessageStub);
    sinon.assert.notCalled(copyMessageStub);

    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': botConfig.ADMIN_GROUP_ID,
      'text':
        '❌ На это сообщение невозможно ответить так как настройки пользователя несовместимы с предыдущей ' +
        'версией бота. На все новые сообщения от этого пользователя уже можно будет отвечать.',
    });
  });
});
