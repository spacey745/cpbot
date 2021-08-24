export const nextPushId = (function () {
  // Modeled after base64 web-safe chars, but ordered by ASCII.
  let PUSH_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  // Timestamp of last push, used to prevent local collisions if you push twice
  // in one ms.
  let lastPushTime = 0;
  // We generate 72-bits of randomness which get turned into 12 characters and
  // appended to the timestamp to prevent collisions with other clients. We
  // store the last characters we generated because in the event of a collision,
  // we'll use those same characters except "incremented" by one.
  let lastRandChars = [];
  return function () {
    let now = Date.now();
    let duplicateTime = now === lastPushTime;
    lastPushTime = now;
    let i;
    let timeStampChars = new Array(8);
    for (i = 7; i >= 0; i--) {
      timeStampChars[i] = PUSH_CHARS.charAt(now % 62);
      // NOTE: Can't use << here because javascript will convert to int and lose
      // the upper bits.
      now = Math.floor(now / 64);
    }
    if (now !== 0) throw new Error('Cannot push at time == 0');
    let id = timeStampChars.join('');
    if (!duplicateTime) {
      for (i = 0; i < 12; i++) {
        lastRandChars[i] = Math.floor(Math.random() * 62);
      }
    } else {
      // If the timestamp hasn't changed since last push, use the same random
      // number, except incremented by 1.
      for (i = 11; i >= 0 && lastRandChars[i] === 61; i--) {
        lastRandChars[i] = 0;
      }
      lastRandChars[i]++;
    }
    for (i = 0; i < 12; i++) {
      id += PUSH_CHARS.charAt(lastRandChars[i]);
    }
    if (id.length !== 20) throw new Error('nextPushId: Length should be 20.');
    return id;
  };
})();
