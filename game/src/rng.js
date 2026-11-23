// Seeded randomness for Miaw 21. The game needs two kinds of luck: live play,
// which is seeded from the clock, and the deterministic screenshot scenes,
// which must deal the exact same cards every time they load. Both go through
// the same tiny generator so a scene and a self-test can share one code path.

/** mulberry32: a small, fast, well-distributed 32-bit PRNG. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small RNG toolkit built on one mulberry32 stream. */
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    /** A float in [0, 1). */
    next,
    /** An integer in [0, n). */
    int(n) {
      return Math.floor(next() * n);
    },
    /** Pick one element of an array, uniformly. */
    pick(array) {
      return array[Math.floor(next() * array.length)];
    },
    /** An integer in [min, max] inclusive. */
    range(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** Fisher-Yates shuffle, in place, returning the same array. */
    shuffle(array) {
      for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
      }
      return array;
    },
  };
}

/** A seed for live play: clock bits mixed with Math.random bits. */
export function liveSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
