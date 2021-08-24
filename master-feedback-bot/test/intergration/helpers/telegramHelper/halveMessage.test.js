import _ from 'lodash';
import Chance from 'chance';
import {halveMessage} from '../../../../src/helpers/telegramHelper';
import cleanStateBetweenTests from '../../../cleanStateBetweenTests';
import should from 'should';

const chance = new Chance();

describe('Telegram Helper: Halve Message Tests', () => {
  cleanStateBetweenTests();

  it('should return "undefined" when a message is "undefined"', async () => {
    should(halveMessage(undefined, chance.natural())).be.undefined();
  });

  it('should return "null" when a message is "null"', async () => {
    should(halveMessage(null, chance.natural())).be.null();
  });

  it('should return an error when a message impossible to halve', async () => {
    const message = chance.sentence();
    halveMessage.bind(message, message.length / 2 - 1).should.throw();
  });

  it('should NOT split a message in case of the message is less or equal limits', async () => {
    const message = chance.sentence();
    halveMessage(message, message.length).should.eql([message]);
  });

  it('should NOT split a message based on characters number instead of message length', async () => {
    const message = chance.sentence();
    const messageWithEmojis = `🏝${message}🏝`;
    halveMessage(messageWithEmojis, message.length + 2).should.eql([messageWithEmojis]);
  });

  it('should halve a string of characters', async () => {
    const message = chance.string({length: 50});

    const messageParts = halveMessage(message, message.length - 1);
    messageParts.should.have.lengthOf(3);
    `${messageParts[0]}${messageParts[1]}`.should.eql(message);
    messageParts[2].should.eql('...');
    messageParts[0].length.should.be.within(message.length / 3, (message.length / 3) * 2);
  });

  it('should halve a string of emojis', async () => {
    const charsCount = 50;
    const message = _.repeat('🏝', charsCount);

    const messageParts = halveMessage(message, charsCount - 1);
    messageParts.should.have.lengthOf(3);
    `${messageParts[0]}${messageParts[1]}`.should.eql(message);
    messageParts[2].should.eql('...');
    messageParts[0].length.should.be.within(message.length / 3, (message.length / 3) * 2);
  });

  it('should halve a sentence splitting between words', async () => {
    const message = chance.sentence({words: 10});

    const messageParts = halveMessage(message, message.length - 1);
    messageParts.should.have.lengthOf(3);
    `${messageParts[0]} ${messageParts[1]}`.should.eql(message);
    messageParts[2].should.eql('...');
    messageParts[0].length.should.be.within(message.length / 3, (message.length / 3) * 2);
  });

  it('should halve an emoji sentence splitting between words', async () => {
    const message = alphaToEmoji(chance.sentence({words: 10}));
    const charsCount = [...message].length;

    const messageParts = halveMessage(message, charsCount - 1);
    messageParts.should.have.lengthOf(3);
    `${messageParts[0]} ${messageParts[1]}`.should.eql(message);
    messageParts[2].should.eql('...');
    [...messageParts[0]].length.should.be.within(charsCount / 3, (charsCount / 3) * 2);
  });

  it('should halve a paragraph splitting between sentences', async () => {
    const message = _.join(chance.n(chance.sentence, 10), ' ');

    const messageParts = halveMessage(message, message.length - 1);
    messageParts.should.have.lengthOf(2);
    messageParts[0].should.endWith('.');
    `${messageParts[0]} ${messageParts[1]}`.should.eql(message);
    messageParts[0].length.should.be.within(message.length / 3, (message.length / 3) * 2);
  });

  it('should halve an emoji paragraph splitting between sentences', async () => {
    const message = alphaToEmoji(_.join(chance.n(chance.sentence, 10), ' '));
    const charsCount = [...message].length;

    const messageParts = halveMessage(message, charsCount - 1);
    messageParts.should.have.lengthOf(2);
    messageParts[0].should.endWith('.');
    `${messageParts[0]} ${messageParts[1]}`.should.eql(message);
    [...messageParts[0]].length.should.be.within(charsCount / 3, (charsCount / 3) * 2);
  });

  it('should halve a text splitting between new lines', async () => {
    const message = _.join(chance.n(chance.paragraph, 10), '\n');

    const messageParts = halveMessage(message, message.length - 1);
    messageParts.should.have.lengthOf(2);
    `${messageParts[0]}\n${messageParts[1]}`.should.eql(message);
    messageParts[0].length.should.be.within(message.length / 3, (message.length / 3) * 2);
  });

  it('should halve an emoji text splitting between new lines', async () => {
    const message = alphaToEmoji(_.join(chance.n(chance.paragraph, 10), '\n'));
    const charsCount = [...message].length;

    const messageParts = halveMessage(message, charsCount - 1);
    messageParts.should.have.lengthOf(2);
    `${messageParts[0]}\n${messageParts[1]}`.should.eql(message);
    [...messageParts[0]].length.should.be.within(charsCount / 3, (charsCount / 3) * 2);
  });

  /**
   * Replace all alpha chars in a string to emojis
   *
   * @param {string} str A string
   * @return {string} A string with emojis instead of chars
   */
  function alphaToEmoji(str) {
    return _.reduce(str, (result, char) => (!['.', ' ', '\n'].includes(char) ? `${result}🏝` : `${result}${char}`), '');
  }
});
