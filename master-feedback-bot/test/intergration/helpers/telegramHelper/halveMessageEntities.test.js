import _ from 'lodash';
import Chance from 'chance';
import {halveMessageEntities} from '../../../../src/helpers/telegramHelper';
import cleanStateBetweenTests from '../../../cleanStateBetweenTests';
import should from 'should';

const chance = new Chance();

describe('Telegram Helper: Halve Message Entities Tests', () => {
  cleanStateBetweenTests();

  it('should return "undefined" when a message entities are "undefined"', async () => {
    should(halveMessageEntities(undefined, chance.natural())).be.undefined();
  });

  it('should return "null" when a message entities are "null"', async () => {
    should(halveMessageEntities(null, chance.natural())).be.null();
  });

  it('should return all messages entities in the left part in case of all styles withing the limit', async () => {
    const messageEntities = chance.n(chance.telegram.messageEntity, 2);
    const limit = _.max(_.map(messageEntities, (entity) => entity.offset + entity.length));

    const [messageEntitiesLeft, messageEntitiesRight] = halveMessageEntities(messageEntities, limit);
    messageEntitiesLeft.should.eql(messageEntities);
    should.not.exist(messageEntitiesRight);
  });

  it('should return all messages entities in the right part in case of all styles out of the limit', async () => {
    const messageEntities = chance.n(chance.telegram.messageEntity, 2, {offset: chance.natural({min: 150, max: 300})});

    const [messageEntitiesLeft, messageEntitiesRight] = halveMessageEntities(messageEntities, 100);
    should.not.exist(messageEntitiesLeft);
    messageEntitiesRight.should.eql(_.map(messageEntities, (entity) => ({...entity, offset: entity.offset - 100})));
  });

  it('should split messages entities between parts', async () => {
    const messageEntities = [
      chance.telegram.messageEntity({offset: chance.natural({min: 101, max: 200})}),
      chance.telegram.messageEntity({offset: chance.natural({max: 50}), length: chance.natural({max: 50})}),
    ];

    const [messageEntitiesLeft, messageEntitiesRight] = halveMessageEntities(messageEntities, 100);
    messageEntitiesLeft.should.eql([_.last(messageEntities)]);
    messageEntitiesRight.should.eql([{..._.first(messageEntities), offset: _.first(messageEntities).offset - 100}]);
  });

  it('should split single messages entity between parts', async () => {
    const messageEntity = chance.telegram.messageEntity({offset: 50, length: 75});

    const [messageEntitiesLeft, messageEntitiesRight] = halveMessageEntities([messageEntity], 100);
    messageEntitiesLeft.should.eql([{...messageEntity, offset: 50, length: 50}]);
    messageEntitiesRight.should.eql([{...messageEntity, offset: 0, length: 25}]);
  });
});
