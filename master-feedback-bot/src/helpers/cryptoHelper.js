import _ from 'lodash';
import crypto from 'crypto';
import {botConfig} from 'config';

const {CRYPT_KEY, IV} = botConfig;
const algorithm = 'aes-256-ctr';
const randomIV = crypto.randomBytes(16).toString('hex');

if (!IV) {
  throw new Error('The "IV" is required config property');
}

/**
 * Encrypt a text with the IV from config
 *
 * @param {string} text A text to encrypt
 * @return {{iv: string, content: string}} An encrypted value
 */
export const encryptTextWithConfigIV = (text) => {
  return encryptText(text, IV);
};

/**
 * Encrypt a number with the IV from config
 *
 * @param {number} num A number to encrypt
 * @return {{iv: string, content: string}} An encrypted value
 */
export const encryptNumberWithConfigIV = (num) => {
  return encryptNumber(num, IV);
};

/**
 * Encrypt a number
 *
 * @param {number} num A number to encrypt
 * @param {string} [iv] An encryption initialization vector
 * @return {{iv: string, content: string}} An encrypted value
 */
export const encryptNumber = (num, iv) => {
  return encryptText(_.toString(num), iv);
};

/**
 * Encrypt a text
 *
 * @param {string} text A text to encrypt
 * @param {string} [iv] An encryption initialization vector
 * @return {{iv: string, content: string}} An encrypted value
 */
export const encryptText = (text, iv = randomIV) => {
  if (!text) return text;
  const cipher = crypto.createCipheriv(algorithm, CRYPT_KEY, Buffer.from(iv, 'hex'));
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return {
    iv,
    content: encrypted.toString('hex'),
  };
};

/**
 * Decrypt a number
 *
 * @param {{iv: string, content: string}} hash An encrypted value
 * @return {number} A decrypted number
 */
export const decryptNumber = (hash) => {
  if (!hash) return hash;
  return Number.parseFloat(decryptText(hash));
};

/**
 * Decrypt a text
 *
 * @param {{iv: string, content: string}} hash An encrypted value
 * @return {string} A decrypted text
 */
export const decryptText = (hash) => {
  if (!hash) return hash;
  const decipher = crypto.createDecipheriv(algorithm, CRYPT_KEY, Buffer.from(hash.iv, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]);
  return decrypted.toString();
};
