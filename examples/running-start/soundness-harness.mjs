import { readFileSync } from 'fs'
const sol = JSON.parse(readFileSync('fresh_sol.json','utf8'))
const src = readFileSync('RunningStartComponent.js','utf8')
globalThis.SudokuDigitSet = { from:(a)=>({__set:new Set(a),[Symbol.iterator](){return this.__set[Symbol.iterator]()}}) }
globalThis.helpers = { digits:{minDigit:1,maxDigit:9} }
const mod = eval('(function(){'+src+'\n return {setParams,update,validate,runningStart};})()')

function rs(vals){let n=1;for(let i=1;i<vals.length;i++){if(vals[i]>vals[i-1])n++;else break;}return n;}

// full grid: interior indices + clue values are all in sol.val (solution). true clue value:
function trueVal(c){ return sol.val[c] }

function makePuzzle(filledSet){
  // filledSet: Set of cell indices that hold their true value; others full candidates
  const cand = new Map()
  return {
    hasValue:c=> filledSet.has(c),
    getValue:c=> sol.val[c],
    getCandidates:c=>{ if(filledSet.has(c)) return new Set([sol.val[c]]); if(!cand.has(c)) cand.set(c,new Set([1,2,3,4,5,6,7,8,9])); return cand.get(c) },
    getCellsAreFilled:cs=>cs.every(c=>filledSet.has(c)),
    removeCandidatesFromCell:(s,c)=>{ const cur=this?null:null; const set = filledSet.has(c)? new Set([sol.val[c]]) : (cand.has(c)?cand.get(c):(cand.set(c,new Set([1,2,3,4,5,6,7,8,9])),cand.get(c))); for(const d of s) set.delete(d) },
    _cand:cand
  }
}

let rng=12345; function rnd(){ rng=(rng*1103515245+12345)&0x7fffffff; return rng/0x7fffffff }

let violations=0, tests=0
for (let iter=0; iter<20000; iter++){
  const [clue,line] = sol.groups[iter % sol.groups.length]
  const all=[clue,...line]
  // random subset filled (to true values)
  const filled=new Set()
  for(const c of all) if(rnd()<rnd()) filled.add(c) // varied density
  const p=makePuzzle(filled)
  const inst={}; mod.setParams(inst,clue,line)
  for(const _ of mod.update(inst,p)){}
  tests++
  // soundness: every cell must still allow its TRUE value
  for(const c of all){
    const cd = p.getCandidates(c)
    if(!cd.has(trueVal(c))){ violations++; if(violations<=8) console.log("VIOLATION iter",iter,"cell",c,"lost true",trueVal(c),"clue",clue,"filled",[...filled]); break }
  }
}
console.log("random partial-state tests:",tests,"soundness violations:",violations)
