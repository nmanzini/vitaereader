/**
 * Structural catalog for Parallel Lives (Clough / Gutenberg #674).
 * Culture is derived from this catalog — do not maintain a parallel map.
 */

/** @typedef {{ slug: string, title: string, greek: string[], roman: string[], comparison?: string }} PairSpec */
/** @typedef {{ slug: string, culture: 'greek' | 'roman' }} UnpairedSpec */

/** @type {PairSpec[]} */
export const PAIR_CATALOG = [
  {
    slug: 'theseus-romulus',
    title: 'Theseus & Romulus',
    greek: ['theseus'],
    roman: ['romulus'],
    comparison: 'comparison-of-romulus-with-theseus',
  },
  {
    slug: 'lycurgus-numa',
    title: 'Lycurgus & Numa',
    greek: ['lycurgus'],
    roman: ['numa-pompilius'],
    comparison: 'comparison-of-numa-with-lycurgus',
  },
  {
    slug: 'solon-poplicola',
    title: 'Solon & Poplicola',
    greek: ['solon'],
    roman: ['poplicola'],
    comparison: 'comparison-of-poplicola-with-solon',
  },
  {
    slug: 'themistocles-camillus',
    title: 'Themistocles & Camillus',
    greek: ['themistocles'],
    roman: ['camillus'],
  },
  {
    slug: 'pericles-fabius',
    title: 'Pericles & Fabius',
    greek: ['pericles'],
    roman: ['fabius'],
    comparison: 'comparison-of-pericles-with-fabius',
  },
  {
    slug: 'alcibiades-coriolanus',
    title: 'Alcibiades & Coriolanus',
    greek: ['alcibiades'],
    roman: ['coriolanus'],
    comparison: 'comparison-of-alcibiades-with-coriolanus',
  },
  {
    slug: 'timoleon-aemilius',
    title: 'Timoleon & Aemilius Paulus',
    greek: ['timoleon'],
    roman: ['aemilius-paulus'],
    comparison: 'comparison-of-timoleon-with-aemilius-paulus',
  },
  {
    slug: 'pelopidas-marcellus',
    title: 'Pelopidas & Marcellus',
    greek: ['pelopidas'],
    roman: ['marcellus'],
    comparison: 'comparison-of-pelopidas-with-marcellus',
  },
  {
    slug: 'aristides-marcus-cato',
    title: 'Aristides & Marcus Cato',
    greek: ['aristides'],
    roman: ['marcus-cato'],
    comparison: 'comparison-of-aristides-with-marcus-cato',
  },
  {
    slug: 'philopoemen-flamininus',
    title: 'Philopoemen & Flamininus',
    greek: ['philopoemen'],
    roman: ['flamininus'],
    comparison: 'comparison-of-philopoemen-with-flamininus',
  },
  {
    slug: 'pyrrhus-caius-marius',
    title: 'Pyrrhus & Caius Marius',
    greek: ['pyrrhus'],
    roman: ['caius-marius'],
  },
  {
    slug: 'lysander-sylla',
    title: 'Lysander & Sylla',
    greek: ['lysander'],
    roman: ['sylla'],
    comparison: 'comparison-of-lysander-with-sylla',
  },
  {
    slug: 'cimon-lucullus',
    title: 'Cimon & Lucullus',
    greek: ['cimon'],
    roman: ['lucullus'],
    comparison: 'comparison-of-lucullus-with-cimon',
  },
  {
    slug: 'nicias-crassus',
    title: 'Nicias & Crassus',
    greek: ['nicias'],
    roman: ['crassus'],
    comparison: 'comparison-of-crassus-with-nicias',
  },
  {
    slug: 'sertorius-eumenes',
    title: 'Sertorius & Eumenes',
    greek: ['eumenes'],
    roman: ['sertorius'],
    comparison: 'comparison-of-sertorius-with-eumenes',
  },
  {
    slug: 'agesilaus-pompey',
    title: 'Agesilaus & Pompey',
    greek: ['agesilaus'],
    roman: ['pompey'],
    comparison: 'comparison-of-pompey-and-agesilaus',
  },
  {
    slug: 'alexander-caesar',
    title: 'Alexander & Caesar',
    greek: ['alexander'],
    roman: ['caesar'],
  },
  {
    slug: 'phocion-cato-younger',
    title: 'Phocion & Cato the Younger',
    greek: ['phocion'],
    roman: ['cato-the-younger'],
  },
  {
    slug: 'agis-gracchi',
    title: 'Agis & Cleomenes with the Gracchi',
    greek: ['agis', 'cleomenes'],
    roman: ['tiberius-gracchus', 'caius-gracchus'],
    comparison:
      'comparison-of-tiberius-and-caius-gracchus-with-agis-and-cleomenes',
  },
  {
    slug: 'demosthenes-cicero',
    title: 'Demosthenes & Cicero',
    greek: ['demosthenes'],
    roman: ['cicero'],
    comparison: 'comparison-of-demosthenes-and-cicero',
  },
  {
    slug: 'demetrius-antony',
    title: 'Demetrius & Antony',
    greek: ['demetrius'],
    roman: ['antony'],
    comparison: 'comparison-of-demetrius-and-antony',
  },
  {
    slug: 'dion-marcus-brutus',
    title: 'Dion & Marcus Brutus',
    greek: ['dion'],
    roman: ['marcus-brutus'],
    comparison: 'comparison-of-dion-and-brutus',
  },
]

/** @type {UnpairedSpec[]} */
export const UNPAIRED = [
  { slug: 'aratus', culture: 'greek' },
  { slug: 'artaxerxes', culture: 'greek' },
  { slug: 'galba', culture: 'roman' },
  { slug: 'otho', culture: 'roman' },
]

/** @returns {Record<string, 'greek' | 'roman'>} */
export function buildLifeCulture() {
  /** @type {Record<string, 'greek' | 'roman'>} */
  const map = {}
  for (const pair of PAIR_CATALOG) {
    for (const id of pair.greek) map[id] = 'greek'
    for (const id of pair.roman) map[id] = 'roman'
  }
  for (const work of UNPAIRED) map[work.slug] = work.culture
  return map
}
