import Chance from 'chance';
import request from 'supertest';
import sinon from 'sinon';
import {serializeError} from 'serialize-error';
import {app} from '../../../../server';
import cleanStateBetweenTests from '../../../cleanStateBetweenTests';
import * as messageService from '../../../../src/services/messageService';
import nock from 'nock';
import {botConfig} from 'config';
import {clientError, serverError} from '../../../../src/utils/botErrors';

const {MessageLevels} = messageService;
const chance = new Chance();

describe('Telegram Service: Bot Error Event Tests', () => {
  cleanStateBetweenTests();

  let sendMessageStub;

  before('stub telegram requests', () => {
    sendMessageStub = sinon.stub();

    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/sendMessage')
      .reply((uri, body) => {
        sendMessageStub(body);
        return [200, chance.telegram.httpResponse({result: chance.telegram.message()})];
      })
      .persist();
  });

  before('stub message service', () => {
    sinon.stub(messageService, 'sendToMasterChat').resolves();
  });

  beforeEach('reset stubs history', () => {
    sinon.resetHistory();
  });

  it('should notify the both master and user chats in case of a general error', async () => {
    const error = new Error(chance.sentence());
    messageService.sendToMasterChat.withArgs(MessageLevels.WARN).throws(error);

    const message = chance.telegram.message({
      group_chat_created: true,
    });
    delete message.text;

    const res = await request(app).post('/').send(chance.telegram.update({message}));
    res.status.should.eql(200);

    sinon.assert.calledOnce(messageService.sendToMasterChat.withArgs(MessageLevels.ERROR));
    sinon.assert.calledWith(messageService.sendToMasterChat, MessageLevels.ERROR, error.message, {
      updateType: 'message',
      error: serializeError(error),
    });

    sinon.assert.calledOnceWithExactly(sendMessageStub, {
      'chat_id': message.chat.id,
      'text': '❌ Ошибка при обработке запроса. Обратитесь в техподдержку или повторите операцию позже',
    });
  });

  it('should notify the both master and user chats in case of a server error', async () => {
    const text = chance.sentence();
    const meta = {[chance.word()]: chance.word()};
    const error = serverError(text, meta);
    messageService.sendToMasterChat.withArgs(MessageLevels.WARN).throws(error);

    const message = chance.telegram.message({
      group_chat_created: true,
    });
    delete message.text;

    const res = await request(app).post('/').send(chance.telegram.update({message}));
    res.status.should.eql(200);

    sinon.assert.calledOnce(messageService.sendToMasterChat.withArgs(MessageLevels.ERROR));
    sinon.assert.calledWith(messageService.sendToMasterChat, MessageLevels.ERROR, error.message, error.meta);

    sinon.assert.calledOnceWithExactly(sendMessageStub, {
      'chat_id': message.chat.id,
      'text': '❌ Ошибка при обработке запроса. Обратитесь в техподдержку или повторите операцию позже',
    });
  });

  it('should notify only the master chat in case of a silent server error', async () => {
    const text = chance.sentence();
    const meta = {[chance.word()]: chance.word()};
    const error = serverError(text, meta, true);
    messageService.sendToMasterChat.withArgs(MessageLevels.WARN).throws(error);

    const message = chance.telegram.message({
      group_chat_created: true,
    });
    delete message.text;

    const res = await request(app).post('/').send(chance.telegram.update({message}));
    res.status.should.eql(200);

    sinon.assert.calledOnce(messageService.sendToMasterChat.withArgs(MessageLevels.ERROR));
    sinon.assert.calledWith(messageService.sendToMasterChat, MessageLevels.ERROR, error.message, error.meta);
    sinon.assert.notCalled(sendMessageStub);
  });

  it('should notify only the user chat in case of a client error', async () => {
    const text = chance.sentence();
    const error = clientError(text);
    messageService.sendToMasterChat.withArgs(MessageLevels.WARN).throws(error);

    const message = chance.telegram.message({
      group_chat_created: true,
    });
    delete message.text;

    const res = await request(app).post('/').send(chance.telegram.update({message}));
    res.status.should.eql(200);

    sinon.assert.neverCalledWith(messageService.sendToMasterChat, MessageLevels.ERROR);
    sinon.assert.calledOnceWithExactly(sendMessageStub, {
      'chat_id': message.chat.id,
      'text': text,
    });
  });
});
