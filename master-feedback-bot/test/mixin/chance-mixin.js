import _ from 'lodash';
import Chance from 'chance';

const chance = new Chance();
chance.mixin({
  db: {
    /**
     * Generate a random db message forward
     *
     * @param [prototype] A prototype to make overwrites
     * @return {object} A message forward instance
     */
    messageForward: function (prototype) {
      return _.merge(
        {
          fromUserId: chance.natural(),
          fromChatId: chance.natural(),
          toChatId: chance.natural(),
          fromMessageId: chance.natural(),
          toMessageId: chance.natural(),
        },
        prototype,
      );
    },

    /**
     * Generate a random db user
     *
     * @param [prototype] A prototype to make overwrites
     * @return {object} A user instance
     */
    user: function (prototype) {
      return _.merge(
        {
          tgUserId: chance.natural(),
          firstUsername: chance.word(),
          username: chance.word(),
          initFirstName: chance.first(),
          firstName: chance.first(),
          initLastName: chance.last(),
          lastName: chance.last(),
          langCode: 'en',
        },
        prototype,
      );
    },
  },

  telegram: {
    /**
     * Generate a random telegram chat
     *
     * @param [prototype] A prototype to make overwrites
     * @return {object} A chat instance
     */
    chat: function (prototype) {
      return _.merge(
        {
          'id': chance.natural(),
          'first_name': chance.first(),
          'last_name': chance.last(),
          'username': chance.string({alpha: true}),
          'title': chance.word(),
          'type': 'private',
        },
        prototype,
      );
    },

    /**
     * Generate a random telegram HTTP response
     *
     * @param [prototype] A prototype to make overwrites
     * @return {object} An HTTP response
     */
    httpResponse: function (prototype) {
      return _.merge(
        {
          'ok': true,
          'result': {},
        },
        prototype,
      );
    },

    /**
     * Generate a random telegram message
     *
     * @param [prototype] A prototype to make overwrites
     * @return {object} A message instance
     */
    message: function (prototype) {
      return _.merge(
        {
          'message_id': chance.natural(),
          'from': chance.telegram.user(),
          'chat': chance.telegram.chat(),
          'date': chance.date().getTime(),
          'text': chance.sentence(),
        },
        prototype,
      );
    },

    /**
     * Generate a random telegram message entity
     *
     * @param [prototype] A prototype to make overwrites
     * @return {object} A message entity instance
     */
    messageEntity: function (prototype) {
      return _.merge(
        {
          'type': chance.pickone(['url', 'email', 'bold', 'italic', 'underline', 'strikethrough']),
          'offset': chance.natural({max: 100}),
          'length': chance.natural({max: 10}),
        },
        prototype,
      );
    },

    /**
     * Generate a random telegram photo size
     *
     * @param [prototype] A prototype to make overwrites
     * @return {object} A photo size instance
     */
    photoSize: function (prototype) {
      return _.merge(
        {
          'file_id': chance.guid(),
          'file_unique_id': chance.guid(),
          'width': chance.natural({min: 1, max: 4096}),
          'height': chance.natural({min: 1, max: 4096}),
          'file_size': chance.natural(),
        },
        prototype,
      );
    },

    /**
     * Generate a random telegram user
     *
     * @param [prototype] A prototype to make overwrites
     * @return {object} A user instance
     */
    update: function (prototype) {
      return _.merge(
        {
          'update_id': chance.natural(),
        },
        prototype,
      );
    },

    /**
     * Generate a random telegram user
     *
     * @param [prototype] A prototype to make overwrites
     * @return {object} A user instance
     */
    user: function (prototype) {
      return _.merge(
        {
          'id': chance.natural(),
          'is_bot': false,
          'first_name': chance.first(),
          'last_name': chance.last(),
          'username': chance.string({alpha: true}),
          'language_code': 'en',
        },
        prototype,
      );
    },
  },
});
