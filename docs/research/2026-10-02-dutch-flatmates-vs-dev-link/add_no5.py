# P2 + the rule "no 5 in a circle", as one tiny custom constraint that drops 5 from the 28 circle cells.
import json, copy
COMP = """function getAffectedCells (cells) { return cells }
function setParams (instance, cells) { instance.cells = cells }
function * initialize (instance, puzzle) {
  for (const c of instance.cells) yield puzzle.removeCandidateFromCell(5, c)
}
function validate (instance, puzzle) {
  for (const c of instance.cells) if (puzzle.getValue(c) === 5) return false
  return true
}"""
for code in ("ourcode", "theircode"):
    d = json.load(open(f"p2_{code}.json")); p = d["puzzle"]
    circles = [c for c in p["constraints"] if c["type"] == 306][0]["cells"]
    back = f"puzzle.addConstraintComponent(new NoFiveComponent('no 5 in a circle', {json.dumps(circles)}))"
    p["constraints"].append({"name": "No 5 in circles", "type": 1000, "input": {}, "style": {},
        "definition": {"name": "No 5 in circles", "input": [], "backend": {"type": "code", "code": back},
                       "components": [{"type": "code", "name": "NoFiveComponent", "code": COMP}]}})
    p["comment"] += "\n\n5s do not live in circles."
    json.dump(d, open(f"p2no5_{code}.json", "w"))
print("ok")
