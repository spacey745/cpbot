import _ from 'lodash';
import Chance from 'chance';
import {botConfig} from 'config';
import nock from 'nock';
import sinon from 'sinon';
import cleanStateBetweenTests from '../../../cleanStateBetweenTests';
import {editForwardedMessage} from '../../../../src/services/messageService';
import {MessageForward} from '../../../../src/db';
import {BotErrorTypes} from '../../../../src/utils/botErrors';

const chance = new Chance();
const {ADMIN_GROUP_ID, ADMIN_FAV_GROUP_ID, ADMIN_MIRROR_GROUP_ID} = botConfig;

describe('Message Service: Edit Forwarded Message Tests', () => {
  cleanStateBetweenTests();

  let editMessageTextStub;
  let editMessageCaptionStub;

  before('stub telegram services', () => {
    editMessageTextStub = sinon.stub();
    editMessageCaptionStub = sinon.stub();

    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/editMessageText')
      .reply((uri, body) => {
        editMessageTextStub(body);
        return [200, chance.telegram.httpResponse({result: chance.telegram.message()})];
      })
      .persist();

    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/editMessageCaption')
      .reply((uri, body) => {
        editMessageCaptionStub(body);
        return [200, chance.telegram.httpResponse({result: chance.telegram.message()})];
      })
      .persist();
  });

  before('create a message forward to have some noise in db', async () => {
    await MessageForward.create(chance.db.messageForward());
  });

  beforeEach('reset stubs history', () => {
    sinon.resetHistory();
  });

  it('should require "message"', async () => {
    await editForwardedMessage(undefined).should.be.rejectedWith('The "message" is required');
  });

  it('should notify master admin when a message is edited not from an admin chat', async () => {
    const message = chance.telegram.message();
    await editForwardedMessage(message).should.be.rejectedWith({
      type: BotErrorTypes.SERVER,
      message: 'Unsupported logic. Can not edit messages from a not admin chats',
      meta: {chatId: message.chat.id},
    });

    sinon.assert.notCalled(editMessageTextStub);
    sinon.assert.notCalled(editMessageCaptionStub);
  });

  it('should no effect when no message forwards created based on the provided message', async () => {
    const chatId = chance.pickone([ADMIN_GROUP_ID, ADMIN_FAV_GROUP_ID]);
    const message = chance.telegram.message({chat: {id: chatId}});

    await editForwardedMessage(message);

    sinon.assert.notCalled(editMessageTextStub);
    sinon.assert.notCalled(editMessageCaptionStub);
  });

  it('should no effect when a message forward with the same message id but a different chat exists', async () => {
    const chatId = chance.pickone([ADMIN_GROUP_ID, ADMIN_FAV_GROUP_ID]);
    const message = chance.telegram.message({chat: {id: chatId}});
    await MessageForward.create(
      chance.db.messageForward({fromChatId: Number.parseInt(chatId) + 1, fromMessageId: message.message_id}),
    );

    await editForwardedMessage(message);

    sinon.assert.notCalled(editMessageTextStub);
    sinon.assert.notCalled(editMessageCaptionStub);
  });

  it('should no effect when a message forward with the same chat id but a different message exists', async () => {
    const chatId = chance.pickone([ADMIN_GROUP_ID, ADMIN_FAV_GROUP_ID]);
    const message = chance.telegram.message({chat: {id: chatId}});
    await MessageForward.create(chance.db.messageForward({fromChatId: chatId, fromMessageId: message.message_id + 1}));

    await editForwardedMessage(message);

    sinon.assert.notCalled(editMessageTextStub);
    sinon.assert.notCalled(editMessageCaptionStub);
  });

  it('should edit forwarded message text', async () => {
    const chatId = chance.pickone([ADMIN_GROUP_ID, ADMIN_FAV_GROUP_ID]);
    const message = chance.telegram.message({chat: {id: chatId}});

    const adminMessageForward = await MessageForward.create(
      chance.db.messageForward({
        fromChatId: chatId,
        fromMessageId: message.message_id,
      }),
    );
    const mirrorMessageForward = await MessageForward.create(
      chance.db.messageForward({
        fromChatId: ADMIN_MIRROR_GROUP_ID,
        toChatId: adminMessageForward.toChatId,
        toMessageId: adminMessageForward.toMessageId,
      }),
    );

    await editForwardedMessage(message);

    sinon.assert.calledTwice(editMessageTextStub);
    sinon.assert.notCalled(editMessageCaptionStub);

    sinon.assert.calledWith(editMessageTextStub, {
      chat_id: adminMessageForward.toChatId,
      message_id: adminMessageForward.toMessageId,
      text: message.text,
    });
    sinon.assert.calledWith(editMessageTextStub, {
      chat_id: mirrorMessageForward.fromChatId,
      message_id: mirrorMessageForward.fromMessageId,
      text: message.text,
    });
  });

  it('should edit forwarded message caption', async () => {
    const chatId = chance.pickone([ADMIN_GROUP_ID, ADMIN_FAV_GROUP_ID]);
    const message = chance.telegram.message({
      chat: {id: chatId},
      caption: chance.sentence(),
    });
    delete message.text;

    const adminMessageForward = await MessageForward.create(
      chance.db.messageForward({
        fromChatId: chatId,
        fromMessageId: message.message_id,
      }),
    );
    const mirrorMessageForward = await MessageForward.create(
      chance.db.messageForward({
        fromChatId: ADMIN_MIRROR_GROUP_ID,
        toChatId: adminMessageForward.toChatId,
        toMessageId: adminMessageForward.toMessageId,
      }),
    );

    await editForwardedMessage(message);

    sinon.assert.notCalled(editMessageTextStub);
    sinon.assert.calledTwice(editMessageCaptionStub);

    sinon.assert.calledWith(editMessageCaptionStub, {
      chat_id: adminMessageForward.toChatId,
      message_id: adminMessageForward.toMessageId,
      caption: message.caption,
    });
    sinon.assert.calledWith(editMessageCaptionStub, {
      chat_id: mirrorMessageForward.fromChatId,
      message_id: mirrorMessageForward.fromMessageId,
      caption: message.caption,
    });
  });

  it('should edit forwarded message text with styles', async () => {
    const chatId = chance.pickone([ADMIN_GROUP_ID, ADMIN_FAV_GROUP_ID]);
    const message = chance.telegram.message({
      chat: {id: chatId},
      text: 'bo🏝ld italic underline strikethrough code www.google.com',
      entities: [
        {offset: 0, length: 6, type: 'bold'},
        {offset: 7, length: 6, type: 'italic'},
        {offset: 14, length: 9, type: 'underline'},
        {offset: 24, length: 13, type: 'strikethrough'},
        {offset: 38, length: 4, type: 'code'},
        {offset: 43, length: 14, type: 'link'},
      ],
    });

    const adminMessageForward = await MessageForward.create(
      chance.db.messageForward({
        fromChatId: chatId,
        fromMessageId: message.message_id,
      }),
    );
    const mirrorMessageForward = await MessageForward.create(
      chance.db.messageForward({
        fromChatId: ADMIN_MIRROR_GROUP_ID,
        toChatId: adminMessageForward.toChatId,
        toMessageId: adminMessageForward.toMessageId,
      }),
    );

    await editForwardedMessage(message);

    sinon.assert.calledTwice(editMessageTextStub);
    sinon.assert.notCalled(editMessageCaptionStub);

    sinon.assert.calledWith(editMessageTextStub, {
      chat_id: adminMessageForward.toChatId,
      message_id: adminMessageForward.toMessageId,
      text: message.text,
      entities: message.entities,
    });
    sinon.assert.calledWith(editMessageTextStub, {
      chat_id: mirrorMessageForward.fromChatId,
      message_id: mirrorMessageForward.fromMessageId,
      text: message.text,
      entities: message.entities,
    });
  });

  it('should edit forwarded message caption with styles', async () => {
    const chatId = chance.pickone([ADMIN_GROUP_ID, ADMIN_FAV_GROUP_ID]);
    const message = chance.telegram.message({
      chat: {id: chatId},
      caption: 'bo🏝ld italic underline strikethrough code www.google.com',
      caption_entities: [
        {offset: 0, length: 6, type: 'bold'},
        {offset: 7, length: 6, type: 'italic'},
        {offset: 14, length: 9, type: 'underline'},
        {offset: 24, length: 13, type: 'strikethrough'},
        {offset: 38, length: 4, type: 'code'},
        {offset: 43, length: 14, type: 'link'},
      ],
    });
    delete message.text;

    const adminMessageForward = await MessageForward.create(
      chance.db.messageForward({
        fromChatId: chatId,
        fromMessageId: message.message_id,
      }),
    );
    const mirrorMessageForward = await MessageForward.create(
      chance.db.messageForward({
        fromChatId: ADMIN_MIRROR_GROUP_ID,
        toChatId: adminMessageForward.toChatId,
        toMessageId: adminMessageForward.toMessageId,
      }),
    );

    await editForwardedMessage(message);

    sinon.assert.notCalled(editMessageTextStub);
    sinon.assert.calledTwice(editMessageCaptionStub);

    sinon.assert.calledWith(editMessageCaptionStub, {
      chat_id: adminMessageForward.toChatId,
      message_id: adminMessageForward.toMessageId,
      caption: message.caption,
      caption_entities: message.caption_entities,
    });
    sinon.assert.calledWith(editMessageCaptionStub, {
      chat_id: mirrorMessageForward.fromChatId,
      message_id: mirrorMessageForward.fromMessageId,
      caption: message.caption,
      caption_entities: message.caption_entities,
    });
  });

  it('should notify master admin when an edited message was separated by two during forward', async () => {
    const fromChatId = chance.pickone([ADMIN_GROUP_ID, ADMIN_FAV_GROUP_ID]);
    const toChatId = chance.natural();

    const message = chance.telegram.message({
      chat: {id: fromChatId},
      caption: chance.sentence(),
    });
    delete message.text;

    await Promise.all(
      _.times(2, () =>
        MessageForward.create(
          chance.db.messageForward({
            fromChatId: fromChatId,
            fromMessageId: message.message_id,
            toChatId,
          }),
        ),
      ),
    );

    await editForwardedMessage(message).should.be.rejectedWith({
      type: BotErrorTypes.SERVER,
      message: 'Unsupported logic. Can not edit messages split to several parts',
      meta: {fromChatId, fromMessageId: message.message_id},
    });

    sinon.assert.notCalled(editMessageTextStub);
    sinon.assert.notCalled(editMessageCaptionStub);
  });
});
