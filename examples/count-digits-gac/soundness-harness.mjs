// The soundness fuzz for this example's two components, CountDigitsGacComponent
// and RequiredDigitsGacComponent. Each has its own file for its state
// generator and oracle; this one runs them both and ends on one verdict, so
// `just soundness` (which runs the file of this name in every example) covers
// both.
//
//   node examples/count-digits-gac/soundness-harness.mjs

import { finishHarness } from '../_shared/harness-lib.mjs'
import { countDigitsSoundness } from './count-digits-soundness.mjs'
import { requiredDigitsSoundness } from './required-digits-soundness.mjs'

const failures = countDigitsSoundness() + requiredDigitsSoundness()
console.log(failures === 0 ? 'no soundness violations' : `${failures} failures`)
finishHarness(failures === 0)
