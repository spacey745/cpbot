import _ from 'lodash';
import {
  decryptNumber,
  decryptText,
  encryptNumber,
  encryptNumberWithConfigIV,
  encryptText,
  encryptTextWithConfigIV,
} from '../../helpers/cryptoHelper';

export const encryptedText = {
  type: {
    content: String,
    iv: String,
  },
  get: decryptText,
  set: (value) => (!_.isPlainObject(value) ? encryptText(_.toString(value)) : value),
};

export const encryptedTextWithFixedIV = {
  type: {
    content: String,
    iv: String,
  },
  get: decryptText,
  set: (value) => (!_.isPlainObject(value) ? encryptTextWithConfigIV(_.toString(value)) : value),
};

export const encryptedNumber = {
  type: {
    content: String,
    iv: String,
  },
  get: decryptNumber,
  set: (value) => (!_.isPlainObject(value) ? encryptNumber(value) : value),
};

export const encryptedNumberWithFixedIV = {
  type: {
    content: String,
    iv: String,
  },
  get: decryptNumber,
  set: (value) => (!_.isPlainObject(value) ? encryptNumberWithConfigIV(value) : value),
};
