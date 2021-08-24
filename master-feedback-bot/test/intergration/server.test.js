import request from 'supertest';
import {app} from '../../server';
import cleanStateBetweenTests from '../cleanStateBetweenTests';

describe('Server Tests', () => {
  cleanStateBetweenTests();

  it('should be alive on health check', async () => {
    const res = await request(app).get('/alive');
    res.status.should.eql(200);
    res.text.should.eql('Alive');
  });
});
