// `just soundness` runs the file of this name in every example, so this one
// runs both components' fuzzes and ends on one verdict.

import { finishHarness } from '../_shared/harness-lib.mjs'
import { countDigitsSoundness } from './count-digits-soundness.mjs'
import { requiredDigitsSoundness } from './required-digits-soundness.mjs'

const failures = countDigitsSoundness() + requiredDigitsSoundness()
console.log(failures === 0 ? 'no soundness violations' : `${failures} failures`)
finishHarness(failures === 0)
