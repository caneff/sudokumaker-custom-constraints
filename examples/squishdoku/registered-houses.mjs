// The houses a squishdoku backend registers, read by running the backend the
// way the app does (backend-runner.mjs) with HouseComponent recorded, never
// run. Prints them as JSON, `[{ "name": ..., "cells": [...] }, ...]`, for the
// CP-SAT proofs in squish_board.py.
//
//   node examples/squishdoku/registered-houses.mjs <backend.js>
import fs from 'node:fs'
import { runBackend } from '../_shared/backend-runner.mjs'

const [file] = process.argv.slice(2)
const houses = []
const puzzle = {
  addConstraintComponent: house => houses.push({ name: house.args[0], cells: house.args[1] })
}
const { ctorNames } = runBackend(fs.readFileSync(file, 'utf8'), { puzzle })
if (ctorNames.join() !== 'HouseComponent') {
  throw new Error(`${file} registers ${ctorNames.join()}, not HouseComponent alone`)
}
console.log(JSON.stringify(houses))
