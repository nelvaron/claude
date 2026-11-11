import { chance } from './chance.js';
import { economy } from './economy.js';
import { exactness } from './exactness.js';
import { flight } from './flight.js';
import { harmony } from './harmony.js';
import { ink } from './ink.js';
import { translation } from './translation.js';

/**
 * Every proof the page can run, by the name a proposition asks for it with.
 * @type {Record<string, import('../stage/stage.js').ProofFactory>}
 */
export const PROOFS = { exactness, ink, chance, harmony, translation, flight, economy };
