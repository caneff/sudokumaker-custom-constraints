# Pencil-puzzle genre survey: shading, loops/paths, region-building

**Date:** 2026-09-14
**Question:** Across the three big families of pencil puzzle genres found online —
shading puzzles, path/loop-drawing puzzles, and region-building puzzles — what are
the exact rules of each genre, which of them make good Sudoku hybrids, and which
hybrids have actually been built and published?

**Why this repo cares:** every genre here is a candidate for a **CP-SAT model** — an
OR-Tools generator plus uniqueness checker in Python, in the style this repo already
runs for fillomino (`examples/fillomino/generate.py`,
`docs/research/fillomino-cpsat.md`), Renbanana (`docs/research/renbanana_cpsat.py`)
and Zombo Brainanas (`docs/research/zombo_brainanas_cpsat.py`). Each genre adds a
decision layer — shaded / unshaded, loop edges, region ids — over the 81 digit
variables, and the question this survey answers for each is: what variables does the
model need, which globals are expensive and how would this repo encode them, what does
that cost on a 9x9, and does the digit layer couple to it as linear or reified
constraints without blowing up. Section 6 collects the reusable encoding devices;
section 7 ranks the genres by what they are worth to build.

## Sources consulted

| Source | URL | Role |
| --- | --- | --- |
| puzz.link rules list | https://puzz.link/rules.html | Canonical short rules, ~150 genres, one page |
| Logic Masters Deutschland wiki | https://wiki.logic-masters.de/ | German canonical rules per genre |
| LMD puzzle portal | https://logic-masters.de/Raetselportal/ | Published puzzles incl. hybrids, searchable by genre |
| GM Puzzles (Thomas Snyder) | https://www.gmpuzzles.com/blog/rules/ | Rules index per genre, championship-grade phrasing |
| Nikoli | https://www.nikoli.co.jp/en/puzzles/ | Original-publisher rules for Nikoli-owned genres |
| Puzzle Square JP | https://puzsq.logicpuzzle.app/ | Genre index, Japanese community |
| GAPP Puzzles | https://gapp-puzzles.com/ | Genre/rules index |
| Cracking The Cryptic | https://www.youtube.com/@CrackingTheCryptic | Hybrid evidence (video puzzles) |
| WPF Sudoku GP booklets | https://gp.worldpuzzle.org/ | Official hybrid variant rules |
| SudokuMaker constraint list | https://sudokumaker.app/ | What this repo can already express |

**Method note:** rules were read from the primary source named inline on each
genre. Where a page could not be fetched, the genre entry says so and falls back
to the next source in the list above. Claims not confirmed at a primary source in
this run are marked `[unverified]`.

## Complete genre index

**This index is the point of the document as much as the verdicts are.** The three
families below are where the modelling analysis went, but the corpus is an idea bank
and nothing was dropped from it: every genre encountered in this run has a row here,
including the ones rated Poor, the ones outside the three families, and the ones whose
rules were never read. A row says where to find more — a full entry's section number,
or "overflow" for a genre that appears only in a section's closing table or only here.

It is split by **source**, because the sources differ in what they could give. Table A
is the puzz.link corpus, where rules were actually read for every genre. Table B is the
Logic Masters Deutschland Puzzlewiki's English category minus everything already in
table A — real genres, mostly with rules not read in this run. Table C is what came
from GM Puzzles, the WPC unofficial wiki and the setter sources. Splitting by source
keeps the provenance of each rule core visible; a merged table would hide which rows
are read and which are names only.

Families are named as: **shading** (a per-cell colour decision), **loop** (a loop or
path, including the connecting-line genres), **region** (a partition into regions),
**placement** (objects placed into cells), **number** (a digit per cell), **other**
(anything else — moving pieces, bridges, drawing genres), and **not classified** where
the rules were not read and the name alone does not settle it. Where a rule core says
**not read**, no rules were read at a primary source in this run and none is guessed.

### A. The puzz.link corpus — 244 genres, rules read for every one

Rule cores are condensed from `https://puzz.link/js/pzpr-samples/<id>.js`, the data
file behind puzz.link's rules page, and truncated where long. Aliases give the puzz.link
id, the Japanese name, and any alias the engine records.

| Genre | Aliases | Family | Rule core (from the cited puzz.link rules file) | Entry | CP-SAT verdict |
| --- | --- | --- | --- | --- | --- |
| Aho-ni-Narikire | `aho`, アホになり切れ | region | Draw lines over the dotted lines to divide the board into several blocks. 1. Each block contains exactly one black circle. 2. A number indicates the size of the block, in cells. 3. If the number of cells in... | overflow | unrated |
| Akari | `akari`, 美術館, Light Up, Bijutsukan | placement | Place a lightbulb in some cells so all cells are lit. Bulbs light in straight lines until a black cell or the grid edge. Bulbs may not light each other. A digit in a black cell counts the bulbs orthogonally adjacent to it. (LMD wiki; puzz.link ships no parseable rules string for `akari`.) | 1.26 | Workable / cheap |
| Akichiwake | `akichi`, Akichiwake | shading | You're given a board divided into rooms. Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. A number indicates the size of the largest group of connected unshade... | overflow | unrated |
| All or Nothing | `nothing`, オールｏｒナッシング | loop | Draw lines through orthogonally adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. If a country is visited by the loop, it must visit all cells. 3. Countries cannot be visited m... | 2.29 | unrated |
| Alternation | `alter`, オルタネーション | placement | Place a triangle, square or circle in some of the cells. 1. Each outlined region contains exactly one of each possible symbol. 2. Every row and column contains exactly 2 kinds of symbol, which appear in alte... | overflow | unrated |
| Amibo | `amibo`, あみぼー | other | Draw 1 or 2 orthogonal lines in some of the cells, connecting two opposite edges and going through the center. 1. Cells with circles can not contain lines. 2. Every circle must connect to exactly one line. 3... | overflow | unrated |
| Angle Loop | `angleloop`, 鋭直鈍ループ | loop | Draw lines between every symbol to form a loop. 1. Lines go straight from symbol to symbol, and can be drawn at any angle. 2. The loop can not branch off or intersect. Symbols must be visited exactly once. 3... | overflow | unrated |
| Anglers | `anglers`, フィッシング | loop | Draw lines so each person (represented by a number) is connected to a fish. 1. Lines cannot branch off or cross. A number or fish can not have more than one line. 2. A number shows the length of the connecte... | 2.29 | Workable / cheap |
| Ant Mill | `antmill`, Ant Mill | loop | Shade some dominoes on the board to form a loop. 1. Two dominoes may not be orthogonally adjacent. 2. Every domino is diagonally adjacent to exactly two other dominoes. 3. All dominoes form a diagonally conn... | overflow | unrated |
| Aqre | `aqre`, Aqre | shading | Shade some cells on the board. 1. Numbered regions must contain the indicated amount of shaded cells. 2. There may not be a horizontal or vertical run of 4 or more consecutive shaded or unshaded cells. 3. Al... | 1.22 | Good / moderate |
| Aquapelago | `aquapelago`, Aquapelago | shading | Shade some cells on the board. Some shaded cells may be given. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. The unshaded cells cannot form a 2x2 square. 3. A number indicates the amount... | 1.23 | Workable / heavy |
| Aquarium | `aquarium`, アクアプレース | shading | The grid represents an aquarium viewed from the side, which must be partially filled with water. 1. The numbers around the grid indicate the number of shaded cells in that row/column. 2. All shaded cells mus... | 1.34 | Workable / cheap |
| Araf | `araf`, 相ダ部屋 | region | Draw lines over the dotted lines to divide the board into several blocks. 1. Each block contains exactly two numbers. 2. The size of the block must be between the two numbers, exclusive. 3. Question marks ca... | 3.3 | Good / moderate |
| Army Ants | `armyants`, ぐんたいあり | other | Draw lines to move some of the numbers. 1. Movement lines cannot cross or overlap each other. Lines can also not go through the start- or endpoint of other numbers. 2. Numbers must form sequences starting at... | overflow | unrated |
| Arukone | `arukone`, アルコネ | loop | Draw paths going through the cells to connect identical letters. 1. Two paths cannot occupy the same cell. 2. All cells must be used by a path connecting two letters. | 2.20 | Poor / heavy |
| Ayeheya | `ayeheya`, ∀人∃ＨＥＹＡ | shading | You're given a board divided into rooms. Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. A number indicates the amount of shaded cells in a region. 3. The sha... | overflow | unrated |
| Balance Loop | `balance`, Balance Loop | loop | Draw lines through orthogonally adjacent cells to form a loop that goes through every circle. 1. The loop cannot branch off or cross itself. 2. The straight line segments coming out of a white circle must ha... | 2.7 | Good / moderate |
| Barns | `barns`, バーンズ | loop | Draw a loop that goes through every cell. 1. Two perpendicular line segments may intersect each other only on icy cells, but the loop may not branch or otherwise overlap. 2. The loop may not turn on icy cell... | overflow | unrated |
| Battleship | `battleship`, Battleship | placement | Place every ship from the fleet into the grid. Ships can be rotated or mirrored. 1. All ships must be used exactly once. There cannot be ships in the grid that aren't present in the bank. 2. Two ships cannot... | 1.25 | Good / cheap |
| Bonsan | `bonsan`, ぼんさん | other | Draw lines to move some of the circles. 1. A circle can be moved horizontally or vertically, but cannot make a turn. 2. Movement lines cannot cross or overlap each other. Lines can also not go through the st... | overflow | unrated |
| Border Block | `bdblock`, ボーダーブロック | region | Draw lines over the dotted lines to divide the board into several blocks. 1. All identical numbers must be in the same block, and different numbers must be in different blocks. There can be no blocks without... | 3.22 | unrated |
| Bosanowa | `bosanowa`, ボサノワ, bossanova | number | Place a positive number inside every circle. 1. Each number must be equal to the sum of the differences between itself and each orthogonally adjacent number. | overflow | unrated |
| Box | `box`, ボックス | shading | Shade some cells on the board. 1. Each row and column has a certain value, indicated by the circled numbers in the right and bottom of the grid. 2. The numbers at the top indicate the sum of the values of th... | 1.34 | Workable / cheap |
| Brownies | `brownies`, ブラウニー | other | Draw lines to move some of the circles. 1. A circle can be moved horizontally or vertically, but cannot make a turn. 2. Movement lines cannot cross or overlap each other. Lines can also not go through the st... | overflow | unrated |
| Building Walk | `bdwalk`, ビルウォーク | loop | You're given a top-down view of a building. Grey cells represent elevators. 1. Draw a path from S to G that doesn't branch off or overlap itself at any cell. 2. The path must visit every number and elevator.... | overflow | unrated |
| Canal View | `canal`, Canal View | shading | Shade some cells on the board. 1. The number on a cell indicates how many cells are shaded in a continuous line starting from the cell. These lines are in the four cardinal directions (up, down, left, right)... | 1.12 | Workable / moderate |
| Castle Wall | `castle`, Castle Wall | loop | Draw lines through orthogonally adjacent cells to form a loop. 1. Lines cannot go through bold borders. 2. White cells must be inside the loop, and black cells must be outside the loop. 3. A number with an a... | 2.6 | Good / moderate |
| Cave | `cave`, バッグ, bag | shading | Shade some cells on the board to form a cave. 1. All shaded cells are connected through other shaded cells to the outside of the grid. 2. Numbers cannot be shaded. 3. Clues represent the total number of unsh... | 1.11 | Good / moderate |
| Chained Block | `chainedb`, チェンブロ | shading | Shade some cells on the board to form blocks of any shape. 1. Each block must contain exactly one number or a question mark. 2. A number indicates the size of the block that contains it. 3. Diagonally adjace... | overflow | unrated |
| Choco Banana | `cbanana`, チョコバナナ | shading | Shade some cells on the board. 1. A group of shaded cells must form a rectangle or square. 2. A group of unshaded cells must not form a rectangle or square. 3. A number indicates the size of the (shaded or u... | 1.20 | Good / moderate |
| Chocona | `chocona`, チョコナ | shading | Shade some cells on the board. 1. A group of orthogonally connected shaded cells is called a block. Each block must be a filled rectangle or square. 2. Numbered regions must contain the indicated amount of s... | 1.16 | Good / cheap |
| Circles and Squares | `circlesquare`, Circles and Squares | shading | Shade some cells on the board. 1. Black circles must be shaded, while white circles must not be shaded. 2. The shaded cells cannot form a 2x2 square. 3. All shaded cells form an orthogonally contiguous area.... | overflow | unrated |
| Cocktail Lamp | `cocktail`, カクテルランプ | shading | Shade some cells on the board to form blocks. 1. Regions contain no more than one block, which is an orthogonally connected group of shaded cells. 2. A number indicates the size of the block in the region. 3... | overflow | unrated |
| Coffee Milk | `coffeemilk`, コーヒー牛乳 | other | Draw lines between the circles to form groups. 1. Lines must be horizontal or vertical, and cannot turn. 2. Lines cannot cross each other. 3. Each group of circles must contain exactly one gray circle, and a... | overflow | unrated |
| Cojun | `cojun`, コージュン | number | Place a number in each cell. Some numbers are given. 1. Numbers must be between 1 and N, where N is the size of the region. 2. Each region contains exactly one of each number. 3. Two equal numbers cannot be... | 3.22 | Good / cheap |
| Combi Block | `cbblock`, コンビブロック | region | Draw lines over the dotted lines to divide the board into blocks. 1. Each block must contain exactly two outlined regions. 2. Two adjacent blocks cannot have the same shape, counting rotations and reflection... | overflow | unrated |
| Compass | `compass`, Compass | region | Draw lines over the dotted lines to divide the board into several blocks. 1. Each block contains exactly one cell with a compass. 2. A number in a compass indicates how many cells belong to its region that a... | 3.22 | Good / moderate |
| Context | `context`, Context | shading | Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. An unshaded number shows the amount of orthogonally adjacent shaded cells. 3. A shaded number shows the amount... | overflow | unrated |
| Coral | `coral`, Coral | shading | Shade some cells on the board according to the numbers. 1. Clues outside the grid represent the lengths of each of the blocks of consecutive shaded cells in the corresponding row or column, not necessarily i... | 1.29 | Workable / heavy |
| Country Road | `country`, カントリーロード | loop | Draw lines through orthogonally adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. Every country must be visited exactly once. 3. A number indicates how many cells inside the co... | 2.3 | Good / moderate |
| Creek | `creek`, クリーク | shading | Shade some cells on the board. 1. Numbers indicate the amount of shaded cells which overlap the clue. 2. All unshaded cells on the board form an orthogonally connected area. | 1.30 | Workable / cheap |
| Cross the Streams | `cts`, Cross the Streams | shading | Shade some cells on the board according to the numbers. 1. Clues outside the grid represent the lengths of each of the blocks of consecutive shaded cells in the corresponding row or column, in order from lef... | 1.28 | Workable / moderate |
| Crossing Ichimaga | `ichimagax`, 一回曲がって交差もするの | other | Draw lines over the dotted lines to connect the circles into one network. 1. A line must connect two circles, and can turn no more than once. 2. Two lines are allowed to cross if they both go straight throug... | overflow | unrated |
| Crossstitch | `crossstitch`, Crossstitch | loop | Draw diagonal lines to make two loops. 1. A shaded cell is not part of any loop. 2. Loops cannot branch off or cross themselves, but they can cross each other. 3. Two cells where the loops intersect cannot b... | overflow | unrated |
| Curve Data | `curvedata`, カーブデータ | other | Draw orthogonal lines between cells to form figures. 1. Every unshaded cell must have a line. Shaded cells cannot contain lines. 2. Lines cannot go through bold borders. 3. Every figure must overlap exactly... | overflow | unrated |
| Detour | `detour`, Detour | loop | Draw a loop that goes through every cell. 1. The loop cannot branch off or cross itself. 2. A number indicates how many times the loop turns inside the outlined region. | 2.9 | Good / heavy |
| Disorderly Loop | `disloop`, Disorderly Loop | loop | Draw lines through orthogonally adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. The loop cannot go through gray cells. 3. Arrows point from a gray cell to an adjacent cell wh... | 2.29 | unrated |
| Dominion | `dominion`, ドミニオン | shading | Shade some cells on the board to divide all unshaded cells into regions. 1. All shaded cells are orthogonally adjacent to exactly one other shaded cell. 2. Cells with letters cannot be shaded. 3. All identic... | 1.27 | Workable / moderate |
| Doppelblock | `doppelblock`, Doppelblock | number | Place a number in some cells, and shade the other cells. 1. Every row and column has exactly 2 shaded cells. 2. Numbers must be between 1 and N-2, where N is the width of the board. 3. Each row and column co... | 3.21 | Good / cheap |
| Dosun-Fuwari | `dosufuwa`, ドッスンフワリ | placement | Place iron balls (shaded circles) and balloons (unshaded circles) in some of the empty cells. 1. Each outlined region contains exactly one iron ball and one balloon. 2. An iron ball not in the bottom row mus... | overflow | unrated |
| Dotchi-Loop | `dotchi`, ドッチループ | loop | Draw lines through orthogonally adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. The loop goes through all unshaded circles. 3. Within a region, all unshaded circles contain e... | 2.26 | Workable / moderate |
| Double Back | `doubleback`, Double Back | loop | Draw a loop that goes through every unshaded cell. 1. The loop cannot branch off or cross itself. 2. The loop cannot go through shaded cells. 3. The loop visits each outlined region exactly twice. | 2.8 | Workable / moderate |
| Double Choco | `dbchoco`, ダブルチョコ | region | Divide the grid into regions of any size. 1. Each region contains one white and one grey contiguous area. Both areas must be the same size and shape. They can be rotated or mirrored. 2. A number indicates th... | 3.22 | Good / moderate |
| Easy as ABC | `easyasabc`, ABCプレース | number | Place letters from the given range into some of the cells. 1. Each row and column contains exactly one of each letter. Some cells remain empty. 2. A clue outside the grid represents the first letter seen in... | overflow | unrated |
| Evolmino | `evolmino`, シンカミノ | placement | Place squares in some of the unshaded cells. 1. Orthogonally adjacent squares form blocks. Every block must have exactly one square overlapping an arrow. 2. Each arrow must pass through two or more blocks. 3... | overflow | unrated |
| Family Photo | `familyphoto`, 家族写真 | region | Divide the grid into rectangular regions of orthogonally connected cells. 1. Each region must contain exactly one number, which indicates how many circles are in the region. 2. Orthogonally adjacent circles... | overflow | unrated |
| Fillmat | `fillmat`, フィルマット | region | Draw lines over the dotted lines to divide the board into several regions. 1. All regions must be a rectangle or square with a width of 1, and a length between 1 and 4. 2. Two regions of the same size cannot... | 3.22 | unrated |
| Fillomino | `fillomino`, フィルオミノ | number | Divide the grid into regions. 1. A number indicates the size of the region, in cells. Regions can have any amount of identical numbers, or none at all. 2. Two regions of the same size cannot be orthogonally... | 3.1 | Good / moderate (measured) |
| FiveCells | `fivecells`, ファイブセルズ | region | Divide the board into pentominoes (blocks of 5 cells). 1. A number indicates the amount of edges surrounding the cell which contain a border. 2. All borders must be used to divide two blocks, there can not b... | 3.9 | Workable / moderate |
| FourCells | `fourcells`, フォーセルズ | region | Divide the board into tetrominoes (blocks of 4 cells). 1. A number indicates the amount of edges surrounding the cell which contain a border. 2. All borders must be used to divide two blocks, there can not b... | 3.9 | Workable / moderate |
| Fractional Division | `fracdiv`, 分数分割 | region | Draw lines over the dotted lines to divide the board into several blocks. 1. Each block contains exactly one cell with a number. 2. A number indicates the ratio of circles to cells in the area. | overflow | unrated |
| Geradeweg | `geradeweg`, グラーデヴェグ | loop | Draw lines through orthogonally adjacent cells to form a loop that goes through every circle. 1. The loop cannot branch off or cross itself. 2. Every straight line segment that touches a clue must have a len... | 2.10 | Good / moderate |
| Goats and Wolves | `shwolf`, ヤギとオオカミ | region | Draw lines over the dotted lines to divide the board into cages. 1. Each cage contains at least one animal. 2. A cage cannot contain both goats and wolves. 3. Lines cannot turn, except where marked with a do... | overflow | unrated |
| Goishi | `goishi`, 碁石ひろい | other | You're given a grid filled with stones. Collect the stones in the correct order by marking each stone with a number. 1. Each stone must be in the same row or column as the previous stone, and not have other... | overflow | unrated |
| Guide Arrow | `guidearrow`, ガイドアロー | shading | Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. All unshaded cells on the board form an orthogonally connected area. 3. Unshaded cells cannot form a loop. Thi... | overflow | unrated |
| Haisu | `haisu`, Haisu | loop | Draw a path from S to G that goes through all cells. 1. The path cannot branch off or cross itself. 2. An outlined region can be entered and exited multiple times. A number N indicates that the path must go... | 2.25 | Good / heavy |
| Hakoiri-masashi | `hakoiri`, はこいり○△□ | placement | Place a triangle, square or circle in some of the cells. 1. Each outlined region contains exactly one of each possible symbol. 2. Identical symbols can not be horizontally, vertically or diagonally adjacent.... | overflow | unrated |
| Hanare-gumi | `hanare`, はなれ組 | number | Place one number in a cell of each region on the board. 1. The number in the region should be equal to the size of the region. 2. If two numbers share a row or column, and have no other numbers between them,... | 3.22 | unrated |
| Hashiwokakero | `hashikake`, 橋をかけろ, bridges | other | Draw bridges to connect the islands into one network. 1. Bridges must be horizontal or vertical lines between two islands, and cannot make a turn. 2. Bridges cannot intersect. 3. There can be at most two bri... | overflow | unrated |
| Hebi-Ichigo | `hebi`, へびいちご | placement | Place numbers into some of the empty cells to form snakes. 1. Each snake consists of a sequence of 5 consecutive numbers which are orthogonally adjacent. 2. Two snakes cannot share a border. 3. The number 1... | overflow | unrated |
| Herugolf | `herugolf`, ヘルゴルフ | other | Draw lines to move all of the balls into a hole, marked by an H. 1. A ball’s first move must be in a straight line of the number of cells indicated by the number inside it, and each successive move must be o... | overflow | unrated |
| Heteromino | `heteromino`, ヘテロミノ | region | Divide the board into triminoes (blocks of 3 cells). 1. Triminoes cannot use shaded cells. 2. Two triminoes that share a border must have different shape or different orientation. | 3.9 | Poor / moderate |
| Heya-Bon | `heyabon`, へやぼん | other | Draw lines to move some of the circles. 1. A circle can be moved horizontally or vertically, but cannot make a turn. 2. Movement lines cannot cross or overlap each other. Lines can also not go through the st... | overflow | unrated |
| Heyablock | `heyablock`, へやブロ | shading | Shade some cells on the board. 1. All shaded cells in one region must be connected. 2. A number indicates the amount of shaded cells in a region. 3. If a region has no number, it must have at least one shade... | overflow | unrated |
| Heyapin | `heyapin`, へやピン | other | Place a pin in some grid vertices, including on the edge of the grid. 1. A number in a region indicates how many pins overlap the region, either fully or partially. 2. All regions must be joined by pins to f... | overflow | unrated |
| Heyawake | `heyawake`, へやわけ, heyawacky | shading | You're given a board divided into rooms. Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. A number indicates the amount of shaded cells in a region. 3. There c... | 1.6 | Good / moderate |
| Hinge | `hinge`, ちょうつがい | shading | Shade some cells on the board. 1. A group of orthogonally connected shaded cells is called a block. Each block is cut exactly once by a single straight segment of region borders, across which it must have re... | overflow | unrated |
| Hitori | `hitori`, ひとりにしてくれ | shading | Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. A row or column may not contain two unshaded cells with identical numbers. 3. All unshaded cells on the board... | 1.2 | Poor / cheap |
| Hotaru Beam | `firefly`, ホタルビーム | other | Draw a line from every firefly to make one connected network. 1. A black dot indicates where each firefly's path must start. 2. A path cannot connect directly between two black dots. 3. Paths cannot branch,... | overflow | unrated |
| Ice Walk | `icewalk`, アイスウォーク | loop | Draw a loop that goes through every numbered cell. 1. Two perpendicular line segments may intersect each other only on icy cells, but the loop may not branch or otherwise overlap. 2. The loop may not turn on... | overflow | unrated |
| Icebarn | `icebarn`, アイスバーン | loop | Draw a line that starts at the IN arrow, and goes through every arrow before reaching the OUT arrow. 1. Two perpendicular line segments may intersect each other only on icy cells, but the loop may not branch... | 2.24 | Poor / heavy |
| Icelom | `icelom`, アイスローム | loop | Draw a line that starts at the IN arrow, and goes through every white cell before reaching the OUT arrow. 1. Two perpendicular line segments may intersect each other only on icy cells, but the loop may not b... | overflow | unrated |
| Icelom 2 | `icelom2`, アイスローム２ | loop | Draw a line that starts at the IN arrow, and goes through every number before reaching the OUT arrow. 1. Two perpendicular line segments may intersect each other only on icy cells, but the loop may not branc... | overflow | unrated |
| Ichimaga | `ichimaga`, イチマガ | other | Draw lines over the dotted lines to connect the circles into one network. 1. A line must connect two circles, and can turn no more than once. 2. Lines cannot branch or overlap. 3. Numbers indicate the total... | overflow | unrated |
| International Borders | `interbd`, International Borders | shading | Shade some cells to divide the grid into countries. 1. Some cells have a number. The number indicates the amount of shaded cells orthogonally adjacent to this cell. 2. Some cells have a color. All identical... | overflow | unrated |
| Inverse LITSO | `invlitso`, Inverse LITSO | shading | Place a tetromino (a block of 4 unshaded cells) in every outlined region, and shade the rest of the cells. 1. The shaded cells cannot form a 2x2 square. 2. Two identical tetrominoes cannot share an edge, cou... | overflow | unrated |
| Islands | `shimaguni`, 島国 | shading | Shade some cells on the board to form islands. 1. All regions contain exactly one island, which is an orthogonally connected group of shaded cells. 2. A number indicates the size of the island in the region.... | 1.21 | Good / cheap |
| Juosan | `juosan`, 縦横さん | other | Draw an orthogonal line in every cell, connecting two opposite edges and going through the center. 1. There cannot be a run of 3 or more parallel lines. 2. Numbers indicate either the amount of cells with a... | overflow | unrated |
| Kaisu | `kaisu`, Kaisu | loop | Draw a path from S to G that goes through all cells. 1. The path cannot branch off or cross itself. 2. An outlined region can be entered and exited multiple times. On the region's Nth visit the line must go... | 2.25 | Good / heavy |
| KaitoRamma | `kramma`, 快刀乱麻 | region | Draw lines over the dotted lines to divide the board into blocks. 1. Each block contains at least one circle. 2. A block cannot contain both white and black circles. 3. Lines must be drawn straight from one... | overflow | unrated |
| Kakuro | `kakuro`, カックロ | number | Place a number between 1 and 9 into every empty cell. 1. A clue on the bottom of a cell indicates the sum of numbers below the clue, up to the next clue. 2. A clue on the right of a cell indicates the sum of... | overflow | unrated |
| Kakuru | `kakuru`, カックル | number | Place a number between 1 and 9 into every unshaded cell. 1. Identical numbers cannot be horizontally, vertically or diagonally adjacent. 2. Clues indicate the sum of the orthogonally and diagonally adjacent... | overflow | unrated |
| Kazunori Room | `kazunori`, かずのりのへや | number | Place a number into every cell. 1. Each region contains every number between 1 to N exactly twice, where N is half the number of cells in the region. 2. Two numbers of the same value within a region must be... | 3.22 | unrated |
| Kin-Kon-Kan | `kinkonkan`, キンコンカン | placement | Place a mirror in some of the cells by drawing a diagonal line connecting two opposite corners. 1. Every outlined region contains exactly one mirror. 2. Symbols outside the grid indicate a light source. The... | overflow | unrated |
| Kissing Polyominoes | `kissing`, Kissing Polyominoes | other | not read | overflow | unrated |
| Koburin | `koburin`, コブリン | loop | Shade some cells on the board, and draw a single loop that goes through all remaining cells. 1. The loop cannot branch off or cross itself. 2. Shaded cells cannot be orthogonally adjacent. 3. Cells with numb... | 2.13 | Workable / heavy |
| Kouchoku | `kouchoku`, 交差は直角に限る | loop | Draw lines between every node to form a loop. 1. Lines go straight from node to node, and can be drawn at any angle. 2. The loop can not branch off. Nodes must be visited exactly once. 3. The loop may inters... | overflow | unrated |
| Kropki | `kropki`, Kropki | number | Place a number in each cell. 1. Numbers must be between 1 and N, where N is the width of the board. 2. Each row and column contains exactly one of each number. 3. A white dot indicates that the two adjacent... | overflow | unrated |
| Kurochute | `kurochute`, クロシュート | shading | Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. Numbers cannot be shaded. 3. There must exist exactly one shaded cell with the indicated distance in a straigh... | overflow | unrated |
| Kuroclone | `kuroclone`, クロクローン | shading | Shade some cells on the board. 1. Numbers cannot be shaded. 2. Each region must include exactly two units (shaded blocks) and these units must have the same shape, counting rotations and reflections as the s... | overflow | unrated |
| Kurodoko | `kurodoko`, 黒どこ(黒マスはどこだ) | shading | Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. Numbers cannot be shaded. 3. Clues represent the total number of unshaded cells that can be seen in a straight... | 1.5 | Good / moderate |
| Kurotto | `kurotto`, クロット | shading | Shade some cells on the board. 1. Cells with circles cannot be shaded. 2. Numbers indicate the sum of the size of all blocks that share at least one border with the circle. | 1.13 | Good / moderate |
| Kusabi | `kusabi`, クサビリンク | loop | Draw lines between the circles to form pairs. 1. Lines must turn exactly twice, and each turn must be in the same direction. 2. Lines cannot cross or overlap each other. 3. A circle labeled '短' indicates tha... | overflow | unrated |
| L-route | `loute`, エルート | region | Divide the grid into regions of orthogonally connected cells. 1. Each region must be an L shape with a width of one cell. 2. A circle must be located in the corner of an L shape. 3. Arrows must be located on... | overflow | unrated |
| La Paz | `lapaz`, La Paz | region | Shade some cells on the board, and divide the rest into regions of 2 cells. 1. No two shaded cells are horizontally or vertically adjacent. 2. Numbers must be contained in a 1x2 region. It's possible for a r... | 3.22 | unrated |
| Ladders | `ladders`, はしごをかけろ | other | Draw ladders of length 1 through the centers of some cells. 1. Each ladder overlaps two borders of distinct regions. 2. The endpoints of two ladders cannot touch. 3. Numbers indicate how many ladders overlap... | overflow | unrated |
| Light and Shadow | `lightshadow`, Light and Shadow | shading | Shade some cells on the board to form shaded and unshaded areas. 1. Each orthogonally connected area contains exactly one clue. 2. The color of clued cells cannot be changed. 3. A clue represents the size of... | 1.15 | Good / moderate |
| Line of Sight | `lineofsight`, サイトライン | loop | Draw lines along the edges of some cells to form a loop. 1. The loop cannot branch off or cross itself. 2. A number represents the length of the first straight line segment seen in the indicated direction. | 2.29 | unrated |
| Litherslink | `lither`, Litherslink | other | Draw lines along the edges of some cells to form trees. 1. There must be more than one tree. 2. A tree must branch or terminate at every grid vertex. In other words, each grid vertex must have 1, 3, or 4 con... | overflow | unrated |
| LITS | `lits`, ＬＩＴＳ | shading | Place a tetromino (a block of 4 cells) in every outlined region. 1. There can not be a 2x2 square of cells occupied by tetrominoes. 2. Two identical tetrominoes cannot share an edge, counting rotations and r... | 1.3 | Workable / cheap |
| Lohkous | `lohkous`, Lohkous | region | Draw lines over the dotted lines to divide the board into several blocks. 1. Each block must contain exactly one square with one or more numbers on it. 2. All lines must be used to divide two regions, there... | 3.22 | unrated |
| Lollipops | `lollipops`, ペロペロキャンディ | placement | Place several lollipops of size 1x2 into the grid. 1. A lollipop consists of a circle and a connected horizontal or vertical line. Some parts are given. 2. Two lollipops cannot be orthogonally adjacent. 3. T... | overflow | unrated |
| Look-Air | `lookair`, るっくえあ | shading | Shade some cells on the board. 1. Every group of shaded cells must form a filled square. 2. Clues represent how many of the five cells forming a cross around the clue (including itself) are shaded. 3. Two sq... | 1.34 | Workable / moderate |
| Loop Special | `loopsp`, 環状線スペシャル | loop | Draw multiple loops so that every cell is used by at least one loop. 1. Two perpendicular line segments may intersect each other, but they may not turn at their intersection or otherwise overlap. 2. Some cel... | 2.16 | Poor / heavy |
| Magnetic Ichimaga | `ichimagam`, 磁石イチマガ | other | Draw lines over the dotted lines to connect the circles into one network. 1. A line must connect two circles, and can turn no more than once. 2. Lines cannot branch or overlap. 3. Numbers indicate the total... | overflow | unrated |
| Magnets | `magnets`, Magnets | placement | Place several magnets into the grid. A magnet consists of a 1x2 domino and has a positive and negative pole. 1. An outlined region contains one whole magnet, or stays empty. 2. Equal poles cannot be adjacent... | overflow | unrated |
| Makaro | `makaro`, マカロ | number | Place a number in each empty cell. Some numbers are given. 1. Numbers must be between 1 and N, where N is the size of the region. 2. Each region contains exactly one of each number. 3. Two equal numbers cann... | 3.22 | Good / cheap |
| Mannequin Gate | `mannequin`, マネキンゲート | shading | Shade exactly two cells in each outlined region. 1. A number indicates how many empty cells are between the two shaded cells in the region, when following the shortest possible path between the cells that do... | overflow | unrated |
| Martini | `martini`, マティーニ | shading | Shade some cells on the board to form blocks of orthogonally adjacent cells. 1. Black circles must overlap a block, while white circles must not overlap a block. 2. Outlined regions contain no more than one... | overflow | unrated |
| Masyu | `mashu`, ましゅ, pearl | loop | Draw lines through orthogonally adjacent cells to form a loop that goes through every circle. 1. The loop cannot branch off or cross itself. 2. The loop must turn on black circles and travel straight through... | 2.2 | Good / moderate |
| Maxi Loop | `maxi`, Maxi Loop | loop | Draw a loop that goes through every cell. 1. The loop cannot branch off or cross itself. 2. A number indicates the length of the longest visit to that region. | 2.11 | Workable / heavy |
| Meandering Numbers | `meander`, にょろにょろナンバー | number | Place a number in each cell to make a path in each region. Some numbers are given. 1. Numbers must be between 1 and N, where N is the size of the region. 2. Each region contains exactly one of each number. 3... | 3.22 | Good / cheap |
| Mejilink | `mejilink`, メジリンク | loop | Draw lines over the dotted lines to form a loop. 1. The loop cannot branch off or cross itself. 2. The amount of cells in a region must equal the number of borders surrounding it that don’t belong to the loop. | 2.29 | unrated |
| Mid-loop | `midloop`, ミッドループ | loop | Draw lines through orthogonally adjacent cells to form a loop that goes through every circle. 1. The loop cannot branch off or cross itself. 2. Each circle marks the center of the straight line segment it li... | 2.12 | Workable / moderate |
| Minarism | `minarism`, マイナリズム | number | Place a number in each cell. 1. Numbers must be between 1 and N, where N is the width of the board. 2. Each row and column contains exactly one of each number. 3. An arrow points from a larger number to a sm... | overflow | unrated |
| Minesweeper | `mines`, マインスイーパ | placement | Locate the cells containing a mine in the grid. 1. Numbers indicate the amount of mines in the orthogonally and diagonally adjacent cells. 2. A number cannot contain a mine. | 1.24 | Good / cheap |
| Mirror Block | `mirrorbk`, ミラーブロック | region | Draw lines over the dotted lines to divide the board into regions. 1. A number indicates the size of the region that contains it. 2. Regions can have no more than 1 number. 3. A thick line represents a mirro... | overflow | unrated |
| Mirroring Tile | `mrtile`, ミラーリングタイル | shading | Shade some cells on the board to form blocks of any shape. Some shaded cells are given. 1. A number indicates the size of the block that contains it. A block can have any amount of identical numbers. 2. Ever... | overflow | unrated |
| Mochikoro | `mochikoro`, モチコロ | shading | Shade some cells on the board to form regions of unshaded cells. 1. All regions must be rectangular in shape. 2. A region can have no more than one number. 3. A number indicates the size of the region that c... | 1.14 | Workable / heavy |
| Mochinyoro | `mochinyoro`, モチにょろ | shading | Shade some cells on the board to form regions of unshaded cells. 1. Shaded blocks must not form rectangles or squares. 2. All regions must be rectangular in shape. 3. A region can have no more than one numbe... | 1.14 | Workable / heavy |
| Moon or Sun | `moonsun`, 月か太陽 | loop | Draw lines through orthogonally adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. Every region must be visited exactly once. 3. Within a region, the loop must pass through all... | 2.19 | Good / moderate |
| Mukkonn Enn | `mukkonn`, Mukkonn Enn | loop | Draw a loop that goes through every cell. 1. The loop cannot branch off or cross itself. 2. When the loop exits a clued cell from a side with a number, it must travel in a straight line for the indicated num... | 2.29 | unrated |
| Myopia | `myopia`, Myopia | loop | Draw lines along the edges of some cells to form a loop. 1. The loop cannot branch off or cross itself. 2. Arrows point towards the lines closest to the clue. If a clue has multiple arrows, the distance to t... | 2.14 | Workable / heavy |
| Nagareru-Loop | `nagare`, 流れるループ | loop | Draw lines through orthogonally adjacent cells to form a directional loop. 1. The loop cannot branch off or cross itself. 2. The loop cannot go through a shaded cell. 3. The loop must visit all black arrows... | 2.29 | unrated |
| Nagenawa | `nagenawa`, なげなわ | loop | Draw lines through the center of some cells to make rectangular loops. 1. Loops may cross each other, but may not overlap or share a corner. 2. Numbers indicate how many cells in the outlined region are used... | 2.21 | Workable / moderate |
| Nanameguri | `nanameguri`, ななめぐり | loop | Draw lines through orthogonally adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. Cells can not be entered more than once. 2. Every outlined region must be visited exactly once. 3... | 2.29 | unrated |
| Nanro | `nanro`, ナンロー | number | Place a number into some of the cells. Some numbers are given. 1. Each number must be equal to the amount of cells with numbers inside the outlined region. 2. Every region must contain at least one number. 3... | 3.6 | Good / moderate |
| Nawabari | `nawabari`, なわばり | region | Draw lines over the dotted lines to divide the board into rectangles. 1. Each rectangle contains exactly one number. 2. A number indicates the amount of edges surrounding the cell which contain a border. | 3.14 | Good / cheap |
| New KaitoRamma | `kramman`, 新・快刀乱麻 | region | Draw lines over the dotted lines to divide the board into blocks. 1. Each block contains at least one circle. 2. A block cannot contain both white and black circles. 3. Lines cannot turn, except where marked... | overflow | unrated |
| NEWS | `news`, NEWS | placement | Place a letter N, E, W, or S in some of the cells. 1. Each region contains exactly two letters. 2. Letters may not repeat in a row or column. 3. Cells with a cross must remain unused. 4. Each letter must be... | overflow | unrated |
| NIKOJI | `nikoji`, NIKOJI | region | Divide the grid into regions, with each region containing one letter. 1. Regions with the same letter must be identical in shape and orientation, and must have the letter in the same relative position. 2. Re... | 3.22 | unrated |
| No Three | `nothree`, ノースリー | shading | Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. A circle overlaps exactly one shaded cell. 3. Three consecutive shaded cells in a row/column must have differe... | 1.34 | Workable / moderate |
| Nondango | `nondango`, ノンダンゴ | other | You're given a grid with circles in some of the cells. Change some of the circles from white to black. 1. Each outlined region must contain exactly one black circle. 2. There cannot be a horizontal, vertical... | 3.19 | Workable / cheap |
| Nonogram | `nonogram`, ののぐらむ | shading | Shade some cells on the board according to the numbers. 1. Clues outside the grid represent the lengths of each of the blocks of consecutive shaded cells in the corresponding row or column, in order from lef... | overflow | unrated |
| Norinori | `norinori`, のりのり | shading | Shade some cells on the board. 1. Each shaded cell is orthogonally adjacent to exactly one other shaded cell. 2. Each outlined region contains exactly 2 shaded cells. | 1.19 | Good / cheap |
| Norinuri | `norinuri`, 海苔ぬり | shading | Shade some cells on the board to form regions of unshaded cells. 1. Each region contains exactly one number. 2. A number indicates the size of the region that contains it. 3. You cannot shade a cell with a n... | overflow | unrated |
| Number Rope | `numrope`, ナンバーロープ | number | Place a number between 1 and 9 into every unshaded cell. 1. Each gray line should contain a sequence of numbers which increases by 1. 2. Numbers on shaded cells indicate the sum of numbers in the (up to four... | overflow | unrated |
| Numberlink | `numlin`, ナンバーリンク | loop | Draw paths going through the cells to connect identical numbers. 1. Two paths cannot occupy the same cell. | 2.20 | Poor / heavy |
| Nuri-Maze | `nurimaze`, ぬりめいず | shading | You're given a grid divided into tiles. Shade some tiles on the board to form a maze. 1. A tile is either completely shaded or unshaded. 2. Tiles containing a clue cannot be shaded. 3. There can not be a 2x2... | overflow | unrated |
| Nuri-uzu | `nuriuzu`, ぬりうず | shading | Shade some cells on the board. 1. The unshaded areas must form blocks with exactly one star. You cannot shade a cell overlapping a star. 2. Unshaded areas must be rotationally symmetric, with a star at the c... | overflow | unrated |
| Nuribou | `nuribou`, ぬりぼう | shading | Shade some cells on the board to form regions of unshaded cells. 1. Each region contains exactly one number. 2. A number indicates the size of the region that contains it. 3. You cannot shade a cell with a n... | 1.18 | Workable / heavy |
| Nurikabe | `nurikabe`, ぬりかべ | shading | Shade some cells on the board to form regions of unshaded cells. 1. Each region contains exactly one number. 2. A number indicates the size of the region that contains it. 3. You cannot shade a cell with a n... | 1.1 | Good / heavy |
| Nurimisaki | `nurimisaki`, ぬりみさき | shading | Shade some cells on the board. 1. There cannot be a 2x2 square of all shaded or unshaded cells. 2. Circles mark every instance of a cell which is unshaded and orthogonally adjacent to exactly one other unsha... | 1.8 | Good / moderate |
| One Room One Door | `oneroom`, ワンルームワンドア | shading | You're given a board divided into rooms. Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. A number inside a room indicates how many cells inside the room are s... | overflow | unrated |
| Onsen-meguri | `onsen`, 温泉めぐり | loop | Draw lines through the center of some cells to form multiple loops. 1. Loops cannot branch or overlap, and cannot cross themselves or each other. 2. Every loop goes through exactly one circle, and every circ... | 2.15 | Poor / heavy |
| Ovotovata | `ovotovata`, Ovotovata | loop | Draw lines through orthogonally adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. When the loop exits a numbered region in any direction, it must travel in a straight line for... | 2.29 | unrated |
| Oyakodori | `oyakodori`, おやこどり | other | You're given a grid with small birds (black circles) and large birds (white circles). Draw lines to move each bird into a nest, represented by adjacent gray cells. 1. Movement lines cannot cross or overlap e... | overflow | unrated |
| Paintarea | `paintarea`, ペイントエリア | shading | You're given a grid divided into tiles. Shade some tiles on the board. 1. A tile is either completely shaded or unshaded. 2. There can not be a 2x2 square of all shaded or all unshaded cells. 3. Numbers indi... | overflow | unrated |
| Parquet | `parquet`, Parquet | shading | You're given a grid divided into regions and tiles. Shade some tiles on the board. 1. A tile is either completely shaded or unshaded. 2. Within each thick-outlined region, exactly one tile is shaded. 3. All... | overflow | unrated |
| Patchwork | `patchwork`, パッチワーク | shading | Divide the grid into square-shaped regions, then shade some cells. 1. A number indicates how many shaded cells are in the region. Regions can have any amount of identical numbers, or none at all. 2. Gray cel... | overflow | unrated |
| Pencils | `pencils`, ペンシルズ | placement | Place several pencils into the grid, and draw lines into the other cells. 1. A pencil consists of a rectangle with a width of 1. One of the short ends is attached to the pencil tip, which occupies another ce... | overflow | unrated |
| Penta Touch | `pentatouch`, Penta Touch | placement | Place every shape from the bank into the grid. Shapes can be rotated or mirrored. 1. All shapes must be used exactly once. There cannot be shapes in the grid that aren't present in the bank. 2. Two shapes ca... | overflow | unrated |
| Pentominous | `pentominous`, Pentominous | region | Divide the grid into pentominoes (regions of 5 cells). You can use each pentomino any number of times (including zero). 1. Two adjacent pentominoes cannot have the same shape, counting rotations and reflecti... | 3.8 | Workable / moderate |
| Pentopia | `pentopia`, Pentopia | placement | Place some shapes from the bank into the grid. Shapes can be rotated or mirrored. 1. A shape can be used no more than once. There cannot be shapes in the grid that aren't present in the bank. 2. Two shapes c... | overflow | unrated |
| Pipelink | `pipelink`, パイプリンク | loop | Draw a loop that goes through every cell. 1. Two perpendicular line segments may intersect each other, but they may not turn at their intersection or otherwise overlap. 2. Some cells have given loop segments... | 2.16 | Poor / heavy |
| Pipelink Returns | `pipelinkr`, 帰ってきたパイプリンク | loop | Draw a loop that goes through every cell. 1. Two perpendicular line segments may intersect each other only inside a circle, but the loop may not branch or otherwise overlap. 2. The loop cannot turn on a circ... | overflow | unrated |
| Putteria | `putteria`, プッテリア | number | Place one number in a cell of each region on the board. 1. The number in the region should be equal to the size of the region. 2. Numbers cannot be orthogonally adjacent. 3. Identical numbers cannot be place... | 3.22 | unrated |
| Ququ | `ququ`, 区区 | shading | Shade some triangles on the board. 1. Triangles with numbers or question marks cannot be shaded. 2. Unshaded triangles which share an edge form regions. Each region contains exactly one number or a question... | overflow | unrated |
| Rail Pool | `railpool`, Rail Pool | loop | Draw a loop that visits every cell. 1. The loop cannot branch off or cross itself. 2. A line segment that overlaps a region must have a length indicated by one of the numbers in that region. For segments con... | 2.29 | unrated |
| Rassi Silai | `rassi`, Rassi Silai | loop | Draw multiple lines through orthogonally adjacent cells. 1. Each region contains exactly one line covering all of the region's cells. 2. Lines cannot branch off or cross themselves. 3. Lines cannot form loop... | overflow | unrated |
| Rectangle-Slider | `rectslider`, 四角スライダー | other | Draw lines to move some of the panels. 1. A panel can be moved horizontally or vertically, but cannot make a turn. 2. Movement lines cannot cross or overlap each other. Lines can also not go through the star... | overflow | unrated |
| Reflect Link | `reflect`, リフレクトリンク | loop | Draw lines through orthogonally adjacent cells to form a loop. 1. The loop cannot branch off or overlap. 2. All cells where the loop crosses itself are given. The loop cannot cross itself in other places. 3.... | overflow | unrated |
| Remembered Length | `remlen`, Remembered Length | loop | Draw lines through orthogonally adjacent cells to form a directional loop. 1. All unshaded cells must be visited. 2. The loop cannot branch off or cross itself. 3. Each time the loop exits a region containin... | 2.29 | unrated |
| Renban-Madoguchi | `renban`, 連番窓口 | number | Place a positive number into every cell. 1. The numbers in each region must all form a consecutive sequence, in any order. 2. The difference between two numbers separated by a bold border must be equal to th... | 3.22 | Good / cheap |
| Return Home | `kaero`, お家に帰ろう | other | Draw lines to move some of the letters. 1. Movement lines cannot cross or overlap each other. Lines can also not go through the start- or endpoint of other letters. 2. All identical letters must be inside th... | overflow | unrated |
| Ring-ring | `ringring`, リングリング | loop | Draw lines through the center of cells to fill each empty cell with a rectangular loop. 1. Loops may cross each other, but may not overlap or share a corner. 2. Loops cannot go through shaded cells. | 2.21 | Workable / moderate |
| Ripple Effect | `ripple`, 波及効果 | number | Place a number in each cell. Some numbers are given. 1. Numbers must be between 1 and N, where N is the size of the region. 2. Each region contains exactly one of each number. 3. Two equal numbers N in the s... | 3.16 | Good / cheap |
| Roma | `roma`, ろーま, rome | placement | Place an arrow in every empty cell. Some arrows are given. 1. Every outlined area contains different arrows. 2. Following the arrows must lead to one of the circled goals. | overflow | unrated |
| Rooms of Factors | `factors`, 因子の部屋 | number | Place a number in each cell. 1. Numbers must be between 1 and N, where N is the width of the board. 2. Each row and column contains exactly one of each number. 3. Clues indicate the product of all numbers in... | overflow | unrated |
| Round Trip | `roundtrip`, Round Trip | loop | Draw lines through orthogonally adjacent cells to form a loop. 1. The loop cannot branch off or retrace itself. When the loop visits a cell twice, it must travel in a straight line each time. 2. The numbers... | 2.17 | Workable / heavy |
| Sashigane | `sashigane`, さしがね | region | Divide the grid into regions of orthogonally connected cells. 1. Each region must be an L shape with a width of one cell. 2. A circle must be located in the corner of an L shape. 3. Arrows must be located on... | 3.12 | Good / cheap |
| Sashikazune | `sashikazune`, さしカズね | region | Divide the grid into regions of orthogonally connected cells. 1. Each region must be an L shape with a width of one cell. 2. A number indicates the distance between its cell and the corner of its L-shaped re... | overflow | unrated |
| Satogaeri | `satogaeri`, さとがえり, sato | other | Draw lines to move some of the circles. 1. A circle can be moved horizontally or vertically, but cannot make a turn. 2. Movement lines cannot cross or overlap each other. Lines can also not go through the st... | overflow | unrated |
| School Trip | `shugaku`, 修学旅行の夜 | placement | Place some 1x2 beds in the grid, each with a pillow on one side and shade all of the remaining empty cells. 1. Shaded cells cannot form a 2x2 square. 2. All shaded cells form an orthogonally contiguous area.... | overflow | unrated |
| Scrin | `scrin`, スクリン | loop | Place several rectangles into the grid, where the corners are located on the dots. 1. Rectangles cannot overlap or have a border in common. 2. A rectangle can contain no more than one circle. 3. A number ind... | overflow | unrated |
| Shakashaka | `shakashaka`, シャカシャカ | other | Shade a right triangle in some empty cells, each of which occupies exactly half the cell it’s in. 1. Each unshaded area must be rectangular in shape. The rectangle can be upright, or rotated at a 45° angle.... | 1.9 | Poor / heavy |
| Shikaku | `shikaku`, 四角に切れ | region | Draw lines over the dotted lines to divide the board into rectangles. 1. Each rectangle contains exactly one black circle. 2. A number indicates the size of the rectangle, in cells. | 3.4 | Good / cheap |
| Shirokuro-link | `wblink`, シロクロリンク | loop | Draw lines between the circles to form pairs. 1. Lines must be horizontal or vertical, and cannot turn. 2. Lines cannot cross or overlap each other. 3. Each pair consists of a black circle and a white circle. | overflow | unrated |
| Simple Gako | `simplegako`, シンプルガコ | number | Place a number into each cell such that each number indicates how many copies of itself appear in the same row or column, including itself. | overflow | unrated |
| Simple Loop | `simpleloop`, Simple Loop | loop | Draw a loop that goes through every unshaded cell. 1. The loop cannot branch off or cross itself. 2. The loop cannot go through shaded cells. | 2.5 | Workable / moderate |
| Skyscrapers | `skyscrapers`, ビルディングパズル, building | number | Place a number in each cell. 1. Numbers must be between 1 and N, where N is the width of the board. 2. Each row and column contains exactly one of each number. 3. Every number inside the grid represents a bu... | overflow | unrated |
| Slalom | `slalom`, スラローム, suraromu | loop | Draw lines through orthogonally adjacent cells to form a directional loop, starting at the circle. 1. The loop cannot branch off or cross itself. 2. The loop cannot go through shaded cells. 3. The loop must... | overflow | unrated |
| Slant | `gokigen`, ごきげんななめ | other | Draw a diagonal line in every cell, connecting two opposite corners. 1. A number indicates how many lines meet at that corner. 2. Lines cannot form loops. | 2.23 | Workable / cheap |
| Slash Pack | `slashpack`, Slash Pack | region | Draw diagonal lines through the center of some cells to divide the board into regions. 1. Two lines cannot overlap within a cell. All lines must be drawn from one corner to the opposite corner of the cell. 2... | 3.22 | unrated |
| Slitherlink | `slither`, スリザーリンク | loop | Draw lines along the edges of some cells to form a loop. 1. The loop cannot branch off or cross itself. 2. A number indicates the amount of edges surrounding the cell that are visited by the loop. | 2.1 | Good / heavy |
| Snake | `snake`, Snake | shading | Shade some cells into the grid to form a snake. 1. The snake cannot loop back on itself and visit a cell that's orthogonally or diagonally adjacent to a cell it has visited before. 2. Black circles must lie... | 2.22 | Good / moderate |
| Snake Pit | `snakepit`, Snake Pit | number | Divide the grid into regions, where each region represents a snake. 1. A snake is a path that is at least 2 cells long and exactly 1 cell wide, and can have any amount of turns. 2. A snake cannot loop back o... | 3.13 | Good / heavy |
| Square Jam | `squarejam`, Square Jam | region | Draw lines over the dotted lines to divide the grid into square-shaped regions. 1. A number indicates the side length of the square it's contained in. Squares may have any amount of identical numbers. 2. Reg... | 3.22 | Good / cheap |
| Stairwell | `kaidan`, かいだんしばり | other | Draw several rectangles of length 1xN (at least 2) and draw a circle in all remaining cells. 1. Rectangles and circles cannot overlap shaded cells. 2. A number indicates the amount of circles in the 4 orthog... | overflow | unrated |
| Star Battle | `starbattle`, スターバトル | placement | Place a star into some of the cells. 1. Stars cannot be horizontally, vertically or diagonally adjacent. 2. The number at the top of the grid indicates how many stars are in each row, column and outlined reg... | 1.10 | Good / cheap |
| Statue Park | `statuepark`, Statue Park | placement | Place every shape from the bank into the grid. Shapes can be rotated or mirrored. 1. All shapes must be used exactly once. There cannot be shapes in the grid that aren't present in the bank. 2. Two shapes ca... | 3.10 | Workable / heavy |
| Stostone | `stostone`, ストストーン | shading | Shade some cells on the board to form blocks. 1. All regions contain exactly one block, which is an orthogonally connected group of shaded cells. 2. A number indicates the size of the block in the region. 3.... | 1.17 | Workable / heavy |
| Sudoku | `sudoku`, 数独 | number | Place a number in each cell. Some numbers are given. 1. Numbers must be between 1 and N, where N is the width of the board. 2. Each row, column and outlined block contains exactly one of each number. | overflow | unrated |
| Sukoro | `sukoro`, 数コロ | number | Place a number between 1 and 4 into some of the cells. Some numbers are given. 1. Each number is equal to the amount of (up to 4) orthogonally adjacent cells that also contain a number. 2. Identical numbers... | overflow | unrated |
| Sukoro-room | `sukororoom`, 数コロ部屋 | number | Place a number between 1 and 4 into some of the cells. Some numbers are given. 1. Each number is equal to the amount of (up to 4) orthogonally adjacent cells that also contain a number. 2. Every outlined reg... | 3.22 | unrated |
| Symmetry Area | `symmarea`, シンメトリーエリア | number | Divide the grid into regions. 1. A number indicates the size of the region, in cells. Regions can have any amount of identical numbers, or none at all. 2. Two regions of the same size cannot be orthogonally... | 3.2 | Good / moderate |
| Tachiawase Block | `tachibk`, たちあわせブロック | region | Draw lines over the dotted lines to divide the two grids into several blocks. 1. A number indicates the size of the block in cells. A block can contain one or more numbers, or none at all. 2. Both grids must... | overflow | unrated |
| Taj Mahal | `tajmahal`, タージ・マハル | region | Draw a square around each given circle. 1. All squares must have a circle in the center. The square's corners must be located on the grid points. 2. Two squares may not intersect or overlap, but they can tou... | overflow | unrated |
| Takoyaki | `takoyaki`, たこ焼き | other | Draw lines through all unshaded cells, then place circles on top of them. 1. Every line goes through exactly three circles: One on each endpoint, and another somewhere in the middle. 2. Lines cannot cross or... | overflow | unrated |
| Tapa | `tapa`, Tapa | shading | Shade some cells on the board. 1. You cannot shade a cell with a number. 2. Numbers represent the lengths of the blocks of consecutive shaded cells in the (up to) eight cells surrounding the clue. Numbers ar... | 1.4 | Good / moderate |
| Tapa-Like Loop | `tapaloop`, Tapa-Like Loop | loop | Draw lines through orthogonally adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. The loop cannot go through clues. 3. Clues represent the numbers of consecutive cells occupied... | 2.18 | Good / moderate |
| Tasquare | `tasquare`, たすくえあ | shading | Shade some cells on the board. 1. Shaded cells must form filled squares. 2. Cells with clues cannot be shaded. 3. Numbers indicate the sum of the size of all blocks that share a border with the clue. 4. Clue... | 1.34 | Workable / moderate |
| Tatamibari | `tatamibari`, タタミバリ | region | Draw lines over the dotted lines to divide the board into regions. 1. Each region contains exactly one clue. 2. A vertical line indicates that the region is a rectangle where the height is larger than the wi... | 3.15 | Workable / cheap |
| Tatebo-Yokobo | `tateyoko`, タテボーヨコボー | other | Draw an orthogonal line in every unshaded cell, connecting two opposite edges and going through the center. 1. A number overlapping a line indicates the length of that line. 2. A line can't overlap more than... | overflow | unrated |
| Tawamurenga | `tawa`, たわむれんが | shading | Shade several cells in the hexagonal grid. 1. Each shaded cell must have at least one shaded cell below it (unless it's on the bottom row). 2. There can not be a horizontal run of 3 or more shaded cells. 3.... | overflow | unrated |
| Tentaisho | `tentaisho`, 天体ショー | region | Divide the grid into regions. 1. Every region contains exactly one star. 2. Lines cannot go through stars. 3. Every region must be rotationally symmetric, with a star at the center. | 3.7 | Good / moderate |
| Tents | `tents`, Tents | placement | Place tents into some of the empty cells. 1. Every tent must be paired up with an orthogonally adjacent tree. 2. Tents cannot be horizontally, vertically or diagonally adjacent. 3. The numbers around the gri... | overflow | unrated |
| Tetrochain | `tetrochain`, テトロチェーン | shading | Place several tetrominoes (blocks of 4 cells) in the grid. 1. Tetrominoes cannot be orthogonally adjacent. 2. Tetrominoes cannot overlap a number. 3. A number indicates the amount of cells used by tetrominoe... | 1.31 | Poor / heavy |
| Tetrominous | `tetrominous`, Tetrominous | region | Divide the grid into tetrominoes (regions of 4 cells). You can use each tetromino any number of times (including zero). 1. Two adjacent tetrominoes cannot have the same shape, counting rotations and reflecti... | 3.9 | Workable / moderate |
| Tilepaint | `tilepaint`, タイルペイント | shading | You're given a grid divided into tiles. Shade some tiles on the board. 1. A tile is either completely shaded or unshaded. 2. A clue on the bottom of a cell indicates the amount of shaded cells below the clue... | overflow | unrated |
| Toichika | `toichika`, 遠い誓い | placement | Place an arrow in one cell of each country. Some arrows are given. 1. Two arrows which point toward each other form a pair. All arrows must be paired. 2. Paired arrows must not be in adjacent countries. 3. A... | 3.20 | Poor / cheap |
| Toichika 2 | `toichika2`, 遠い誓い２ | number | Place a number in one cell of each country. 1. If a country has a clue, the number must match the clue. Other countries can have any number. 2. A number must have an identical number in the same row or colum... | 3.20 | Good / cheap |
| Tontonbeya | `tontonbeya`, とんとんべや | placement | Place a triangle, square or circle in every empty cell. 1. All instances of the same symbol within a room must be adjacent. This is called a cluster. 2. A room can have 1, 2 or 3 different clusters. These mu... | overflow | unrated |
| Tonttiraja | `tontti`, Tonttiraja | region | Draw horizontal and vertical lines from the points to divide the grid into regions. You can connect two points, or draw from a point to the outer border. 1. Cells can contain a straight line, a corner or a T... | overflow | unrated |
| Touch Slitherlink | `tslither`, Touch Slitherlink | loop | Draw lines along the edges of some cells to form a loop. 1. The loop cannot branch off or cross itself. 2. A number indicates how many times the loop visits the set of edges and vertices adjacent to the cell. | 2.29 | unrated |
| Train Stations | `trainstations`, Train Stations | loop | Draw a loop that goes through every cell. 1. The loop cannot branch off or overlap. 2. All cells where the loop crosses itself are given. The loop cannot cross itself in other places. 3. Numbers denote train... | overflow | unrated |
| Tren | `tren`, パーキング | placement | Place several 1x2 and 1x3 blocks on the board, which don't overlap each other. 1. Each number is contained in a block. Blocks must contain exactly one number. 2. Horizontally oriented blocks can slide left a... | 3.11 | Workable / moderate |
| Tri-place | `triplace`, トリプレイス | region | Draw lines along the dotted lines to divide the grid into triminoes (blocks of 3 cells). 1. Clue cells are not part of any block. 2. A clue on the bottom of a cell indicates the amount of I-shaped blocks bel... | overflow | unrated |
| Uso-one | `usoone`, ウソワン | shading | You're given a board divided into region. Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. Numbers cannot be shaded. 3. A number indicates how many of the (up... | overflow | unrated |
| Uso-tatami | `usotatami`, ウソタタミ | region | Draw lines over the dotted lines to divide the board into several regions. 1. All regions must be a rectangle or square with a width of 1. 2. A region must have exactly one number. 3. A number must be differ... | 3.22 | unrated |
| Vertex Slitherlink | `vslither`, Vertex Slitherlink | loop | Draw lines along the edges of some cells to form a loop. 1. The loop cannot branch off or cross itself. 2. A number indicates the amount of vertices surrounding the cell that are visited by the loop. | 2.29 | unrated |
| View | `view`, ヴィウ | number | Place a number into some of the cells. Some numbers are given. 1. Each number is equal to the total number of empty cells that can be seen in a straight line vertically or horizontally. 2. Identical numbers... | overflow | unrated |
| Voxas | `voxas`, Voxas | region | Draw lines over the dotted lines to divide the board into several areas. Some lines are given. 1. All areas must be rectangular in shape, and must be 2 or 3 cells in size. 2. Two rectangles divided by a whit... | overflow | unrated |
| Wafusuma | `wafusuma`, 和フスマ | number | Divide the grid into regions. 1. A circle must divide two different regions. 2. A number on a circle indicates the sum of the sizes of the two adjacent regions. 3. Two regions of the same size cannot be orth... | overflow | unrated |
| Wagiri | `wagiri`, ごきげんななめ・輪切 | other | Draw a diagonal line in every cell, connecting two opposite corners. 1. A number indicates how many lines meet at that corner. 2. Cells with a '輪' must overlap a loop. 3. Cells with a '切' must not overlap a... | overflow | unrated |
| Wall Logic | `walllogic`, ウォールロジック | other | Draw one or more straight arrows extending from each clue. 1. Arrows may not cross or go through other clues. 2. A number indicates the sum of the lengths of the arrows extending from it. | overflow | unrated |
| Water Walk | `waterwalk`, ウォーターウォーク | loop | Draw a loop that goes through every numbered cell. 1. The loop cannot branch off or cross itself. 2. Blue cells represent water, while regular cells represent ground. The loop may not go through more than 2... | 2.29 | unrated |
| Wittgenstein Briquet | `wittgen`, Wittgenstein Briquet | placement | Place several rectangles of size 1x3 into the grid. 1. A number indicates the amount of rectangles in the 4 orthogonally adjacent cells. 2. Rectangles cannot overlap numbers. 3. All cells not used by rectang... | overflow | unrated |
| Yajilin | `yajilin`, ヤジリン, yajirin | loop | Shade some cells on the board, and draw a single loop that goes through all remaining cells. 1. The loop cannot branch off or cross itself. 2. Shaded cells cannot be orthogonally adjacent. 3. Cells with numb... | 2.4 | Workable / heavy |
| Yajisan-Kazusan | `yajikazu`, やじさんかずさん | shading | Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. A number indicates the amount of shaded cells in the given direction. If a clue is shaded, the number becomes... | overflow | unrated |
| Yajisan-Sokoban | `yajisoko`, やじさん倉庫番 | other | Draw lines to move some of the boxes. 1. A box can be moved horizontally or vertically, but cannot make a turn. 2. Movement lines cannot cross or overlap each other. Lines can also not go through the start-... | overflow | unrated |
| Yajitatami | `yajitatami`, ヤジタタミ | region | Draw lines over the dotted lines to divide the board into several regions. 1. All regions must be a rectangle or square with a width of 1 and a length of at least 2. 2. There must be a border immediately in... | 3.22 | unrated |
| Yin-Yang | `yinyang`, しろまるくろまる | placement | Place a black or white circle in every cell. Some circles are given. 1. All circles of the same color must be orthogonally contiguous. 2. There can not be a 2x2 square of all black or all white circles. | 1.7 | Good / moderate |
| Yosenabe | `yosenabe`, よせなべ | other | Draw lines to move every circle into one of the pots (denoted by a group of gray cells). 1. A circle can be moved horizontally or vertically, but cannot make a turn. 2. Movement lines cannot cross or overlap... | overflow | unrated |

### B. Logic Masters Deutschland Puzzlewiki, English category — 247 further genres

Every page in `Kategorie:Puzzletype/en` that is not already in table A. These are real,
documented genres, many of them variants of a table A genre (the Tapa and Battleship
families alone contribute a dozen). Rules were read for the ones marked; the rest say
"not read" and are listed because the names themselves are the idea bank.

| Genre (LMD Puzzlewiki page) | Aliases | Family | Rule core | Entry | CP-SAT verdict |
| --- | --- | --- | --- | --- | --- |
| 3x3 Patience | LMD `3x3_Patience/en` | not classified | not read | overflow | unrated |
| 4x4 Minesweeper | LMD `4x4_Minesweeper/en` | not classified | not read | overflow | unrated |
| ABC | LMD `ABC/en` | not classified | not read | overflow | unrated |
| ABC dissection | LMD `ABC_dissection/en` | not classified | not read | overflow | unrated |
| ABC Snake | LMD `ABC_Snake/en` | not classified | not read | overflow | unrated |
| ABCD Puzzle | LMD `ABCD_Puzzle/en` | not classified | not read | overflow | unrated |
| Akari Builder | LMD `Akari_Builder/en` | not classified | not read | overflow | unrated |
| Almost Simple Loop | LMD `Almost_Simple_Loop/en` | not classified | not read | overflow | unrated |
| Alphametik | LMD `Alphametik/en` | not classified | not read | overflow | unrated |
| Alternate Corners | LMD `Alternate_Corners/en` | not classified | not read | overflow | unrated |
| Alternative Loop | LMD `Alternative_Loop/en` | not classified | not read | overflow | unrated |
| Areasums | LMD `Areasums/en` | not classified | not read | overflow | unrated |
| Arrow Sudoku | LMD `Arrow_Sudoku/en` | not classified | not read | overflow | unrated |
| Arrow Web | LMD `Arrow_Web/en` | not classified | not read | overflow | unrated |
| Arrows | LMD `Arrows/en` | not classified | not read | overflow | unrated |
| Arrows with Numbers | LMD `Arrows_with_Numbers/en` | not classified | not read | overflow | unrated |
| As easy as ABC | LMD `As_easy_as_ABC/en` | not classified | not read | overflow | unrated |
| Banknotes | LMD `Banknotes/en` | not classified | not read | overflow | unrated |
| Basic | LMD `Basic/en` | not classified | not read | overflow | unrated |
| Battleships Crosswordreconstruction | LMD `Battleships_Crosswordreconstruction/en` | not classified | not read | overflow | unrated |
| Battleships Even/Odd | LMD `Battleships_Even/Odd/en` | not classified | not read | overflow | unrated |
| Battlestar | LMD `Battlestar/en` | not classified | not read | overflow | unrated |
| Bending Paths | LMD `Bending_Paths/en` | not classified | not read | overflow | unrated |
| Bent between | LMD `Bent_between/en` | not classified | not read | overflow | unrated |
| Black Domino | LMD `Black_Domino/en` | not classified | not read | overflow | unrated |
| Black Or White | LMD `Black_Or_White/en` | not classified | not read | overflow | unrated |
| Blackout Math | LMD `Blackout_Math/en` | not classified | not read | overflow | unrated |
| Boggle | LMD `Boggle/en` | not classified | not read | overflow | unrated |
| Briquet | LMD `Briquet/en` | not classified | not read | overflow | unrated |
| Build A Maze | LMD `Build_A_Maze/en` | not classified | not read | overflow | unrated |
| Calculations | LMD `Calculations/en` | not classified | not read | overflow | unrated |
| Capsules | LMD `Capsules/en` | not classified | not read | overflow | unrated |
| Catwalk | LMD `Catwalk/en` | not classified | not read | overflow | unrated |
| Chain Sudoku | LMD `Chain_Sudoku/en` | not classified | not read | overflow | unrated |
| Chaotic Skyscrapers | LMD `Chaotic_Skyscrapers/en` | not classified | not read | overflow | unrated |
| Chess placement | LMD `Chess_placement/en` | not classified | not read | overflow | unrated |
| Chess Sweeper | LMD `Chess_Sweeper/en` | not classified | not read | overflow | unrated |
| City loop | LMD `City_loop/en` | not classified | not read | overflow | unrated |
| Clockwise Words | LMD `Clockwise_Words/en` | not classified | not read | overflow | unrated |
| Compass Tapa | LMD `Compass_Tapa/en` | not classified | not read | overflow | unrated |
| Consecutive Sudoku | LMD `Consecutive_Sudoku/en` | not classified | not read | overflow | unrated |
| Corners Loop | LMD `Corners_Loop/en` | not classified | not read | overflow | unrated |
| Crack It On | LMD `Crack_It_On/en` | not classified | not read | overflow | unrated |
| Crapes | LMD `Crapes/en` | not classified | not read | overflow | unrated |
| Crisscross | LMD `Crisscross/en` | not classified | not read | overflow | unrated |
| Crossword | LMD `Crossword/en` | not classified | not read | overflow | unrated |
| Crosswordreconstruction | LMD `Crosswordreconstruction/en` | not classified | not read | overflow | unrated |
| Crosswordreconstruction Loop | LMD `Crosswordreconstruction_Loop/en` | not classified | not read | overflow | unrated |
| Daisho | LMD `Daisho/en` | not classified | not read | overflow | unrated |
| Dead End Cells | LMD `Dead_End_Cells/en` | not classified | not read | overflow | unrated |
| Diagonal Sudoku | LMD `Diagonal_Sudoku/en` | not classified | not read | overflow | unrated |
| Different Neighbours | LMD `Different_Neighbours/en` | not classified | not read | overflow | unrated |
| Digitile | LMD `Digitile/en` | not classified | not read | overflow | unrated |
| Dilemma | LMD `Dilemma/en` | not classified | not read | overflow | unrated |
| Dissection | LMD `Dissection/en` | not classified | not read | overflow | unrated |
| Domino Extra | LMD `Domino_Extra/en` | not classified | not read | overflow | unrated |
| Domino search | LMD `Domino_search/en` | not classified | not read | overflow | unrated |
| Dominosnake | LMD `Dominosnake/en` | not classified | not read | overflow | unrated |
| Dot-a-Pix | LMD `Dot-a-Pix/en` | not classified | not read | overflow | unrated |
| Dotami | LMD `Dotami/en` | not classified | not read | overflow | unrated |
| Dotted Skyscrapers | LMD `Dotted_Skyscrapers/en` | not classified | not read | overflow | unrated |
| Dotted Snake | LMD `Dotted_Snake/en` | not classified | not read | overflow | unrated |
| Double Easy As ABC | LMD `Double_Easy_As_ABC/en` | not classified | not read | overflow | unrated |
| Double Minesweeper | LMD `Double_Minesweeper/en` | not classified | not read | overflow | unrated |
| Doublemaze | LMD `Doublemaze/en` | not classified | not read | overflow | unrated |
| Easy As ABC Sudoku | LMD `Easy_As_ABC_Sudoku/en` | not classified | not read | overflow | unrated |
| Easy As ABCDot | LMD `Easy_As_ABCDot/en` | not classified | not read | overflow | unrated |
| Easy As Battleships | LMD `Easy_As_Battleships/en` | not classified | not read | overflow | unrated |
| Easy As Coralfinder | LMD `Easy_As_Coralfinder/en` | not classified | not read | overflow | unrated |
| Easy As Skyscrapers | LMD `Easy_As_Skyscrapers/en` | not classified | not read | overflow | unrated |
| Easy As Tapa | LMD `Easy_As_Tapa/en` | not classified | not read | overflow | unrated |
| EGER Loop | LMD `EGER_Loop/en` | not classified | not read | overflow | unrated |
| Elastic Bands | LMD `Elastic_Bands/en` | not classified | not read | overflow | unrated |
| Encoded Tapa | LMD `Encoded_Tapa/en` | not classified | not read | overflow | unrated |
| Enter-Exit | LMD `Enter-Exit/en` | not classified | not read | overflow | unrated |
| Escher maze | LMD `Escher_maze/en` | not classified | not read | overflow | unrated |
| Even-not-even-diagonally-Rundweg | LMD `Even-not-even-diagonally-Rundweg/en` | not classified | not read | overflow | unrated |
| Even/odd Sudoku | LMD `Even/odd_Sudoku/en` | not classified | not read | overflow | unrated |
| False Fences | LMD `False_Fences/en` | not classified | not read | overflow | unrated |
| False Kakuro | LMD `False_Kakuro/en` | not classified | not read | overflow | unrated |
| False Skyscrapers | LMD `False_Skyscrapers/en` | not classified | not read | overflow | unrated |
| Fill-a-Pix | LMD `Fill-a-Pix/en` | not classified | not read | overflow | unrated |
| Fillomino Skyscrapers | LMD `Fillomino_Skyscrapers/en` | not classified | not read | overflow | unrated |
| First or Last Easy As ABC | LMD `First_or_Last_Easy_As_ABC/en` | not classified | not read | overflow | unrated |
| Fishermen At War | LMD `Fishermen_At_War/en` | not classified | not read | overflow | unrated |
| Five Letters | LMD `Five_Letters/en` | not classified | not read | overflow | unrated |
| Four Snails | LMD `Four_Snails/en` | not classified | not read | overflow | unrated |
| Four Winds | LMD `Four_Winds/en` | not classified | not read | overflow | unrated |
| Frameless Sudoku | LMD `Frameless_Sudoku/en` | not classified | not read | overflow | unrated |
| From 1 to n (areas) | LMD `From_1_to_n_(areas)/en` | not classified | not read | overflow | unrated |
| From 1 to n (arrows) | LMD `From_1_to_n_(arrows)/en` | not classified | not read | overflow | unrated |
| Futoshiki | LMD `Futoshiki/en` | not classified | not read | overflow | unrated |
| Gapped Kakuro | LMD `Gapped_Kakuro/en` | not classified | not read | overflow | unrated |
| Gappy Skyscrapers | LMD `Gappy_Skyscrapers/en` | not classified | not read | overflow | unrated |
| Graffiti | LMD `Graffiti/en` | not classified | not read | overflow | unrated |
| Greater Than Diagonal Sudoku | LMD `Greater_Than_Diagonal_Sudoku/en` | not classified | not read | overflow | unrated |
| Haido Skyscrapers | LMD `Haido_Skyscrapers/en` | not classified | not read | overflow | unrated |
| Half Dominoes | LMD `Half_Dominoes/en` | not classified | not read | overflow | unrated |
| Halved Squares Sudoku | LMD `Halved_Squares_Sudoku/en` | not classified | not read | overflow | unrated |
| Hamilton maze | LMD `Hamilton_maze/en` | not classified | not read | overflow | unrated |
| Hexa Islands | LMD `Hexa_Islands/en` | not classified | not read | overflow | unrated |
| Hexagonal fences | LMD `Hexagonal_fences/en` | not classified | not read | overflow | unrated |
| Honeycomb | LMD `Honeycomb/en` | not classified | not read | overflow | unrated |
| Horse Snake | LMD `Horse_Snake/en` | not classified | not read | overflow | unrated |
| Hundred | LMD `Hundred/en` | not classified | not read | overflow | unrated |
| Hungarian Tapa | LMD `Hungarian_Tapa/en` | not classified | not read | overflow | unrated |
| Hunted | LMD `Hunted/en` | not classified | not read | overflow | unrated |
| In-Out | LMD `In-Out/en` | not classified | not read | overflow | unrated |
| Increase | LMD `Increase/en` | not classified | not read | overflow | unrated |
| Irregular Easy As ABC | LMD `Irregular_Easy_As_ABC/en` | not classified | not read | overflow | unrated |
| Irregular Skyscrapers | LMD `Irregular_Skyscrapers/en` | not classified | not read | overflow | unrated |
| Irregular Sudoku | LMD `Irregular_Sudoku/en` | not classified | not read | overflow | unrated |
| Irregular Tapa | LMD `Irregular_Tapa/en` | not classified | not read | overflow | unrated |
| Japanese Battleships | LMD `Japanese_Battleships/en` | not classified | not read | overflow | unrated |
| Japanese Loop | LMD `Japanese_Loop/en` | not classified | not read | overflow | unrated |
| Japanese sums | LMD `Japanese_sums/en` | not classified | not read | overflow | unrated |
| Japanese Sums Battleships | LMD `Japanese_Sums_Battleships/en` | not classified | not read | overflow | unrated |
| Jumping Crossword | LMD `Jumping_Crossword/en` | not classified | not read | overflow | unrated |
| Kaku Rouge | LMD `Kaku_Rouge/en` | not classified | not read | overflow | unrated |
| Kakuro Equations | LMD `Kakuro_Equations/en` | not classified | not read | overflow | unrated |
| Killer Sudoku | LMD `Killer_Sudoku/en` | not classified | not read | overflow | unrated |
| Laser | LMD `Laser/en` | not classified | not read | overflow | unrated |
| Liar Loop | LMD `Liar_Loop/en` | not classified | not read | overflow | unrated |
| Liar Slitherlink | LMD `Liar_Slitherlink/en` | not classified | not read | overflow | unrated |
| Lighthouses | LMD `Lighthouses/en` | not classified | not read | overflow | unrated |
| Lines | LMD `Lines/en` | not classified | not read | overflow | unrated |
| Link-a-Pix | LMD `Link-a-Pix/en` | not classified | not read | overflow | unrated |
| Longest Loop | LMD `Longest_Loop/en` | not classified | not read | overflow | unrated |
| Looper | LMD `Looper/en` | not classified | not read | overflow | unrated |
| Loopfinder | LMD `Loopfinder/en` | not classified | not read | overflow | unrated |
| Lost Sums | LMD `Lost_Sums/en` | not classified | not read | overflow | unrated |
| Magic Pyramid | LMD `Magic_Pyramid/en` | not classified | not read | overflow | unrated |
| Magic Square With Words | LMD `Magic_Square_With_Words/en` | not classified | not read | overflow | unrated |
| Magic Summer | LMD `Magic_Summer/en` | not classified | not read | overflow | unrated |
| Magicmaze | LMD `Magicmaze/en` | not classified | not read | overflow | unrated |
| Majilin | LMD `Majilin/en` | not classified | not read | overflow | unrated |
| Mastermind | LMD `Mastermind/en` | not classified | not read | overflow | unrated |
| Mastermind Tapa | LMD `Mastermind_Tapa/en` | not classified | not read | overflow | unrated |
| Masyu-Slitherlink | LMD `Masyu-Slitherlink/en` | not classified | not read | overflow | unrated |
| Masyudoku | LMD `Masyudoku/en` | number | Fill some cells with digits 1..6 so each appears once per row, column and region; every cell not filled with a digit is traversed by a Masyu loop. A published Sudoku hybrid genre in its own right. | overflow | unrated |
| Matches | LMD `Matches/en` | not classified | not read | overflow | unrated |
| Matchmaker | LMD `Matchmaker/en` | not classified | not read | overflow | unrated |
| Math Square | LMD `Math_Square/en` | not classified | not read | overflow | unrated |
| Maze-a-Pix | LMD `Maze-a-Pix/en` | not classified | not read | overflow | unrated |
| Naval Minesweeper | LMD `Naval_Minesweeper/en` | not classified | not read | overflow | unrated |
| New Style Crossword | LMD `New_Style_Crossword/en` | not classified | not read | overflow | unrated |
| Non Consecutive Kakuro | LMD `Non_Consecutive_Kakuro/en` | not classified | not read | overflow | unrated |
| Nontouching Easy As ABC | LMD `Nontouching_Easy_As_ABC/en` | not classified | not read | overflow | unrated |
| Nontouching Skyscrapers | LMD `Nontouching_Skyscrapers/en` | not classified | not read | overflow | unrated |
| Nontouching Sudoku | LMD `Nontouching_Sudoku/en` | not classified | not read | overflow | unrated |
| Number maze | LMD `Number_maze/en` | not classified | not read | overflow | unrated |
| Number Sea | LMD `Number_Sea/en` | not classified | not read | overflow | unrated |
| Number spiral | LMD `Number_spiral/en` | not classified | not read | overflow | unrated |
| Number Stairs | LMD `Number_Stairs/en` | not classified | not read | overflow | unrated |
| Numerical Battleships | LMD `Numerical_Battleships/en` | not classified | not read | overflow | unrated |
| Nurikabe Loop | LMD `Nurikabe_Loop/en` | not classified | not read | overflow | unrated |
| Octagon Word Snake | LMD `Octagon_Word_Snake/en` | not classified | not read | overflow | unrated |
| ORuKakuro | LMD `ORuKakuro/en` | not classified | not read | overflow | unrated |
| Outside Sudoku | LMD `Outside_Sudoku/en` | not classified | not read | overflow | unrated |
| P-Pentomino dissection | LMD `P-Pentomino_dissection/en` | not classified | not read | overflow | unrated |
| Paint By 3 | LMD `Paint_By_3/en` | not classified | not read | overflow | unrated |
| Paint By Numbers | LMD `Paint_By_Numbers/en` | not classified | not read | overflow | unrated |
| Pairs By Sums | LMD `Pairs_By_Sums/en` | not classified | not read | overflow | unrated |
| Palindrome Sudoku | LMD `Palindrome_Sudoku/en` | not classified | not read | overflow | unrated |
| Paper Ships | LMD `Paper_Ships/en` | not classified | not read | overflow | unrated |
| Parthenon | LMD `Parthenon/en` | not classified | not read | overflow | unrated |
| Pathfinder Snake | LMD `Pathfinder_Snake/en` | not classified | not read | overflow | unrated |
| Penta-Gluing | LMD `Penta-Gluing/en` | not classified | not read | overflow | unrated |
| Pentapa | LMD `Pentapa/en` | not classified | not read | overflow | unrated |
| Pentominesweeper | LMD `Pentominesweeper/en` | not classified | not read | overflow | unrated |
| Pentomino Borders | LMD `Pentomino_Borders/en` | not classified | not read | overflow | unrated |
| Pentomino Dissection | LMD `Pentomino_Dissection/en` | not classified | not read | overflow | unrated |
| Pentomino Fences | LMD `Pentomino_Fences/en` | not classified | not read | overflow | unrated |
| Pentomino Paint By Numbers | LMD `Pentomino_Paint_By_Numbers/en` | not classified | not read | overflow | unrated |
| Pentomino Puddles | LMD `Pentomino_Puddles/en` | not classified | not read | overflow | unrated |
| Pentomino Restore | LMD `Pentomino_Restore/en` | not classified | not read | overflow | unrated |
| Pentomino Shikaku | LMD `Pentomino_Shikaku/en` | not classified | not read | overflow | unrated |
| Pentomino sums | LMD `Pentomino_sums/en` | not classified | not read | overflow | unrated |
| Pentominosearch | LMD `Pentominosearch/en` | not classified | not read | overflow | unrated |
| Pentoroll | LMD `Pentoroll/en` | not classified | not read | overflow | unrated |
| Pills | LMD `Pills/en` | not classified | not read | overflow | unrated |
| Pipe Fiction | LMD `Pipe_Fiction/en` | not classified | not read | overflow | unrated |
| Pointing At The Crowd | LMD `Pointing_At_The_Crowd/en` | not classified | not read | overflow | unrated |
| Polygraph | LMD `Polygraph/en` | not classified | not read | overflow | unrated |
| Products | LMD `Products/en` | not classified | not read | overflow | unrated |
| Psycho Killer | LMD `Psycho_Killer/en` | not classified | not read | overflow | unrated |
| Pyramid | LMD `Pyramid/en` | not classified | not read | overflow | unrated |
| Quad Max Sudoku | LMD `Quad_Max_Sudoku/en` | not classified | not read | overflow | unrated |
| Quadrant Battleships | LMD `Quadrant_Battleships/en` | not classified | not read | overflow | unrated |
| Quadruple Sudoku | LMD `Quadruple_Sudoku/en` | not classified | not read | overflow | unrated |
| Radar | LMD `Radar/en` | not classified | not read | overflow | unrated |
| Radioactive Four Winds | LMD `Radioactive_Four_Winds/en` | not classified | not read | overflow | unrated |
| Rectangular dissection | LMD `Rectangular_dissection/en` | not classified | not read | overflow | unrated |
| Rekuto | LMD `Rekuto/en` | not classified | not read | overflow | unrated |
| Relation Fences | LMD `Relation_Fences/en` | not classified | not read | overflow | unrated |
| Renban Grouped Windoku | LMD `Renban_Grouped_Windoku/en` | not classified | not read | overflow | unrated |
| Retrograde Battleships | LMD `Retrograde_Battleships/en` | not classified | not read | overflow | unrated |
| Scales | LMD `Scales/en` | not classified | not read | overflow | unrated |
| Searchdoku | LMD `Searchdoku/en` | not classified | not read | overflow | unrated |
| Second Easy As ABC | LMD `Second_Easy_As_ABC/en` | not classified | not read | overflow | unrated |
| Sightseeing Tour | LMD `Sightseeing_Tour/en` | not classified | not read | overflow | unrated |
| Single Letter | LMD `Single_Letter/en` | not classified | not read | overflow | unrated |
| Sky of stars | LMD `Sky_of_stars/en` | not classified | not read | overflow | unrated |
| Skyscrapers Either/Or | LMD `Skyscrapers_Either/Or/en` | not classified | not read | overflow | unrated |
| Skyscrapers Sudoku | LMD `Skyscrapers_Sudoku/en` | not classified | not read | overflow | unrated |
| Slalom | LMD `Slalom/en`; = Gokigen Naname, Slant | other | Put a diagonal wall into every cell so that no completely closed area occurs; a circled number counts the walls touching that vertex. **Name collision:** this LMD genre is Gokigen Naname, while puzz.link's `slalom` is a different gate-ordering loop genre. | 2.23 (as Gokigen) | Workable / cheap |
| Snail Sudoku | LMD `Snail_Sudoku/en` | not classified | not read | overflow | unrated |
| Spiral Battleships | LMD `Spiral_Battleships/en` | not classified | not read | overflow | unrated |
| Spokes | LMD `Spokes/en` | not classified | not read | overflow | unrated |
| Step By Step | LMD `Step_By_Step/en` | not classified | not read | overflow | unrated |
| Sudoku Builder | LMD `Sudoku_Builder/en` | not classified | not read | overflow | unrated |
| Sudokuro | LMD `Sudokuro/en` | not classified | not read | overflow | unrated |
| Sum Skyscrapers | LMD `Sum_Skyscrapers/en` | not classified | not read | overflow | unrated |
| Sum Snake | LMD `Sum_Snake/en` | not classified | not read | overflow | unrated |
| Symbolism | LMD `Symbolism/en` | not classified | not read | overflow | unrated |
| Symmetric Unequal Sudoku | LMD `Symmetric_Unequal_Sudoku/en` | not classified | not read | overflow | unrated |
| Symmetrical even-odd Sudoku | LMD `Symmetrical_even-odd_Sudoku/en` | not classified | not read | overflow | unrated |
| Symmetry | LMD `Symmetry/en` | not classified | not read | overflow | unrated |
| Tank | LMD `Tank/en` | not classified | not read | overflow | unrated |
| Tapa Borders | LMD `Tapa_Borders/en` | not classified | not read | overflow | unrated |
| Tapa Chess | LMD `Tapa_Chess/en` | not classified | not read | overflow | unrated |
| Tapa Distiller | LMD `Tapa_Distiller/en` | not classified | not read | overflow | unrated |
| Tapa Line | LMD `Tapa_Line/en` | not classified | not read | overflow | unrated |
| Tapa Logic | LMD `Tapa_Logic/en` | not classified | not read | overflow | unrated |
| Tapa Place | LMD `Tapa_Place/en` | not classified | not read | overflow | unrated |
| Tapa Rectangles | LMD `Tapa_Rectangles/en` | not classified | not read | overflow | unrated |
| Tetris dissection | LMD `Tetris_dissection/en` | not classified | not read | overflow | unrated |
| Thermo-Sudoku | LMD `Thermo-Sudoku/en` | not classified | not read | overflow | unrated |
| Thermometer-Yin Yang | LMD `Thermometer-Yin_Yang/en` | not classified | not read | overflow | unrated |
| Thermometers | LMD `Thermometers/en` | not classified | not read | overflow | unrated |
| Tiger In The Woods | LMD `Tiger_In_The_Woods/en` | not classified | not read | overflow | unrated |
| TomTom | LMD `TomTom/en` | not classified | not read | overflow | unrated |
| Top-Heavy Number Place | LMD `Top-Heavy_Number_Place/en` | not classified | not read | overflow | unrated |
| Train Loop | LMD `Train_Loop/en` | not classified | not read | overflow | unrated |
| Trid | LMD `Trid/en` | not classified | not read | overflow | unrated |
| Triplets | LMD `Triplets/en` | not classified | not read | overflow | unrated |
| Turning Fences | LMD `Turning_Fences/en` | not classified | not read | overflow | unrated |
| Underground | LMD `Underground/en` | not classified | not read | overflow | unrated |
| Unknown Fleet | LMD `Unknown_Fleet/en` | not classified | not read | overflow | unrated |
| Vabyrinth | LMD `Vabyrinth/en` | not classified | not read | overflow | unrated |
| Var-Yok | LMD `Var-Yok/en` | not classified | not read | overflow | unrated |
| Watches | LMD `Watches/en` | not classified | not read | overflow | unrated |
| Wind Distances | LMD `Wind_Distances/en` | not classified | not read | overflow | unrated |
| Word Search | LMD `Word_Search/en` | not classified | not read | overflow | unrated |
| XO | LMD `XO/en` | not classified | not read | overflow | unrated |
| Yajilin Plus | LMD `Yajilin_Plus/en` | not classified | not read | overflow | unrated |
| Zigzag path | LMD `Zigzag_path/en` | not classified | not read | overflow | unrated |

### C. GM Puzzles, the WPC unofficial wiki, and setter sources — 26 further genres

Genres encountered outside puzz.link and the LMD wiki. The GM Puzzles rows are that
site's own standing categories, which are largely sudoku variants and so sit in the
number family; the WPC rows are competition hybrids that show how these rule sets get
combined in practice.

| Genre | Aliases / source | Family | Rule core | Entry | CP-SAT verdict |
| --- | --- | --- | --- | --- | --- |
| Arrow Sudoku | GM Puzzles category (72 posts) | number | A circled cell holds the sum of the digits along its arrow. A standard variant-sudoku constraint. | overflow | unrated |
| Battleship Sudoku | GM Puzzles category (7 posts); 2007 Sudoku Championship IB | placement | Sudoku and Battleships on one grid, each clue set feeding the other. | 1.25 | Good / cheap |
| Consecutive Pairs Sudoku | GM Puzzles category (40 posts) | number | Marked adjacent pairs hold consecutive digits; only marked pairs do. | overflow | unrated |
| Deficit / Surplus Sudoku | GM Puzzles category (9 posts) | number | Regions hold fewer or more cells than the digit range, so some digits are missing or repeated. | overflow | unrated |
| Even/Odd Sudoku | GM Puzzles category (48 posts) | number | Marked cells are constrained to even or to odd digits. | overflow | unrated |
| Every Second Turn | Alternate Corners; Puzzle Duel dailies 2025; Fit For Puzzle catalogue | loop | not read — rules not found at a primary source (see 2.28) | 2.28 | unrated |
| Galaxies and Pentominoes | WPC 2018 R6, Jiří Hrdina (WPC wiki) | region | Place the twelve pentominoes so none touch even diagonally, with outside counts; divide the remaining cells into rotationally symmetric regions each holding one dot. | overflow | unrated |
| Galaxies and Tetrominoes | WPC 2018 R6 / Individual Playoffs, Jiří Hrdina (WPC wiki) | region | As Galaxies and Pentominoes, with the tetromino set. | overflow | unrated |
| Japanese Sums | GM Puzzles category (30 posts) | number | Outside clues give, in order, the sums of the blocks of digits in that line, separated by blanks. The number-placement twin of Cross the Streams. | overflow | unrated |
| Just One Cell Sudoku | GM Puzzles category (42 posts) | number | Solve for a single named cell rather than the whole grid. A presentation format, not a rule set. | overflow | unrated |
| Killer Sudoku | GM Puzzles category (49 posts) | number | Caged cells sum to the cage clue and do not repeat. | overflow | unrated |
| Linesweeper | WPC 2019 IB via WPC wiki; Jak Marshall 2010 | loop | A closed loop through each cell at most once, never through a numbered cell; a number counts the loop cells among its 8 neighbours. | 2.27 | Good / moderate |
| Loop de Loop | Fit For Puzzle catalogue | loop | not read — rules not found at a primary source (see 2.28) | 2.28 | unrated |
| Necklace (speed-setting ruleset) | Cracking The Cryptic Discord, via swaroopg92 | loop | Shade cells into one connected region with no full 2x2; draw a non-intersecting loop whose path alternates between shaded and unshaded cells. | overflow | unrated |
| Outside Sudoku | GM Puzzles category (15 posts) | number | Digits outside the grid appear somewhere in the first three cells of that row or column. | overflow | unrated |
| Pata | Tapa variant, via swaroopg92 | shading | Tapa with the clue counting *unshaded* runs among the 8 neighbours; clue cells count as unshaded. | overflow | unrated |
| Regional Yajilin | Yajilin (regions); GridPuzzle; Puzzle Duel dailies | loop | Shade cells and loop through all white cells; a region number counts its shaded cells; shaded cells never share a border. **Rules unverified at a primary source** (see 2.28). | 2.28 | Good / heavy [unverified rules] |
| Shape Sudoku | GM Puzzles category (18 posts) | number | Shapes stand in for digit sets or constraints on their cells. | overflow | unrated |
| Skyscrapers | GM Puzzles category (132 posts); also puzz.link `skyscrapers` | number | Outside clues count the visible increasing digits in that line. | overflow | unrated |
| Spiral Galaxies squared | WPC 2017 R20, Rohan Rao (WPC wiki) | region | Spiral Galaxies where some cells belong to no region, and the used cells together form one connected, 180-degree symmetric area. | overflow | unrated |
| Starwacky | WPC 2018 R6, Jan Zvěřina (WPC wiki) | placement | Star Battle with non-rectangular regions plus Heyawake's rule: a straight line without a star may not cross more than one thick border. | overflow | unrated |
| Statue Park Twilight | CTC Discord speed-setting, via swaroopg92 | region | Statue Park with a double pentomino set, where number clues act as Minesweeper clues over the circles. | 3.10 | Workable / heavy |
| Tight Fit Sudoku | GM Puzzles category (50 posts) | number | Split cells hold two digits, read as the smaller then the larger. | overflow | unrated |
| TomTom | GM Puzzles category (150 posts) | number | Cages carry a target and an operation; the caged digits combine to it. A Latin-square genre. | overflow | unrated |
| Twilight Cave | WPC 2019 IB p. 48, via LMD 000ALC | shading | Cave where a number clue may itself be shaded and then gives the size of its connected shaded group. | 1.11 | Good / moderate |
| Thermo-Sudoku | GM Puzzles category (76 posts) | number | Digits increase along each thermometer from its bulb. | overflow | unrated |


## Sources read

(running list, appended as each URL is read)

- https://puzz.link/rules.html — JS-rendered, no text served to a fetcher. Unusable.
- https://puzz.link/list.html — genre index, mostly JS-rendered; only a handful of names served.
- https://www.gmpuzzles.com/blog/rules/ — sidebar only; genre categories recovered, rules text not on this page.
- https://gapp-puzzles.com/ — GAPP is a daily pencil-puzzle series on the Cracking The Cryptic Discord, not a rules index. No per-genre rules pages found.
- https://wiki.logic-masters.de/index.php/Hauptseite — LMD Puzzlewiki index: 844 puzzle types, English pages at `/index.php/<Name>/en`. This is the workhorse source.
- https://wiki.logic-masters.de/index.php/Nurikabe/en
- https://wiki.logic-masters.de/index.php/Hitori/en
- https://wiki.logic-masters.de/index.php/LITS/en
- https://wiki.logic-masters.de/index.php/Tapa/en
- https://wiki.logic-masters.de/index.php/Heyawake/en
- https://wiki.logic-masters.de/index.php/Shakashaka/en
- https://wiki.logic-masters.de/index.php/Minesweeper/en
- LMD portal, Nurikabe hybrids (search "Nurikabe Sudoku"): IDs 000MU6, 000DZI, 000IHU, 000B4H, 00043P
- https://puzz.link/js/pzpr-samples/<pid>.js — **the find of this run.** puzz.link's rules
  page is JS-rendered and unfetchable, but the underlying data files are plain JS and
  serve the canonical English rules text for every genre the pzpr engine implements.
  244 genre ids were read out of `https://puzz.link/list.html` (`data-pid` attributes,
  grouped by family) and 242 rules texts parsed. This is the primary rules source for
  every genre below that is marked "puzz.link".
- https://wiki.logic-masters.de/api.php — MediaWiki API on the LMD Puzzlewiki; raw
  wikitext at `index.php?title=<Page>/en&action=raw`. Used for genres puzz.link words
  loosely, and for German-tradition genres puzz.link does not carry.
- https://wiki.logic-masters.de/index.php/Kuromasu/en, /Yin_Yang/en, /Norinori/en,
  /Akari/en, /Caves/en, /Coralfinder/en
- https://www.nikoli.co.jp/en/puzzles/heyawake/ (via search result excerpt)
- https://www.puzzles.wiki/wiki/Star_Battle
- https://wpcunofficial.miraheze.org/wiki/Star_Battle
- LMD portal hybrid searches (see each genre entry for the puzzle IDs found)
- https://logic-masters.de/Raetselportal/?chlang=en — the portal's own genre tag list,
  which is itself evidence of which pencil genres are routinely combined with Sudoku
  there (it carries tags for Cave, Coral, Country Road, Fillomino, Galaxies, Geradeweg,
  Hakyuu, Heyawake, Hitori, Kuromasu, Kurotto, LITS, Masyu, Mid-loop, Minesweeper,
  Moon-or-Sun, Myopia, Nanro, Nonogram, Norinori, Number Link, Nurikabe, Nurimisaki,
  Pentominous, Pentopia, Sashigane, Shakashaka, Shikaku, Shimaguni, Slitherlink, Snake,
  Star Battle, Stostone, Tapa, Yajilin, Yin and Yang, among others).

---

# 1. Shading puzzles

The decision layer is one bit per cell. That is the cheapest possible extra layer to
add to a CP-SAT model — 81 booleans — and it is the family with by far the most existing
Sudoku hybrid practice. The cost in this family is almost never the shading itself; it is
whatever connectivity, shape or sight rule sits on top of it.

## 1.1 Nurikabe (ぬりかべ; "Islands in the Stream", "Cell Structure")

**Rules** (https://puzz.link/js/pzpr-samples/nurikabe.js): "Shade some cells on the
board to form regions of unshaded cells. 1. Each region contains exactly one number.
2. A number indicates the size of the region that contains it. 3. You cannot shade a
cell with a number. 4. The shaded cells cannot form a 2x2 square. 5. All shaded cells
form an orthogonally contiguous area." The LMD wiki adds the corollary that white
areas may touch each other only diagonally
(https://wiki.logic-masters.de/index.php/Nurikabe/en). Nikoli, from Puzzle
Communication Nikoli vol. 33.

**Structure.** Decision: binary shade per cell. Global: one connected shaded set, no
2x2 shaded, unshaded set partitions into islands. Clues: a size number inside an
island, exactly one per island.

**Sudoku hybrid suitability under the CP-SAT lens: Good — model it.**

*Variables.* 81 digit ints `x[p]` in 1..9; 81 shading bools `w[p]` (water);
for the island layer, 81 region-id ints `rid[p]` in 0..80 and 81 root bools,
exactly the fillomino shape. Water connectivity wants its own single-commodity
flow: 288 directed-arc ints plus one water root.

*Expensive globals.* Two connectivity proofs at once, in opposite directions.
Water is one connected set — single-commodity flow to a root over water arcs,
per `docs/research/fillomino-cpsat.md`. Islands are *many* connected sets with
sizes — that is the fillomino problem exactly, and the fillomino trick does not
transfer unmodified, because Nurikabe has no "equal sizes may not touch" rule to
make components derivable from the digits. You need real `rid` variables with a
second flow whose root emits the island size. No-2x2 on water is 64 window
constraints, trivial. One-clue-per-island is a linear sum over `root` bools.

*Size and cost on 9x9.* Roughly 81+81+81 ints, ~160 bools, ~576 flow ints across
two networks, plus the sudoku core. **Heavy** — the only entry in the survey
needing two flow networks, and the island flow's emit value is a variable
(the size), which is the part that made fillomino's worst proof 69 s.

*Digit coupling.* Native and strong, which is why it is worth the cost. Island
size equals the digit in its clue cell: `emit == x[root]`, one line, the same
device fillomino uses. "No repeats within an island" is an AllDifferent over a
variable-membership set, which does *not* express directly — encode it as
pairwise `x[p] != x[q]` reified on "same rid", 3240 reified pairs if written
naively, so restrict it to pairs within a bounded window or drop it. Island digit
sums are linear over reified membership. Parity coupling (water odd, island even)
is one linear constraint per cell and costs nothing.

*Verdict.* **Good.** The coupling is the best in the family and the encoding is
known; budget for a slow uniqueness proof and keep the 600 s cap with
`TimeoutError` treated as no verdict.

**Existing hybrids:** abundant, and the tightest-integrated hybrids in the whole survey.
- *Colossal Nurikabe Sudoku*, LMD 000DZI
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000DZI):
  "the digit in each cell of the Sudoku grid must equal the number of land cells in the
  corresponding 3x3 box in the Nurikabe", with clues ambiguous between land-size clues
  and water-visibility clues.
- *How Far I'll Go (Nurikabe Sudoku)*, LMD 000IHU
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000IHU):
  digits may not repeat within an island; each island's clue gives (island digit sum) x
  (island size); arrow cells count island cells in the arrow directions. The setter
  says "Nurikabe/sudoku hybrids are what truly made me fall in love with variant sudoku".
- *Dodekanesos (Sudoku Nurikabe hybrid)*, LMD 000B4H
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000B4H):
  cage clue = island digit sum; all island cells even, all water cells odd.
- *Nurikabe Sudoku*, LMD 000MU6
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000MU6): from the OUCH!
  series on the Cracking The Cryptic Discord; arrow cells count shaded cells visible in
  the arrow directions.
- Non-sudoku but relevant as a genre-fusion precedent: *Tapa / Nurikabe*, LMD 00043P
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=00043P), one
  grid solvable under either ruleset.

## 1.2 Hitori (ひとりにしてくれ, "Hitori ni shite kure")

**Rules** (https://puzz.link/js/pzpr-samples/hitori.js): "Shade some cells on the board.
1. Shaded cells cannot be horizontally or vertically adjacent. 2. A row or column may
not contain two unshaded cells with identical numbers. 3. All unshaded cells on the
board form an orthogonally connected area." Nikoli vol. 29. LMD wiki agrees
(https://wiki.logic-masters.de/index.php/Hitori/en).

**Structure.** Decision: binary shade. Global: shaded cells non-adjacent, unshaded set
connected. Clues: the grid is pre-filled with numbers; there is no separate clue layer.

**Sudoku hybrid suitability under the CP-SAT lens: Poor.**

*Variables.* 81 digits, 81 shading bools, plus a flow network for white
connectivity.

*Expensive globals.* White connectivity (one flow, 288 arc ints); shaded
non-adjacency is 144 binary clauses, free.

*Size and cost.* Cheap to state, **cheap** to solve.

*Digit coupling.* This is where it dies. Hitori's content is rule 2, "no two
unshaded cells with identical numbers in a row or column", and on a Sudoku grid
that constraint is implied by the sudoku itself — the model would post 648 clauses
that presolve deletes as trivially satisfied. The generator would then be sampling
a sudoku with a free, almost unconstrained shading, and the uniqueness check would
report enormous solution counts on the shading layer.

*Verdict.* **Poor.** Not a modelling difficulty, a modelling *vacuity*: there is
nothing for the solver to decide. The inverted form (a larger given grid whose
unshaded survivors form a latin square) is a different puzzle and a different model.

**Existing hybrids:** LMD carries a Hitori tag and the wiki carries composite genres
*Kuromasu-Hitori* (https://wiki.logic-masters.de/index.php/Kuromasu-Hitori) and
*Rundweg-Hitori* (https://wiki.logic-masters.de/index.php/Rundweg-Hitori), i.e. Hitori
crossed with Kuromasu and with a loop genre, not with Sudoku. No Hitori x Sudoku hybrid
found (searched: LMD portal for "Hitori Sudoku", GM Puzzles, general web). The
vacuousness argument above is the likely reason. [Hybrid absence verified by search
only, so: unverified as an absolute claim.]

## 1.3 LITS (formerly ヌルオミノ "Nuruomino")

**Rules** (https://puzz.link/js/pzpr-samples/lits.js): "Place a tetromino (a block of 4
cells) in every outlined region. 1. There can not be a 2x2 square of cells occupied by
tetrominoes. 2. Two identical tetrominoes cannot share an edge, counting rotations and
reflections as the same. 3. All tetrominoes form an orthogonally contiguous area."
Nikoli vol. 104. The LMD wiki phrasing is equivalent
(https://wiki.logic-masters.de/index.php/LITS/en), and a portal classic states the
shape-adjacency rule explicitly
(https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=0003CM).

**Structure.** Decision: binary shade, but constrained to exactly four per region
forming an L/I/T/S tetromino. Global: connected shaded set, no 2x2 shaded, no two
edge-adjacent congruent tetrominoes. Clues: the region partition itself is the clue;
classic LITS has no numbers at all.

**Sudoku hybrid suitability under the CP-SAT lens: Workable, and cheap to encode.**

*Variables.* 81 digits, 81 shading bools, and — the useful move — one bool per
*placement* rather than per cell. With the nine boxes as regions there are 19
tetromino placements in a 3x3 box; 9 boxes x 19 = 171 placement bools, with
`AddExactlyOne` per box and a channelling constraint tying each placement to its
four cells. That is a much better encoding than shape-detection over raw shading
bools, and it makes rule 2 (adjacent congruent tetrominoes banned) a direct
pairwise clause over placement bools: enumerate the offending placement pairs
across each box border once, in Python, and post them as clauses.

*Expensive globals.* One connectivity proof over the 36 shaded cells — single
flow, 288 arc ints. No-2x2 is 64 windows. Nothing else.

*Size and cost on 9x9.* ~171 placement bools + 81 shading bools + 288 flow ints.
**Cheap to moderate.** The placement encoding collapses most of the search before
the solver starts.

*Digit coupling.* Not native — the genre has no numbers. Everything must be added:
tetromino digit sums equal across boxes (linear over placement bools, cheap), or
shaded cells restricted by parity (one clause per cell). Workable, but you are
authoring the interaction rather than discovering it, and a joint hunt risks the
shading solving itself. Run it staged, as `renbanana_cpsat.py` does: stage 1
enumerate legal LITS shadings, stage 2 fit digits on each fixed shading.

*Verdict.* **Workable.** Cheap encoding, invented coupling.

**Existing hybrids:**
- *HöhlenSTIL*, LMD 000J1E by Phistomefel
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000J1E): Cave x LITS,
  where each Cave wall and the cave interior counts as a LITS region. Not a Sudoku, but
  it is the canonical demonstration that LITS composes with another decision layer.
- *LITSomino*, LMD 000HEI
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000HEI): Fillomino x
  LITS — the tetrominoes of the Fillomino are exactly the LITS pieces, with arrow clues
  counting tetrominoes seen. This is a number-placement x LITS hybrid, one step from a
  Sudoku hybrid.
- *LITS Battle*, LMD 000IKY by AFrayedKnot
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000IKY): LITS x Star
  Battle, tagged "Doppelstern, LITS", with black stars on tetrominoes and white stars off
  them.
- LMD carries a LITS tag alongside its Sudoku tag
  (https://logic-masters.de/Raetselportal/?chlang=en). A pure "LITS Sudoku" title was
  not found in this search round — the LITS hybrids that exist are with other pencil
  genres. [unverified as an absolute absence]

## 1.4 Tapa

**Rules** (https://puzz.link/js/pzpr-samples/tapa.js): "Shade some cells on the board.
1. You cannot shade a cell with a number. 2. Numbers represent the lengths of the blocks
of consecutive shaded cells in the (up to) eight cells surrounding the clue. Numbers
aren't necessarily in order. 3. A question mark can be replaced by any positive number.
If a cell only has a single question mark, the number is allowed to be zero. 4. The
shaded cells cannot form a 2x2 square. 5. All shaded cells form an orthogonally
contiguous area." Invented by Serkan Yürekli; LMD wiki concurs and adds that groups
around a clue must be separated by at least one white cell
(https://wiki.logic-masters.de/index.php/Tapa/en).

**Structure.** Decision: binary shade. Global: connected shaded set, no 2x2 shaded.
Clues: a multiset of run lengths in the 8-neighbourhood of a clue cell, clue cells
themselves unshaded.

**Sudoku hybrid suitability under the CP-SAT lens: Good.**

*Variables.* 81 digits, 81 shading bools, 288 flow arc ints for the shaded
connectivity, 64 no-2x2 windows.

*Expensive globals.* Connectivity only. The Tapa clue itself is the cheapest
non-trivial clue in this survey to encode *exactly*: for a clue cell, enumerate in
Python all 256 shadings of its 8-neighbourhood, keep those whose run multiset
matches, and post the allowed set with `AddAllowedAssignments` over the 8
neighbour bools. That is a table constraint CP-SAT handles natively, no reification
chain, no auxiliary run-length variables.

*Size and cost on 9x9.* 81 bools + 288 flow ints + one ≤256-row table per clue.
**Cheap to moderate**, dominated by connectivity as always.

*Digit coupling.* Native and two-way. A single-number Tapa clue ranges 1..8, so
"the digit in this cell is its Tapa clue" is expressed by making the allowed-
assignment table include the clue cell's own digit variable as a tuple column:
`AddAllowedAssignments([x[p]] + nbr_bools, rows)` where each row pairs a digit
value with a neighbourhood pattern. One constraint per clue cell, exact, no
blowup. This is the single cleanest clue-equals-digit encoding in the survey.

*Verdict.* **Good.** The table-constraint trick makes the clue free, and the only
cost is the standard flow.

**Existing hybrids:**
- LMD carries a Tapa tag beside the Sudoku tag
  (https://logic-masters.de/Raetselportal/?chlang=en), and the portal's genre list
  includes a *Variables Tapasyu* entry — Tapa crossed with Masyu.
- The LMD wiki carries a large family of Tapa variants as first-class genres —
  *Compass Tapa*, *Encoded Tapa*, *Hungarian Tapa*, *Irregular Tapa*, *Mastermind Tapa*,
  *Easy As Tapa*, *Tapa Borders*, *Tapa Chess*, *Tapa Line*, *Tapa Logic*, *Tapa Place*,
  *Tapa Rectangles*, *Pentapa*
  (https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en) — which is direct
  evidence that Tapa's clue mechanism composes with other rule layers more readily than
  any other shading genre.
- *Tapa / Nurikabe*, LMD 00043P
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=00043P).
- A titled "Tapa Sudoku" was not surfaced by this search round. [unverified as absence]

## 1.5 Kurodoko / Kuromasu (黒どこ, "Where is Black Cells")

**Rules** (https://puzz.link/js/pzpr-samples/kurodoko.js): "Shade some cells on the
board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. Numbers cannot
be shaded. 3. Clues represent the total number of unshaded cells that can be seen in a
straight line vertically or horizontally, including itself. 4. All unshaded cells on the
board form an orthogonally connected area." Nikoli vol. 34. LMD wiki, under Kuromasu:
"A number in the grid tells the number of cells that are visible from that square,
including the square itself. Blackened cells block the view and they cannot be adjacent"
(https://wiki.logic-masters.de/index.php/Kuromasu/en).

**Structure.** Decision: binary shade. Global: shaded non-adjacent, unshaded connected.
Clues: a visibility count (a four-way X-sums-style count of unshaded cells).

**Sudoku hybrid suitability under the CP-SAT lens: Good, with a sight-clue cost.**

*Variables.* 81 digits, 81 shading bools, 288 flow arc ints for white
connectivity.

*Expensive globals.* White connectivity (flow). Shaded non-adjacency is 144
clauses. The real cost is the **visibility clue**: "unshaded cells seen in a
straight line, including itself". Encode with prefix-visibility bools — `see[p,d,k]`
true iff the k-th cell in direction d from p is visible, with
`see[p,d,k] => see[p,d,k-1] AND not shaded`, a chain of implications. That is up
to 4 x 8 = 32 bools per clue cell, and the clue is then a linear sum of them.

*Size and cost on 9x9.* 81 bools + 288 flow ints + ~32 sight bools per clue. With
10 clues that is ~320 extra bools. **Moderate.** Sight chains are linear-sized and
propagate well; they are nowhere near as bad as a quadratic encoding.

*Digit coupling.* The friction is arithmetic, not structural: the count reaches 17
on a 9x9 while digits stop at 9. Three fixes, all linear: cap the clue to one
direction; make the clue a *sum of seen digits* rather than a count, which is a
linear sum of reified `see[p,d,k] * x[q]` products — note that needs 32
multiplication vars per clue via `AddMultiplicationEquality` or a reified-table
per pair, which is the one place this genre gets expensive; or use two-digit clues
read off a pair of cells.

*Verdict.* **Good** if you take the one-direction or two-digit fix; **Workable**
if you insist on four-way digit sums, because products of a bool and an int per
sight step are the costliest device in this survey.

**Existing hybrids:** the LMD portal carries a Kuromasu tag alongside Sudoku
(https://logic-masters.de/Raetselportal/?chlang=en), and the wiki carries the composite
genre *Kuromasu-Hitori* (https://wiki.logic-masters.de/index.php/Kuromasu-Hitori). The
directly analogous and heavily-set hybrid is Cave Sudoku (1.11 below), which uses the
same visibility clue with the opposite connectivity rules. No titled "Kurodoko Sudoku"
surfaced in this round (searched: LMD portal, GM Puzzles, general web). [unverified]

## 1.6 Heyawake (へやわけ, "divided rooms")

**Rules** (https://puzz.link/js/pzpr-samples/heyawake.js): "You're given a board divided
into rooms. Shade some cells on the board. 1. Shaded cells cannot be horizontally or
vertically adjacent. 2. A number indicates the amount of shaded cells in a region.
3. There cannot be a horizontal or vertical line of unshaded cells that goes through 2
or more region borders. 4. All unshaded cells on the board form an orthogonally
connected area." Nikoli vol. 39. Nikoli's own English page states the same four rules
and notes that rooms with no number may have any number of painted cells
(https://www.nikoli.co.jp/en/puzzles/heyawake/).

**Structure.** Decision: binary shade. Global: shaded non-adjacent, unshaded connected,
and the distinctive rule 3 — a white run may cross at most one room border. Clues: a
shaded count per room.

**Sudoku hybrid suitability under the CP-SAT lens: Good.**

*Variables.* 81 digits, 81 shading bools, 288 flow arc ints for white
connectivity.

*Expensive globals.* White connectivity (flow) and rule 3, the signature rule:
a horizontal or vertical white run may not cross two room borders. With the nine
boxes as rooms, enumerate in Python every maximal straight segment that spans
three boxes — on a 9x9 that is a short list, every full row and column plus the
segments straddling two borders — and post, for each, `AddBoolOr` of the shading
bools along it. Rule 3 is therefore a **static clause list**, not a propagator:
cheap, exact, and computed once before the solve.

*Size and cost on 9x9.* 81 bools + 288 flow ints + a few dozen clauses.
**Cheap to moderate.**

*Digit coupling.* Native: "the digit in this cell counts the shaded cells in its
box" is `x[p] == sum(w[q] for q in box(p))`, one linear constraint per clue, range
0..9, no remapping. That is the cheapest possible coupling — a plain linear
equality between an int and a sum of bools, which is exactly the shape CP-SAT
presolve likes.

*Verdict.* **Good.** Native linear coupling, a static clause list for the hard
rule, one flow. Among the best value in the shading family.

**Existing hybrids:** LMD carries a Heyawake tag beside the Sudoku tag
(https://logic-masters.de/Raetselportal/?chlang=en). The documented composite is
*Starwacky*, Star Battle x Heyawake with non-rectangular regions, from WPC 2018 Round 6
by Jan Zvěřina (https://wpcunofficial.miraheze.org/wiki/Star_Battle) — object placement
plus Heyawake's rule 3, which is the exact structural move a Sudoku hybrid would make.
The LMD wiki also carries *Heyablock* and *Ayeheya* as derived genres
(https://puzz.link/js/pzpr-samples/heyablock.js, .../ayeheya.js). No titled "Heyawake
Sudoku" surfaced this round. [unverified as absence]

## 1.7 Yin-Yang (しろまるくろまる "Shiromaru-Kuromaru")

**Rules** (https://puzz.link/js/pzpr-samples/yinyang.js): "Place a black or white circle
in every cell. Some circles are given. 1. All circles of the same color must be
orthogonally contiguous. 2. There can not be a 2x2 square of all black or all white
circles." The LMD wiki gives the identical rule
(https://wiki.logic-masters.de/index.php/Yin_Yang/en).

**Structure.** Decision: binary colour, every cell decided (no "unused" state). Global:
*both* colour classes connected, no monochrome 2x2. Clues: some cells pre-coloured; all
other clue content comes from whatever the hybrid adds.

**Sudoku hybrid suitability under the CP-SAT lens: Good — but pay for two flows.**

*Variables.* 81 digits, 81 colour bools, and **two** single-commodity flow
networks, one per colour, because both colour classes must be connected: ~576 arc
ints total, each arc gated on both endpoints sharing the colour.

*Expensive globals.* The double connectivity is the whole cost. Unlike Nurikabe's
second network, neither root emits a variable amount — each is a fixed-size
connected set of unknown cardinality, so the emit is `1` at the root and the
conservation equation is the plain isofill form. Simpler per network than
fillomino's, just doubled. No monochrome 2x2 is 64 x 2 = 128 window constraints,
free.

*Size and cost on 9x9.* 81 bools + ~576 flow ints + 128 windows. **Moderate.**
Two flows is more than any single-colour genre but each is the easy variety.

*Digit coupling.* Nothing native, everything added — and that is the modelling
virtue here, because every added rule is linear. Outside clues summing grey cells
per row: `sum(w[p] * x[p])` needs 9 products per clue, so prefer the reified form
`AddMultiplicationEquality` only where needed, or better, state the clue over a
*fixed* colour assignment in a staged hunt. Kropki-colour coupling (grey dot means
same colour, ratio 1:2 on black cells) is per-edge reified arithmetic, cheap.
Sum-frame coupling is a linear sum over the first three cells of one colour, which
needs sight bools.

*Verdict.* **Good.** The best-evidenced hybrid in the survey and the encoding is
two textbook flows. Stage it: sample legal yin-yang colourings first, then fit
digits, exactly as `renbanana_cpsat.py` splits shading from digits.

**Existing hybrids:** the richest evidence base in this survey.
- *Yin-Yang Sudoku*, LMD 0004X6 by Phistomefel
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=0004X6): standard Sudoku
  plus standard Yin-Yang, with outside clues giving the sum of all grey cells in that
  row or column.
- *Yin Yang Kropki Sudoku*, LMD 0009P1 by Phistomefel
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=0009P1): the Kropki dot
  colour is determined by the Yin-Yang colour of the two cells — black cells in ratio
  1:2, white cells consecutive. A genuinely two-way interaction.
- *Yin Yang Sum Frame Sudoku*, LMD 000QNK by Dying Flutchman
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000QNK), one of a series
  that also includes Yin Yang Skyscrapers, Yin Yang X-sums, Yin Yang Sandwiches and Yin
  Yang FSOE: each outside clue sees only digits of one Yin-Yang colour.
- *Yin Yang Sudoku Deconstruction [9x9]*, LMD 000HLV
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000HLV): Yin-Yang over a
  deconstructed 11x11, with killer cages summing either the shaded or the unshaded cells;
  part of a series the setter describes as "combining deconstruction with various shading
  puzzle genres (cave, nurikabe)".
- LMD carries a "Yin and Yang" tag (https://logic-masters.de/Raetselportal/?chlang=en).

## 1.8 Nurimisaki (ぬりみさき, "painted cape")

**Rules** (https://puzz.link/js/pzpr-samples/nurimisaki.js): "Shade some cells on the
board. 1. There cannot be a 2x2 square of all shaded or unshaded cells. 2. Circles mark
every instance of a cell which is unshaded and orthogonally adjacent to exactly one other
unshaded cell. 3. Clues represent the total number of unshaded cells that can be seen in
a straight line vertically or horizontally, including itself. 4. All unshaded cells on
the board form an orthogonally connected area."

**Structure.** Decision: binary shade. Global: unshaded connected, no monochrome 2x2.
Clues: circled "cape" cells (unshaded with exactly one unshaded orthogonal neighbour),
optionally carrying a visibility count. The "every instance" wording matters: circles
are a *complete* marking, so an uncircled cell is forbidden from being a cape.

**Sudoku hybrid suitability under the CP-SAT lens: Good.**

*Variables.* 81 digits, 81 shading bools, 288 flow arc ints (white connectivity),
plus 81 "is a cape" bools.

*Expensive globals.* White connectivity. The cape definition is purely local and
exactly reified: `cape[p] <=> (not w[p]) AND (sum of unshaded orthogonal
neighbours == 1)`, one reified linear constraint per cell. The *completeness* of
the circle marking — an uncircled cell may not be a cape — is then a unit clause
per uncircled cell, which is 70-odd free negative constraints doing real pruning.
That completeness is the genre's value and it costs nothing to encode.

*Size and cost on 9x9.* 81 + 81 bools, 288 flow ints, 81 reified linears, 128
no-monochrome-2x2 windows. **Moderate.**

*Digit coupling.* The visibility count in a circle has the same range overshoot
and the same three fixes as Kurodoko (1.5), but circles sit at cape cells where
the count is naturally small, so the plain "digit == count" linear works more often
here without a remap. Sight bools as in 1.5.

*Verdict.* **Good.** A cheap, exactly-reified local rule plus one flow, and the
complete-marking rule gives the solver free pruning.

**Existing hybrids:**
- *Santa Pesto, Pt. 2 (9x9)*, LMD 000GBW by SamuPiano
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000GBW): a Sudoku hybrid
  with a "Yin-Yang-Yong" three-path shading and Nurimisaki circles — "Circles must be
  orthogonally connected to their path on exactly one side, and the number in the circle
  indicates the number of consecutive cells on the path that can be seen in a straight
  line from the circle, including the circle itself". The setter explicitly names
  nurimisaki as the source genre; a solver comment reads "Managed to bring a lot of
  nurimisaki logic into the world of sudoku".
- LMD carries a Nurimisaki tag beside the Sudoku tag
  (https://logic-masters.de/Raetselportal/?chlang=en).

## 1.9 Shakashaka (シャカシャカ)

**Rules** (https://puzz.link/js/pzpr-samples/shakashaka.js): "Shade a right triangle in
some empty cells, each of which occupies exactly half the cell it's in. 1. Each unshaded
area must be rectangular in shape. The rectangle can be upright, or rotated at a 45°
angle. 2. A number in a cell represents how many of the (up to 4) cells orthogonally
adjacent to the clue contain triangles." Nikoli vol. 123. LMD wiki agrees
(https://wiki.logic-masters.de/index.php/Shakashaka/en).

**Structure.** Decision: five states per cell (empty, or one of four triangle
orientations) — not binary. Global: every maximal white area is an axis-aligned or
45°-rotated rectangle. Clues: a count of adjacent triangles.

**Sudoku hybrid suitability under the CP-SAT lens: Poor.**

*Variables.* Not a binary layer: 5 states per cell (empty, or four triangle
orientations), so 405 bools with `AddExactlyOne` per cell, or 81 ints in 0..4.

*Expensive globals.* Rule 1 is the killer. "Every maximal white region is a
rectangle, possibly rotated 45°" is a property of half-cell geometry, not of the
cell graph — the white region boundaries run diagonally through cells. There is no
analogue of the repo's rectangle lemma ("connected + no 2x2 window with exactly
three of the colour"), because the objects are not cell sets. Encoding it exactly
means either enumerating admissible local configurations over a 2x2 window in the
*half-cell* grid, or a lazy cut loop over discovered non-rectangular regions with
no compact cut to post.

*Size and cost.* **Heavy**, and heavy for a bad reason: the cost buys geometry,
not puzzle content.

*Digit coupling.* A triangle is an orientation. There is no quantity for a digit
to equal, so coupling is wholly invented.

*Verdict.* **Poor.** Skip it.

**Existing hybrids:** LMD carries a Shakashaka tag
(https://logic-masters.de/Raetselportal/?chlang=en). No Shakashaka x Sudoku hybrid found
(searched: LMD portal, GM Puzzles, general web). [unverified as absence]

## 1.10 Star Battle (Doppelstern, Two Not Touch, Sternenschlacht)

**Rules** (https://puzz.link/js/pzpr-samples/starbattle.js): "Place a star into some of
the cells. 1. Stars cannot be horizontally, vertically or diagonally adjacent. 2. The
number at the top of the grid indicates how many stars are in each row, column and
outlined region." The WPF/WPC phrasing is identical
(https://wpcunofficial.miraheze.org/wiki/Star_Battle); puzzles.wiki notes the common
form is a 2-star battle on 10x10
(https://www.puzzles.wiki/wiki/Star_Battle).

**Structure.** Decision: binary (star / no star). Global: king-move non-adjacency, and
an exact count per row, per column, and per region. No connectivity, no 2x2 rule.
Clues: only the region partition and the star count.

**Sudoku hybrid suitability under the CP-SAT lens: Good — the cheapest model here.**

*Variables.* 81 digits and 81 star bools. That is all.

*Expensive globals.* **None.** King-move non-adjacency is 81 x 4 = ~200 binary
clauses (or, tighter, `AddAtMostOne` over each 2x2 window: 64 constraints).
"Exactly k stars per row, column and region" is 27 linear equalities over bools.
No connectivity, no flow, no shape rule, no sight chain.

*Size and cost on 9x9.* 81 bools, ~90 linear constraints. **Cheap** — by a wide
margin the least work of any genre in this survey, and a uniqueness proof should
run in well under a second.

*Digit coupling.* Native in the published form: place 1..7 plus two stars per
house, i.e. the digit variable takes a "star" value. Model it as `x[p]` in 0..7
with 0 meaning star, then `AddExactlyOne`-style counting per house — the star bool
is just `x[p] == 0` reified, and the whole thing is one variable per cell with no
second layer at all. That collapse is the same move fillomino makes with region
ids and is what makes this model tiny.

*Verdict.* **Good.** Highest ratio of puzzle interest to solver cost in the
survey; a natural first CP-SAT hybrid to build.

**Existing hybrids:**
- *Sudoku Variants Series (138) - Star Battle Sudoku*, LMD 0002G5
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=0002G5):
  "Place the digits from 1 to 7 and two stars in every row, column and 3x3-block. Stars
  don't touch each other, not even diagonally." Solvable online in f-puzzles.
- *LITS Battle*, LMD 000IKY
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000IKY): Star Battle x
  LITS.
- *Starwacky*, WPC 2018 Round 6 by Jan Zvěřina
  (https://wpcunofficial.miraheze.org/wiki/Star_Battle): Star Battle x Heyawake. The same
  page documents further Star Battle hybrids (Regions Star Battle, a borderless variant).
- LMD carries a Star Battle tag (https://logic-masters.de/Raetselportal/?chlang=en).

## 1.11 Cave / Corral / Bag / Höhle

**Rules** (https://puzz.link/js/pzpr-samples/cave.js): "Shade some cells on the board to
form a cave. 1. All shaded cells are connected through other shaded cells to the outside
of the grid. 2. Numbers cannot be shaded. 3. Clues represent the total number of unshaded
cells that can be seen in a straight line vertically or horizontally, including itself.
4. All unshaded cells on the board form an orthogonally connected area." Nikoli vol. 58,
under the name 'Bag'. The LMD wiki entry (as *Caves*) is the same, and records the other
names Baggu and Corral (https://wiki.logic-masters.de/index.php/Caves/en); it also lists
two standard variants — banning 2x2 blocks of either colour, and a hexagonal grid.

**Structure.** Decision: binary shade. Global: unshaded connected, shaded connected *to
the border* (equivalently: no enclosed wall). Clues: the same visibility count as
Kurodoko, but with the connectivity rules swapped.

**Sudoku hybrid suitability under the CP-SAT lens: Good.**

*Variables.* 81 digits, 81 shading bools, 288 flow arc ints for the cave (white)
connectivity, plus sight bools per clue.

*Expensive globals.* Two connectivity conditions, but only one needs a flow. White
must be connected — one flow to a root. Shaded cells must reach the grid border —
that is *cheaper* than a free root, because the border is a fixed anchor: give
every border shaded cell a supply and run one flow whose sinks are the border, or
equivalently post a reachability flow with a virtual outside node. No 2x2 rule in
the base genre.

*Size and cost on 9x9.* 81 bools, ~576 flow ints across the two networks (the
border-anchored one is the easy kind), ~32 sight bools per clue. **Moderate.**

*Digit coupling.* The published hybrids solve the range problem for you, and their
fix is linear-friendly: Cave Sums makes the clue a *digit sum* over the field of
vision. That needs bool x int products along each sight chain, ~32 per clue — the
one genuinely costly device — so prefer the Twilight Cave form where a shaded
clue sums its own connected group, which is a sum over reified region membership
and no cheaper, or restrict sums to one direction. "Digits may not repeat within a
field of vision" is pairwise reified inequality, ~36 pairs per clue.

*Verdict.* **Good.** Strong published coupling and a border-anchored flow that is
easier than a free one; budget for the sight-sum products.

**Existing hybrids:**
- *Cave Sums Sudoku*, LMD 000QU3
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000QU3): clue cells are
  ambiguous; a number in a shaded cell gives the digit sum of its shaded group, a number
  in an unshaded cell gives the digit sum of everything it sees in the cave.
- *Twilight Cave Sudoku*, LMD 000ALC by PixelPlucker
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000ALC): killer
  sudoku x Twilight Cave (a Cave variant where clues may themselves be shaded), citing
  the WPC 2019 instruction booklet p. 48 for the Twilight Cave rules. Digits may not
  repeat within a clue's field of vision, nor within any connected shaded group.
- *Cave Sudoku +*, LMD 000EC2
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000EC2), and the related
  000E9H: each white block holds a set of non-repeating consecutive digits starting at 1;
  black clues count black cells seen.
- *HöhlenSTIL*, LMD 000J1E by Phistomefel
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000J1E): Cave x LITS.
- LMD carries a Cave tag with 233 puzzles under it
  (https://logic-masters.de/Raetselportal/Suche/erweitert.php?tag_id=4002).

## 1.12 Canal View

**Rules** (https://puzz.link/js/pzpr-samples/canal.js): "Shade some cells on the board.
1. The number on a cell indicates how many cells are shaded in a continuous line starting
from the cell. These lines are in the four cardinal directions (up, down, left, right).
2. You cannot shade a cell with a number. 3. The shaded cells cannot form a 2x2 square.
4. All shaded cells form an orthogonally contiguous area." Invented by Prasanna Seshadri.

**Structure.** Decision: binary shade. Global: connected shaded set, no 2x2 shaded.
Clues: the count of shaded cells in the four runs radiating from the clue — the shaded
mirror image of Kurodoko's clue.

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* 81 digits, 81 shading bools, 288 flow arc ints, sight bools per clue.

*Expensive globals.* One flow (shaded connectivity), 64 no-2x2 windows, and the
four-direction shaded-run sight chains — the same prefix-bool device as Kurodoko,
counting shaded rather than unshaded cells.

*Size and cost.* Identical in shape and cost to Kurodoko (1.5). **Moderate.**

*Digit coupling.* Same range overshoot, same fixes. Nothing here that Kurodoko or
Cave does not already give you.

*Verdict.* **Workable.** Build Cave or Kurodoko and get Canal View as a flag on
the same model — the sight-chain code and the flow are shared verbatim, only the
polarity of the counted cell and the connectivity target change.

**Existing hybrids:** none found under that name (searched: LMD portal, GM Puzzles,
general web). The Nurikabe Sudoku LMD 000MU6 and Colossal Nurikabe Sudoku 000DZI both use
*exactly* the Canal View clue ("cells with arrow(s) contain the total number of shaded
cells visible in the direction of the arrow(s)", "the total number of water cells seen in
all four directions from that cell, including itself"), so the clue type is in active
hybrid use even though the genre name is not
(https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000MU6,
https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000DZI).

## 1.13 Kurotto (クロット)

**Rules** (https://puzz.link/js/pzpr-samples/kurotto.js): "Shade some cells on the board.
1. Cells with circles cannot be shaded. 2. Numbers indicate the sum of the size of all
blocks that share at least one border with the circle." Nikoli vol. 138.

**Structure.** Decision: binary shade. Global: none — no connectivity, no 2x2 rule. Clues:
per-circle, the summed size of all orthogonally adjacent shaded blocks.

**Sudoku hybrid suitability under the CP-SAT lens: Good — no global at all.**

*Variables.* 81 digits, 81 shading bools, and — the only real cost — component
sizes. Use the `renbanana_cpsat.py` stage-1 device: 81 component-label ints, with
adjacent shaded cells forced to share a label, and a size int per label. Or, since
clue neighbourhoods are local, 81 `rid` ints plus one flow.

*Expensive globals.* **None from the rules.** Kurotto has no connectivity
requirement, no 2x2 rule, no shape rule. The only structure is the clue: "the sum
of the sizes of all blocks bordering this circle", which needs block identity and
therefore one region-labelling device — a flow, or labels — to be exact.

*Size and cost on 9x9.* 81 bools + 81 label ints + 288 flow ints. **Moderate**,
and would be **cheap** if the clue did not need block sizes.

*Digit coupling.* Native: the digit in a circle equals its clue. The clue is a sum
of distinct adjacent block sizes, which needs de-duplication (two neighbours in the
same block count once) — encode as a sum over blocks reified on "this block touches
this circle", not as a sum over neighbours. That de-duplication is the one fiddly
part of the model and is the reason to prefer explicit labels over flow here.

*Verdict.* **Good.** A rules-free global section is rare and valuable: the puzzle
content is entirely in the clue-to-digit link, which is exactly what a hybrid wants.

**Existing hybrids:**
- *Sudokurotto* by Phistomefel is named as the direct inspiration for the Shikaku-Sudoku
  hybrids *Shikasudoku* (LMD 00087H,
  https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=00087H) and *Shikasudoku
  2* (LMD 00093U, https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=00093U) —
  a Kurotto x Sudoku hybrid by the most prolific setter of this kind of hybrid.
- LMD carries a Kurotto tag (https://logic-masters.de/Raetselportal/?chlang=en).

## 1.14 Mochikoro and Mochinyoro (もちこ / もちにょろ)

**Rules** — Mochikoro (https://puzz.link/js/pzpr-samples/mochikoro.js): "Shade some cells
on the board to form regions of unshaded cells. 1. All regions must be rectangular in
shape. 2. A region can have no more than one number. 3. A number indicates the size of the
region that contains it. 4. You cannot shade a cell with a number. 5. The shaded cells
cannot form a 2x2 square. 6. All unshaded rectangles form a diagonally contiguous area."
Nikoli vol. 100. Mochinyoro (https://puzz.link/js/pzpr-samples/mochinyoro.js) is the same
with one extra rule: "1. Shaded blocks must not form rectangles or squares."

**Structure.** Decision: binary shade. Global: every white region is a rectangle; the
white regions are *diagonally* connected as a set; no 2x2 shaded. Clues: optional size
numbers, at most one per rectangle — note the "no more than one", which allows unclued
rectangles, unlike Nurikabe.

**Sudoku hybrid suitability under the CP-SAT lens: Workable, and the rectangle
lemma does half the work.**

*Variables.* 81 digits, 81 shading bools, region labels or a flow for the white
rectangles.

*Expensive globals.* "Every white region is a rectangle" is exactly the repo's
rectangle lemma from `renbanana_cpsat.py`: *connected + no 2x2 window holding
exactly three cells of the colour <=> every group is a rectangle*. That is 64
window constraints plus the connectivity you already have — a purely local, exact
encoding of a shape rule, and the single most reusable device in this document.
The awkward part is rule 6: the white rectangles are **diagonally** connected as a
set, which needs a second flow over a diagonal adjacency graph (8 arcs per cell,
~512 arc ints) on the *quotient* graph of rectangles, not cells.

*Size and cost on 9x9.* **Heavy**, and heavy for the least interesting rule in the
genre.

*Digit coupling.* Rectangle area equals a digit, 1..9. Fine, but Shikaku (3.4)
gives the identical coupling with an exact tiling and no diagonal-quotient flow.

*Verdict.* **Workable**, but dominated. Model Shikaku or Chocona instead and
reuse the rectangle lemma there.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 1.15 Light and Shadow

**Rules** (https://puzz.link/js/pzpr-samples/lightshadow.js): "Shade some cells on the
board to form shaded and unshaded areas. 1. Each orthogonally connected area contains
exactly one clue. 2. The color of clued cells cannot be changed. 3. A clue represents the
size of the area of shaded or unshaded cells that the clue belongs to."

**Structure.** Decision: binary shade. Global: *both* colours partition into areas, each
containing exactly one clue. Clues: area size, given on a pre-coloured cell.

**Sudoku hybrid suitability under the CP-SAT lens: Good, and structurally the
nicest fit to the fillomino encoding.**

*Variables.* 81 digits, 81 colour bools, 81 `rid` ints, 81 root bools, 288 flow
arc ints.

*Expensive globals.* One flow only — and it is the *fillomino* flow, not a plain
connectivity flow. Both colours partition into areas, each area holds exactly one
clue, and the clue is the area's size: that is precisely `emit == size at the
root, conservation absorbing one unit per cell`, with arcs gated on "same colour"
instead of "same digit". No 2x2 rule, no border anchor, no second network.

*Size and cost on 9x9.* The fillomino model's variable count, plus 81 colour
bools. **Moderate** — and the measured fillomino profile is the right expectation:
sampling in well under a second, uniqueness proofs in seconds with a long tail.

*Digit coupling.* Native and in range: area size 1..9 equals the digit in its
clue cell, on *both* colours, so every cell participates. One line, the same line
fillomino uses.

*Verdict.* **Good.** The closest thing in the survey to "fillomino with a colour
layer", which means the repo's best-understood encoding transfers almost verbatim.
Unclaimed as a published hybrid, which makes it the strongest under-explored pick.

**Existing hybrids:** none found under this name (searched: LMD portal, GM Puzzles,
general web). The closest published thing is the Nurikabe Sudoku family (1.1), which uses
one colour's area sizes. [unverified as absence]

## 1.16 Chocona (チョコナ)

**Rules** (https://puzz.link/js/pzpr-samples/chocona.js): "Shade some cells on the board.
1. A group of orthogonally connected shaded cells is called a block. Each block must be a
filled rectangle or square. 2. Numbered regions must contain the indicated amount of
shaded cells."

**Structure.** Decision: binary shade. Global: every shaded block is a filled rectangle.
Clues: a shaded-cell count per outlined region.

**Sudoku hybrid suitability under the CP-SAT lens: Good — pure lemma reuse.**

*Variables.* 81 digits, 81 shading bools. Optionally labels if you want block
sizes, but the base rules do not need them.

*Expensive globals.* Only the rectangle rule, and the repo already has it exactly:
every shaded block is a filled rectangle iff the shaded set is locally free of
"2x2 window with exactly three shaded cells" **and** each block is connected — and
here you do not even need the connectivity half stated separately, because a block
*is* a connected component by definition. In practice post the 64 window
constraints and you have the shape rule. No global connectivity, no flow, no sight
chains.

*Size and cost on 9x9.* 81 bools + 64 windows + the sudoku core. **Cheap.** This
is the second-cheapest full model in the survey after Star Battle.

*Digit coupling.* Native and linear: "the digit says how many cells of its box are
shaded" is `x[p] == sum(s[q] for q in box(p))`, range 0..9. One linear equality per
clue — the same shape as Heyawake's, with none of Heyawake's rule-3 clause list.

*Verdict.* **Good.** Cheapest good coupling in the family, and every line of the
shape encoding is already written in `renbanana_cpsat.py`.

**Existing hybrids:** none found under the name Chocona (searched: LMD portal, GM
Puzzles, general web), but the rectangle-shading-plus-sudoku idea is live in this repo's
own Renbanana work and in Choco Banana (1.20). [unverified as absence]

## 1.17 Stostone (ストストーン)

**Rules** (https://puzz.link/js/pzpr-samples/stostone.js): "Shade some cells on the board
to form blocks. 1. All regions contain exactly one block, which is an orthogonally
connected group of shaded cells. 2. A number indicates the size of the block in the
region. 3. Shaded cells cannot be adjacent across region borders. 4. If all of the blocks
were to fall straight down without changing shape, they must completely fill the bottom
half of the grid." Nikoli vol. 156.

**Structure.** Decision: binary shade. Global: one block per region, blocks separated
across region borders, and the gravity rule — the blocks tile the bottom half exactly.
Clues: block size per region.

**Sudoku hybrid suitability under the CP-SAT lens: Workable, and the gravity rule
is the interesting part to encode.**

*Variables.* 81 digits, 81 shading bools, one flow per region for block
connectivity (or 81 labels), plus per-column fall counters.

*Expensive globals.* One block per region with a size is cheap: a linear count of
shaded cells per box, plus connectivity within the box, which on a 3x3 box is a
small enough graph to encode by allowed-assignment tables over the 9 cells rather
than a flow. Rule 3, no shaded cells adjacent across region borders, is a clause
list over border pairs. **Rule 4 is the one that needs thought**: "if all blocks
fell straight down they would fill the bottom half exactly". Blocks fall as rigid
bodies, so the landing position of a block depends on what is below it — a
sequential, order-dependent simulation, which CP-SAT cannot express directly. The
tractable reformulation is the column-count identity: a block falling straight
down preserves each column's contribution, so the bottom-half fill condition is
equivalent to "every column contains exactly h shaded cells", where h is half the
height. That turns rule 4 into 9 linear equalities — but only if you accept the
column-count reading, which is a *weaker* statement than the genre's (it does not
force the blocks to stack without gaps). Getting rule 4 exactly means encoding the
stacking order, which is where the cost lands.

*Size and cost on 9x9.* **Heavy if exact, cheap if you take the column-count
relaxation** — and a relaxation changes the puzzle, so it must be declared.

*Digit coupling.* Block size per box equals a digit, in range. Fine.

*Verdict.* **Workable.** Also note 9 is odd, so "bottom half" is undefined on a
9x9 without a board change. Model it on 9x10 or accept the relaxation.

**Existing hybrids:** LMD carries a Stostone tag
(https://logic-masters.de/Raetselportal/?chlang=en). No Stostone x Sudoku hybrid found
(searched: LMD portal, GM Puzzles, general web). [unverified as absence]

## 1.18 Nuribou (ぬりぼう)

**Rules** (https://puzz.link/js/pzpr-samples/nuribou.js): "Shade some cells on the board
to form regions of unshaded cells. 1. Each region contains exactly one number. 2. A number
indicates the size of the region that contains it. 3. You cannot shade a cell with a
number. 4. Shaded cells must form rectangular blocks with a width of 1. 5. Two blocks of
the same size cannot be diagonally adjacent." Nikoli vol. 68.

**Structure.** Decision: binary shade. Global: every shaded block is a 1-wide bar; equal
bars not diagonally adjacent. Clues: white region sizes, one per region.

**Sudoku hybrid suitability under the CP-SAT lens: Workable, and a clean lemma
target.**

*Variables.* 81 digits, 81 shading bools, `rid`/root/flow for the white regions
(the fillomino set).

*Expensive globals.* White regions with sizes is the fillomino flow again. The
shaded side is where this genre is pleasant: "every shaded block is a 1-wide
rectangular bar" has a local characterisation in the same spirit as the rectangle
lemma — a shaded set is a union of 1-wide bars iff no 2x2 window holds three or
more shaded cells. That is 64 window constraints, exact, no connectivity needed on
the shaded side at all. Rule 5, equal-size bars not diagonally adjacent, needs bar
identity and so a label or flow on the shaded side too.

*Size and cost on 9x9.* Fillomino's model plus 64 windows plus a shaded labelling.
**Moderate to heavy**, dominated by having region machinery on both colours.

*Digit coupling.* White region size equals a digit (native, in range), and bar
length is a second in-range number if you want it.

*Verdict.* **Workable.** The bar lemma is a genuinely nice find and worth
recording, but Nurikabe and Light and Shadow give better coupling for the same
region machinery.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 1.19 Norinori (のりのり)

**Rules** (https://puzz.link/js/pzpr-samples/norinori.js): "Shade some cells on the board.
1. Each shaded cell is orthogonally adjacent to exactly one other shaded cell. 2. Each
outlined region contains exactly 2 shaded cells." Nikoli vol. 124. The LMD wiki phrases it
identically (https://wiki.logic-masters.de/index.php/Norinori/en).

**Structure.** Decision: binary shade. Global: the shaded set is a perfect matching of
dominoes (every shaded cell in exactly one horizontal or vertical pair), and exactly two
shaded per region. Dominoes may cross region borders — that is the whole trick. Clues:
the region partition only.

**Sudoku hybrid suitability under the CP-SAT lens: Good, and almost free.**

*Variables.* 81 digits, 81 shading bools. Optionally 144 domino bools, one per
adjacent pair, which is the better encoding.

*Expensive globals.* **None.** With domino bools: each shaded cell is covered by
exactly one selected domino (`sum of incident domino bools == s[p]`), each domino
implies both its cells shaded, and each box has exactly two shaded cells — 81 + 81
+ 9 linear constraints. That is a **matching** problem, which CP-SAT handles
extremely well. No connectivity, no shape rule, no 2x2, no sight chain.

*Size and cost on 9x9.* 144 domino bools, 81 shading bools, ~170 linear
constraints. **Cheap.** Alongside Star Battle and Chocona, one of the three models
here a uniqueness proof should finish in under a second.

*Digit coupling.* Not native — the genre has no numbers — but every natural
addition is linear over the domino bools, which is the ideal case: "the two digits
of each domino sum to a constant" is one linear constraint per domino reified on
its bool; "the shaded digits in each box are a fixed pair" is a clause list. The
domino variables give the coupling a natural carrier that raw shading bools do not.

*Verdict.* **Good.** Trivially cheap model, and the domino-bool encoding gives the
invented coupling a clean home. Unclaimed as a published hybrid.

**Existing hybrids:** LMD carries a Norinori tag
(https://logic-masters.de/Raetselportal/?chlang=en). No titled "Norinori Sudoku" surfaced
this round (searched: LMD portal, GM Puzzles, general web). Given how clean the fit is,
this reads as an opportunity rather than a warning. [unverified as absence]

## 1.20 Choco Banana (チョコバナナ)

**Rules** (https://puzz.link/js/pzpr-samples/cbanana.js): "Shade some cells on the board.
1. A group of shaded cells must form a rectangle or square. 2. A group of unshaded cells
must not form a rectangle or square. 3. A number indicates the size of the (shaded or
unshaded) group that overlaps it. A group can contain one or more numbers, or none at
all." Nikoli vol. 176.

**Structure.** Decision: binary shade. Global: every shaded group is a rectangle, every
unshaded group is *not* a rectangle. Clues: group size on either colour; a group may carry
several clues or none.

**Sudoku hybrid suitability under the CP-SAT lens: Good — the repo has already
built this model.**

*Variables.* 81 digits, 81 shading bools, component labels for group sizes. See
`docs/research/renbanana_cpsat.py` and `docs/research/choco-banana-propagation.md`.

*Expensive globals.* Two halves with opposite difficulty, and the repo has
measured both. The **positive** rule (shaded groups are rectangles) is exact and
local via the lemma: connected + no 2x2 window with exactly three of the colour.
The **negative** rule (white groups are *not* rectangles) has no positive
encoding, and the repo's answer is a lazy cut loop: solve, find a rectangular
white component, forbid exactly that pattern — its cells one colour, its
orthogonal border the other — and re-solve. Every cut excludes only invalid
solutions, so uniqueness proofs stay exact. Note the recorded negative result:
capping component size by cutting oversized components one at a time did **not**
work (2313 cuts found nothing in 150 s); size caps go in structurally with labels.

*Size and cost on 9x9.* Measured in the repo's own hunts. **Moderate to heavy**,
driven by the cut loop, and the reason those hunts run staged.

*Digit coupling.* Native: a clue is a group size on either colour, in digit range.
The repo's shipped variant additionally couples adjacent chocolate digits (differ
by >= 5) and banana groups (distinct and consecutive) — both linear or
AllDifferent, both cheap.

*Verdict.* **Good**, and uniquely cheap in engineering terms because the model,
the lazy-cut discipline and an independent verifier already exist here.

**Existing hybrids:** this repo's own Renbanana work is the closest instance on hand
(`docs/research/renbanana/`). No external Choco Banana x Sudoku hybrid found (searched:
LMD portal, GM Puzzles, general web). [unverified as absence]

## 1.21 Shimaguni (島国, "Islands")

**Rules** (https://puzz.link/js/pzpr-samples/shimaguni.js): "Shade some cells on the board
to form islands. 1. All regions contain exactly one island, which is an orthogonally
connected group of shaded cells. 2. A number indicates the size of the island in the
region. 3. Shaded cells cannot be adjacent across region borders. 4. Two regions which
share a border must have islands of different sizes." Nikoli vol. 117.

**Structure.** Decision: binary shade. Global: one connected island per region, islands
separated across borders, neighbouring regions' islands differ in size. Clues: island size.

**Sudoku hybrid suitability under the CP-SAT lens: Good.**

*Variables.* 81 digits, 81 shading bools, one size int per box (9 of them), plus
per-box connectivity for the single island.

*Expensive globals.* Connectivity is *per box*, not global — nine independent
3x3 connectivity problems. A 3x3 box has 512 shading patterns, of which the
connected non-empty ones are a short list, so encode each box's island with
`AddAllowedAssignments` over its 9 bools paired with the size int: one table
constraint per box, exact, no flow anywhere in the model. That is a decisive
simplification over every genre whose connectivity is grid-wide. Rule 3 (no shaded
adjacency across box borders) is a clause list over the 54 border pairs. Rule 4
(neighbouring boxes have different island sizes) is 12 `!=` constraints on the
nine size ints.

*Size and cost on 9x9.* 81 bools, 9 ints, 9 table constraints, ~66 clauses.
**Cheap.** The per-box decomposition is what buys it.

*Digit coupling.* Native: island size equals the digit in the clue cell, 1..9.
And rule 4 becomes a constraint over nine numbers with an adjacency graph — the
same shape as a latin-square argument, so it composes with sudoku reasoning rather
than sitting beside it.

*Verdict.* **Good.** The best example in the survey of a genre whose global
constraint decomposes to the sudoku's own box structure and therefore costs
almost nothing.

**Existing hybrids:** LMD carries a Shimaguni tag
(https://logic-masters.de/Raetselportal/?chlang=en). No titled Shimaguni Sudoku found
(searched: LMD portal, GM Puzzles, general web). [unverified as absence]

## 1.22 Aqre

**Rules** (https://puzz.link/js/pzpr-samples/aqre.js): "Shade some cells on the board.
1. Numbered regions must contain the indicated amount of shaded cells. 2. There may not be
a horizontal or vertical run of 4 or more consecutive shaded or unshaded cells. 3. All
shaded cells form an orthogonally contiguous area." Invented by Eric Fox.

**Structure.** Decision: binary shade. Global: connected shaded set; no run of 4 in either
colour. Clues: shaded count per region.

**Sudoku hybrid suitability under the CP-SAT lens: Good.**

*Variables.* 81 digits, 81 shading bools, 288 flow arc ints (shaded
connectivity).

*Expensive globals.* One flow, and rule 2 — no run of four in either colour — is
a **static clause list**: every horizontal and vertical window of 4 cells gives two
clauses (not all shaded, not all unshaded). On a 9x9 that is 2 x 2 x 6 x 9 = 216
clauses, computed once, no auxiliary variables. Run-length bounds are the cheapest
non-trivial rule type in this document and they prune hard, which is exactly the
combination a generator wants.

*Size and cost on 9x9.* 81 bools + 288 flow ints + 216 clauses. **Moderate**,
dominated as usual by the flow, and the clause list actively speeds the search.

*Digit coupling.* Native and linear: shaded count per box equals a digit, as
Heyawake and Chocona. `x[p] == sum(s[q] for q in box(p))`.

*Verdict.* **Good.** Cheap hard-pruning rule, native linear coupling, one flow.
A strong and entirely unclaimed target.

**Existing hybrids:** none found under the name Aqre (searched: LMD portal, GM Puzzles,
general web). Eric Fox is also the author of the genre-fusion *Tapa / Nurikabe* LMD 00043P
(https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=00043P).
[unverified as absence]

## 1.23 Aquapelago

**Rules** (https://puzz.link/js/pzpr-samples/aquapelago.js): "Shade some cells on the
board. Some shaded cells may be given. 1. Shaded cells cannot be horizontally or
vertically adjacent. 2. The unshaded cells cannot form a 2x2 square. 3. A number indicates
the amount of cells in its diagonally connected group of shaded cells. 4. All unshaded
cells on the board form an orthogonally connected area." Invented by Walker Anderson.

**Structure.** Decision: binary shade. Global: shaded orthogonally non-adjacent but
*diagonally* grouped, unshaded connected with no white 2x2. Clues: diagonal-group size.

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* 81 digits, 81 shading bools, two adjacency structures — orthogonal
(for white connectivity) and diagonal (for shaded group sizes) — so a flow over
288 orthogonal arcs plus a labelling or second flow over ~512 diagonal arcs.

*Expensive globals.* Two different adjacency relations in one model is the cost.
White connectivity is the standard flow; shaded groups are *diagonally* connected
with sizes, so they need their own `rid`/emit machinery on the diagonal graph —
fillomino's device on a denser graph. Shaded orthogonal non-adjacency is 144
clauses; no white 2x2 is 64 windows.

*Size and cost on 9x9.* ~800 flow ints across two networks on two graphs.
**Heavy.**

*Digit coupling.* Diagonal group size equals a digit, in range. Native and fine —
but the rule combination (shaded orthogonally isolated, white with no 2x2) forces
a dense shading that leaves little digit freedom, so a generator will find the
digit layer over-determined.

*Verdict.* **Workable.** Interesting logic, two graphs' worth of machinery, and a
cramped digit layer. Second wave at best.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 1.24 Minesweeper

**Rules** (https://puzz.link/js/pzpr-samples/mines.js): "Locate the cells containing a
mine in the grid. 1. Numbers indicate the amount of mines in the orthogonally and
diagonally adjacent cells. 2. A number cannot contain a mine." The LMD wiki adds that the
total mine count is normally given and that grid size and mine count vary
(https://wiki.logic-masters.de/index.php/Minesweeper/en).

**Structure.** Decision: binary (mine / no mine). Global: usually a total mine count; no
connectivity, no shape rule. Clues: 8-neighbourhood mine counts, on non-mine cells.

**Sudoku hybrid suitability under the CP-SAT lens: Good — and it is pure linear
algebra.**

*Variables.* 81 digits, 81 mine bools. Nothing else.

*Expensive globals.* **None.** Every clue is `sum of the 8 neighbour mine bools ==
value`, a plain linear equality. A total mine count is one more. No connectivity,
no shape, no sight chain, no flow.

*Size and cost on 9x9.* 81 bools, one linear constraint per clue. **Cheap** —
CP-SAT's presolve is very strong on pure 0/1 linear systems, and this is nothing
but.

*Digit coupling.* Native, two-way and linear: `x[p] == sum(m[q] for q in
neighbours8(p))` on non-mine cells, range 0..8. The published GM Puzzles hybrid
adds "exactly three mines per row, column and region", which is 27 more linear
equalities. Everything in this genre is a sum of bools equalling an int — the
friendliest possible shape.

*Verdict.* **Good.** Cheapest coupling in the survey to encode exactly, with real
published hybrids to calibrate against. The design risk is puzzle-side, not
solver-side: keep the two layers entangled or the generator will produce a sudoku
and an unrelated minesweeper.

**Existing hybrids:**
- *Minesweeper (Sudoku)* by Serkan Yürekli, GM Puzzles, 2022-07-21
  (https://www.gmpuzzles.com/blog/2022/07/minesweeper-sudoku-by-serkan-yurekli/):
  "Standard Minesweeper rules. Also, each row, column, and bold region must contain
  exactly three mines."
- *Minesweeper Sudoku*, LMD 000CW1
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000CW1):
  "Each value in the sudoku that is not a mine gives the number of mines around the cell.
  Note, mine cells can have any value", plus arrow, killer-cage and 2x2 rules.
- GM Puzzles has a Minesweeper category with 65 posts
  (https://www.gmpuzzles.com/blog/category/objectplacement/minesweeper/), and LMD carries
  a Minesweeper tag (https://logic-masters.de/Raetselportal/?chlang=en).

## 1.25 Battleships (Bimaru, Solitaire Battleships)

**Rules** (https://puzz.link/js/pzpr-samples/battleship.js): "Place every ship from the
fleet into the grid. Ships can be rotated or mirrored. 1. All ships must be used exactly
once. There cannot be ships in the grid that aren't present in the bank. 2. Two ships
cannot be orthogonally or diagonally adjacent. 3. Numbers outside the grid indicate how
many cells in the row or column are occupied by ships. 4. Some ship segments are given
(corner pieces, centers, or single-length boats), along with their orientation. Gray cells
represent ship segments of unknown shape. 5. Cells marked with water cannot be used by
ships."

**Structure.** Decision: binary occupancy, plus a segment-orientation refinement. Global:
an exact fleet multiset, king-move separation between distinct ships. Clues: outside
row/column occupancy counts, plus given segments.

**Sudoku hybrid suitability under the CP-SAT lens: Good, via placement bools.**

*Variables.* 81 digits, 81 occupancy bools, and one bool per *ship placement* —
for a standard fleet on a 9x9 that is a few hundred, enumerated in Python.
Channelling ties each placement bool to its cells.

*Expensive globals.* **None of the hard kind.** The fleet is `AddExactlyOne`-style
counting over placement bools per ship length. King-move separation between
distinct ships is a clause list, or more simply "no two occupied cells diagonally
adjacent unless in the same ship", enumerable over placements. Outside counts are
linear sums. No connectivity, no flow.

*Size and cost on 9x9.* ~300 placement bools, 81 occupancy bools, ~50 linear
constraints. **Cheap to moderate.** Placement enumeration is the standard, and
best, encoding for object-placement genres, and it is the same move that makes
LITS and Statue Park tractable.

*Digit coupling.* Added, not native, but all linear: digits on ship cells obey a
rule, a ship's digits sum to something, ship cells carry one parity. The published
1980s-to-2007 hybrids simply interleave the clue sets, which is the loosest
coupling and the easiest to model.

*Verdict.* **Good.** Cheap, well-understood, with a long hybrid record. Its one
weakness under this lens is that the coupling is additive rather than emergent.

**Existing hybrids:**
- *Battleship Sudoku*, from the 2007 Sudoku Championship instruction booklet, reproduced
  with rules at Erasable Games (https://erasablegames.com/battleship-sudoku/): "Two games
  in one: Battleship and Sudoku. There are fewer Sudoku clues and added Battleship clues.
  Use both sources to solve both objectives."
- GM Puzzles runs Battleship Sudoku as a standing category with 7 posts
  (https://www.gmpuzzles.com/blog/category/sudoku/battleship-sudoku/) alongside 109
  classic Battleships posts
  (https://www.gmpuzzles.com/blog/category/objectplacement/battleships/).
- LMD carries a Battleships tag (https://logic-masters.de/Raetselportal/?chlang=en), and
  the wiki carries eight derived Battleship genres including *Japanese Battleships* and
  *Numerical Battleships* (https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en).

## 1.26 Akari / Light Up (美術館, "Bijutsukan")

**Rules** (https://wiki.logic-masters.de/index.php/Akari/en): "Place a lightbulb in some
cells so that all cells in the grid are lightened. Lightbulbs can give light in straight
lines until the rays meet a black cell or the edge of the grid. Lightbulbs should not
lighten each other. A digit in a cell indicates the number of the lightbulbs that are
adjacent to that cell." Invented by Nikoli, 2001
(https://erasablegames.com/akari-light-up-on-sudoku/). puzz.link's rules file for `akari`
is the one file in the corpus that does not carry a parseable rules string, so the LMD
wiki is the source here.

**Structure.** Decision: binary (bulb / no bulb) on white cells. Global: every white cell
is lit, no two bulbs see each other. Clues: orthogonal bulb counts (0..4) on black cells,
plus the black-cell layout, which is given.

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* 81 digits, 81 bulb bools, plus sight structure.

*Expensive globals.* No connectivity and no flow, but two sight-driven rules over
the same prefix chains: every white cell is lit (`AddBoolOr` over the bulbs
visible from it) and no two bulbs see each other (pairwise clauses along each
maximal run). Both are **static clause lists** once the black-cell layout is
fixed: for each maximal horizontal and vertical run of white cells, "at most one
bulb in the run" plus "the run's cells are lit iff the run holds a bulb". That is
a clean, cheap encoding — much better than generic sight bools — precisely because
the blockers are *given*.

*Size and cost on 9x9.* 81 bools and a few hundred clauses. **Cheap.**

*Digit coupling.* Here is the problem, and it is structural rather than
arithmetic. Akari needs a given black-cell layout to be a puzzle, and a sudoku grid
has no black cells. Derive the blockers from the digits and the sight runs stop
being static — every clause becomes conditional on the blocker pattern, which turns
a few hundred clauses into a reified mess and reintroduces per-cell sight chains.
Overlay a fixed pattern instead and the two halves barely interact.

*Verdict.* **Workable.** Cheap only in the form where the interaction is weakest;
expensive exactly when you make it interesting.

**Existing hybrids:** *Akari (Light Up) on Sudoku*, Erasable Games, 2007-12-24 by Robert
Katz (https://erasablegames.com/akari-light-up-on-sudoku/) — an adapted Akari on a Sudoku
frame. LMD carries an Akari tag (https://logic-masters.de/Raetselportal/?chlang=en). Thin
evidence compared with the genres above.

## 1.27 Dominion

**Rules** (https://puzz.link/js/pzpr-samples/dominion.js): "Shade some cells on the board
to divide all unshaded cells into regions. 1. All shaded cells are orthogonally adjacent to
exactly one other shaded cell. 2. Cells with letters cannot be shaded. 3. All identical
letters must be in the same region. There can not be a region without any letters.
4. Different letters must be in different regions. 5. Question marks can be replaced with
any letter, as long as it appears elsewhere on the grid." Invented by Inaba Naoki.

**Structure.** Decision: binary shade. Global: shaded cells form dominoes (as in
Norinori), unshaded cells partition into regions with a letter-consistency condition.
Clues: letters.

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* 81 digits, 81 shading bools, 144 domino bools (as Norinori), plus
`rid`/flow for the white regions.

*Expensive globals.* The domino half is the cheap Norinori matching. The white
half needs region identity with a letter-consistency condition — one flow, plus
reified "same region" constraints tying equal letters together and different
letters apart.

*Size and cost on 9x9.* 144 + 81 bools, 288 flow ints. **Moderate.**

*Digit coupling.* The natural reading — letters are digits — makes rule 3 say all
nine cells holding a given digit are co-regional, and rule 4 that distinct digits
are in distinct regions. Together that forces the white cells to partition into at
most nine regions, one per digit, each containing all nine of its digit: an
extremely tight and probably infeasible condition alongside sudoku. It must be
weakened (letters on a subset of cells) before the model has solutions, and the
weakening is a design decision, not a modelling one.

*Verdict.* **Workable.** The encoding is routine; the coupling needs designing
before it is worth a model.

**Existing hybrids:** LMD carries a Dominion tag
(https://logic-masters.de/Raetselportal/?chlang=en). No Dominion x Sudoku hybrid found
(searched: LMD portal, GM Puzzles, general web). [unverified as absence]

## 1.28 Cross the Streams

**Rules** (https://puzz.link/js/pzpr-samples/cts.js): "Shade some cells on the board
according to the numbers. 1. Clues outside the grid represent the lengths of each of the
blocks of consecutive shaded cells in the corresponding row or column, in order from left
to right or top to bottom. 2. A question mark represents a block of any length (at least
1). 3. An asterisk represents an unknown amount of blocks of any length. An asterisk may
also be meaningless, i.e. represent no blocks at all. 4. The shaded cells cannot form a
2x2 square. 5. All shaded cells form an orthogonally contiguous area." Invented by Grant
Fikes; GM Puzzles runs it as a standing category with 95 posts
(https://www.gmpuzzles.com/blog/category/shading/cross-the-streams/).

**Structure.** Decision: binary shade. Global: connected shaded set, no 2x2 shaded. Clues:
ordered run-length sequences outside the grid, with wildcards — i.e. a nonogram clue plus
two global rules.

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* 81 digits, 81 shading bools, 288 flow arc ints, plus per-line
run-pattern machinery.

*Expensive globals.* One flow, 64 no-2x2 windows, and the nonogram line clue. The
right encoding for an ordered run-length clue with wildcards is **not** a chain of
reified run variables but an automaton: `AddAutomaton` over the 9 shading bools of
a line, with a DFA built in Python from the clue (including `?` and `*`
wildcards). One automaton constraint per clued line, 18 lines maximum, each over 9
literals. Exact, compact, and CP-SAT propagates automata well.

*Size and cost on 9x9.* 81 bools + 288 flow ints + up to 18 automata. **Moderate.**

*Digit coupling.* Not native. The natural hybrid rule — "the shaded digits in a
row, in order, are that row's run lengths" — couples an ordered digit sequence to
an ordered run sequence, which the automaton can carry if you widen its alphabet
to (shaded, digit) pairs. That is elegant but the alphabet grows to 10 symbols per
cell and the DFA gets large.

*Verdict.* **Workable.** `AddAutomaton` is the right tool and worth knowing about;
the coupling is invented and the widened-alphabet version is the expensive part.

**Existing hybrids:** LMD carries a Cross the Streams tag
(https://logic-masters.de/Raetselportal/?chlang=en). The direct number-placement analogue,
Japanese Sums, is a standing GM Puzzles genre with 30 posts
(https://www.gmpuzzles.com/blog/category/numberplacement/japanese-sums/) and is in effect
Cross the Streams with digits instead of shading — the clearest evidence that this clue
type carries a hybrid. No titled Cross the Streams x Sudoku found. [unverified as absence]

## 1.29 Coral (Coralfinder)

**Rules** (https://puzz.link/js/pzpr-samples/coral.js): "Shade some cells on the board
according to the numbers. 1. Clues outside the grid represent the lengths of each of the
blocks of consecutive shaded cells in the corresponding row or column, not necessarily in
order. 2. Rows or columns without numbers can contain any amount of shaded cells. 3. All
unshaded cells are connected through other unshaded cells to the outside of the grid.
4. The shaded cells cannot form a 2x2 square. 5. All shaded cells form an orthogonally
contiguous area." LMD wiki, under Coralfinder, adds that the coral "cannot touch itself
and cannot have any holes inside it"
(https://wiki.logic-masters.de/index.php/Coralfinder/en).

**Structure.** As Cross the Streams, but the run lengths are unordered and the white set
must reach the border (no holes). Clues: unordered multisets outside the grid.

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* As Cross the Streams, but the clue is an **unordered** multiset of
run lengths, so an automaton over one line no longer suffices — a DFA cannot count
an unordered multiset compactly. Encode instead with per-run-start bools and a
cardinality constraint per length value: `starts[p]` reified as "shaded here,
unshaded to the left", then for each clue value v, "the number of runs of length
exactly v equals its multiplicity". That is a few dozen reified bools per line.

*Expensive globals.* Two flows in effect: shaded connectivity, and "white reaches
the border", the same border-anchored reachability as Cave. Plus 64 no-2x2
windows.

*Size and cost on 9x9.* **Moderate to heavy** — unordered clues cost more than
ordered ones, and there are two connectivity conditions.

*Digit coupling.* Not native, same invented hooks as Cross the Streams.

*Verdict.* **Workable**, and strictly more expensive than Cross the Streams for
the same puzzle content. If you build one of the two, build Cross the Streams.

**Existing hybrids:** LMD carries a Coral tag
(https://logic-masters.de/Raetselportal/?chlang=en), and the wiki carries *Easy As
Coralfinder* as a derived genre
(https://wiki.logic-masters.de/index.php/Easy_As_Coralfinder/en). No Coral x Sudoku hybrid
found. [unverified as absence]

## 1.30 Creek

**Rules** (https://puzz.link/js/pzpr-samples/creek.js): "Shade some cells on the board.
1. Numbers indicate the amount of shaded cells which overlap the clue. 2. All unshaded
cells on the board form an orthogonally connected area." Nikoli vol. 110. Clues sit on
grid *vertices*, so "overlap the clue" means the up-to-four cells touching that vertex.

**Structure.** Decision: binary shade. Global: unshaded connected. Clues: a 0..4 count at
each grid vertex.

**Sudoku hybrid suitability under the CP-SAT lens: Workable, and cheap.**

*Variables.* 81 digits, 81 shading bools, 288 flow arc ints.

*Expensive globals.* One flow (white connectivity) and nothing else. Each clue is
`sum of the up-to-four cells touching this vertex == value`, a linear equality over
bools. There are 64 interior vertices plus border ones, so at most ~100 possible
clue positions, each a one-line constraint.

*Size and cost on 9x9.* 81 bools + 288 flow ints + ~20 linear clues. **Cheap to
moderate.**

*Digit coupling.* The attraction is positional: clues live on grid *vertices*, the
same real estate Kropki dots and XV pairs use, so they cost the sudoku no cell
space. But a vertex is not a cell, so "clue == digit" needs a rule saying *which*
cell's digit a vertex clue reads — typically the cell down-right of it. That works
and is linear, but it is an invented convention, and with only white connectivity
as a global the shading stays loosely determined, needing many clues.

*Verdict.* **Workable.** Cheap model, novel clue placement, weak determination.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 1.31 Tetrochain

**Rules** (https://puzz.link/js/pzpr-samples/tetrochain.js): "Place several tetrominoes
(blocks of 4 cells) in the grid. 1. Tetrominoes cannot be orthogonally adjacent.
2. Tetrominoes cannot overlap a number. 3. A number indicates the amount of cells used by
tetrominoes in the given direction. 4. Two tetrominoes which touch each other at the
corners must have different shapes, counting rotations and reflections as the same.
5. All tetrominoes form a diagonally contiguous area." Nikoli vol. 181.

**Structure.** Decision: binary occupancy constrained to tetromino shapes. Global:
diagonal chain connectivity, orthogonal separation, corner-touching shapes differ. Clues:
directional counts from a clue cell.

**Sudoku hybrid suitability under the CP-SAT lens: Poor.**

*Variables.* 81 digits, 81 occupancy bools, plus tetromino placement bools over
the whole grid (not per box) — several hundred, since placements are unrestricted.

*Expensive globals.* Rule 5 is a **diagonal** connectivity requirement over the
set of tetrominoes, i.e. a flow on the quotient graph of placements under diagonal
adjacency — the same awkward construction as Mochikoro's, and the quotient graph
is itself determined by the decision variables, which is the hard case. Rule 1
(orthogonal separation) and rule 4 (corner-touching shapes differ) are clause lists
over placement pairs, cheap. Directional count clues are linear.

*Size and cost on 9x9.* **Heavy**, dominated by a connectivity flow over a
variable graph.

*Digit coupling.* Only the directional count clue, which is in range but weak.

*Verdict.* **Poor.** It is LITS without the box partition that made LITS's
placement encoding small, plus a harder global. Model LITS instead.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 1.32 Tetrominous — see 3.9 (region division)

Tetrominous divides the grid into tetrominoes rather than shading cells; it belongs to the
region family and is covered there.

## 1.33 Yajilin — see 2.4 (loops)

Yajilin has a shading layer (unused cells are shaded, and shaded cells may not be
adjacent) but its primary decision layer is a loop, so it is covered in the loop section.

## 1.34 Every other shading genre on the puzz.link index

Complete, not selective: every genre in the puzz.link shading sections (Shading
Puzzles, Areas and Shading Puzzles, No Adjacent No Divide) that has no full entry above.
Rule cores are condensed from `https://puzz.link/js/pzpr-samples/<id>.js`. The devices
column names which of the section 6 encoding building blocks a CP-SAT model would reach
for; it is a routing note, not a verdict, and none of these was analysed in full.

| Genre | Rule core (puzz.link) | Devices a model would need |
| --- | --- | --- |
| Akichiwake (`akichi`) | You're given a board divided into rooms. Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. A number indicates the size o... | flow to a root, region ids or placements, count clue, position vars |
| Aquarium (`aquarium`) | The grid represents an aquarium viewed from the side, which must be partially filled with water. 1. The numbers around the grid indicate the number of shaded cells in... | position vars — **Workable / cheap.** Per-region gravity plus outside counts, both linear. Invented by Inaba Naoki; LMD carries an Aquarium tag. |
| Ayeheya (`ayeheya`) | You're given a board divided into rooms. Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. A number indicates the amount... | flow to a root, region ids or placements, count clue, position vars |
| Box (`box`) | Shade some cells on the board. 1. Each row and column has a certain value, indicated by the circled numbers in the right and bottom of the grid. 2. The numbers at the... | none of the standard devices — **Workable / cheap.** Pure linear arithmetic over a binary layer; flavourless but trivial to encode. |
| Chained Block (`chainedb`) | Shade some cells on the board to form blocks of any shape. 1. Each block must contain exactly one number or a question mark. 2. A number indicates the size of the bloc... | region ids or placements, count clue |
| Circles and Squares (`circlesquare`) | Shade some cells on the board. 1. Black circles must be shaded, while white circles must not be shaded. 2. The shaded cells cannot form a 2x2 square. 3. All shaded cel... | flow to a root, no-2x2 windows, rectangle lemma |
| Cocktail Lamp (`cocktail`) | Shade some cells on the board to form blocks. 1. Regions contain no more than one block, which is an orthogonally connected group of shaded cells. 2. A number indicate... | flow to a root, no-2x2 windows, rectangle lemma, region ids or placements, count clue, position vars |
| Context (`context`) | Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. An unshaded number shows the amount of orthogonally adjacent shaded ce... | flow to a root, count clue |
| Guide Arrow (`guidearrow`) | Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. All unshaded cells on the board form an orthogonally connected area. 3... | flow to a root, AddCircuit, no-2x2 windows, rectangle lemma |
| Heyablock (`heyablock`) | Shade some cells on the board. 1. All shaded cells in one region must be connected. 2. A number indicates the amount of shaded cells in a region. 3. If a region has no... | flow to a root, count clue, position vars |
| Hinge (`hinge`) | Shade some cells on the board. 1. A group of orthogonally connected shaded cells is called a block. Each block is cut exactly once by a single straight segment of regi... | region ids or placements, count clue, position vars |
| International Borders (`interbd`) | Shade some cells to divide the grid into countries. 1. Some cells have a number. The number indicates the amount of shaded cells orthogonally adjacent to this cell. 2.... | region ids or placements, count clue |
| Inverse LITSO (`invlitso`) | Place a tetromino (a block of 4 unshaded cells) in every outlined region, and shade the rest of the cells. 1. The shaded cells cannot form a 2x2 square. 2. Two identic... | flow to a root, no-2x2 windows, rectangle lemma, placement bools |
| Kurochute (`kurochute`) | Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. Numbers cannot be shaded. 3. There must exist exactly one shaded cell... | flow to a root, sight chain |
| Kuroclone (`kuroclone`) | Shade some cells on the board. 1. Numbers cannot be shaded. 2. Each region must include exactly two units (shaded blocks) and these units must have the same shape, cou... | region ids or placements, count clue, position vars |
| Look-Air (`lookair`) | Shade some cells on the board. 1. Every group of shaded cells must form a filled square. 2. Clues represent how many of the five cells forming a cross around the clue... | rectangle lemma, count clue — **Workable / moderate.** The "equal squares may not see each other" rule is sudoku-shaped; needs a sight chain. |
| Mannequin Gate (`mannequin`) | Shade exactly two cells in each outlined region. 1. A number indicates how many empty cells are between the two shaded cells in the region, when following the shortest... | flow to a root, region ids or placements, count clue, position vars |
| Martini (`martini`) | Shade some cells on the board to form blocks of orthogonally adjacent cells. 1. Black circles must overlap a block, while white circles must not overlap a block. 2. Ou... | flow to a root, region ids or placements, count clue, position vars |
| Mirroring Tile (`mrtile`) | Shade some cells on the board to form blocks of any shape. Some shaded cells are given. 1. A number indicates the size of the block that contains it. A block can have... | region ids or placements, count clue |
| No Three (`nothree`) | Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. A circle overlaps exactly one shaded cell. 3. Three consecutive shaded... | flow to a root — **Workable / moderate.** The distinct-gaps rule is genuinely arithmetic and couples to digits well. |
| Nonogram (`nonogram`) | Shade some cells on the board according to the numbers. 1. Clues outside the grid represent the lengths of each of the blocks of consecutive shaded cells in the corres... | region ids or placements, position vars |
| Norinuri (`norinuri`) | Shade some cells on the board to form regions of unshaded cells. 1. Each region contains exactly one number. 2. A number indicates the size of the region that contains... | region ids or placements, count clue |
| Nuri-Maze (`nurimaze`) | You're given a grid divided into tiles. Shade some tiles on the board to form a maze. 1. A tile is either completely shaded or unshaded. 2. Tiles containing a clue can... | flow to a root, AddCircuit, no-2x2 windows, rectangle lemma, region ids or placements |
| Nuri-uzu (`nuriuzu`) | Shade some cells on the board. 1. The unshaded areas must form blocks with exactly one star. You cannot shade a cell overlapping a star. 2. Unshaded areas must be rota... | no-2x2 windows, rectangle lemma, region ids or placements |
| One Room One Door (`oneroom`) | You're given a board divided into rooms. Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. A number inside a room indica... | flow to a root, region ids or placements, count clue, position vars |
| Paintarea (`paintarea`) | You're given a grid divided into tiles. Shade some tiles on the board. 1. A tile is either completely shaded or unshaded. 2. There can not be a 2x2 square of all shade... | flow to a root, no-2x2 windows, rectangle lemma, region ids or placements, count clue |
| Parquet (`parquet`) | You're given a grid divided into regions and tiles. Shade some tiles on the board. 1. A tile is either completely shaded or unshaded. 2. Within each thick-outlined reg... | flow to a root, AddCircuit, no-2x2 windows, rectangle lemma, region ids or placements |
| Patchwork (`patchwork`) | Divide the grid into square-shaped regions, then shade some cells. 1. A number indicates how many shaded cells are in the region. Regions can have any amount of identi... | rectangle lemma, region ids or placements, count clue, position vars |
| Ququ (`ququ`) | Shade some triangles on the board. 1. Triangles with numbers or question marks cannot be shaded. 2. Unshaded triangles which share an edge form regions. Each region co... | region ids or placements, count clue |
| Tasquare (`tasquare`) | Shade some cells on the board. 1. Shaded cells must form filled squares. 2. Cells with clues cannot be shaded. 3. Numbers indicate the sum of the size of all blocks th... | flow to a root, rectangle lemma, region ids or placements, position vars — **Workable / moderate.** Kurotto with a square-shape rule: same block-size-sum clue, tighter shape. |
| Tawamurenga (`tawa`) | Shade several cells in the hexagonal grid. 1. Each shaded cell must have at least one shaded cell below it (unless it's on the bottom row). 2. There can not be a horiz... | count clue |
| Tilepaint (`tilepaint`) | You're given a grid divided into tiles. Shade some tiles on the board. 1. A tile is either completely shaded or unshaded. 2. A clue on the bottom of a cell indicates t... | region ids or placements, count clue |
| Uso-one (`usoone`) | You're given a board divided into region. Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. Numbers cannot be shaded. 3.... | flow to a root, region ids or placements, count clue |
| Yajisan-Kazusan (`yajikazu`) | Shade some cells on the board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. A number indicates the amount of shaded cells in the given direction.... | flow to a root, count clue |

---

# 2. Loop and path puzzles

The decision layer is an edge set, not a cell set: per cell, which of its four sides the
line uses (or, for Slitherlink, which of the grid's vertex-to-vertex edges are on the
loop). Three facts dominate this family under the CP-SAT lens. First, `AddCircuit` with a
self-loop literal per cell states "one closed loop, some cells unvisited" in a single
constraint with subtour elimination built in — that one device carries most of this
section, and forcing the self-loops false upgrades it to full coverage. Second, coverage
is what costs: a loop that must visit every cell is a Hamiltonian circuit on 81 nodes and
the loop layer will then dominate the solve, so the genres that let the loop skip cells
(Masyu, Geradeweg, Balance Loop, Linesweeper) are markedly cheaper than those that do not
(Detour, Maxi Loop, Yajilin, Haisu). Third, and the reason to pay at all: a loop imposes an
*order* on the cells it visits, and order is the one thing a Sudoku grid does not otherwise
have — but expressing that order needs position variables, 81 ints and ~290 reified
equalities, which is the most expensive device in this document. Only Haisu's clue pays for
it natively.

## 2.1 Slitherlink (スリザーリンク; Fences, Rundweg, Loop the Loop, Number Line)

**Rules** (https://puzz.link/js/pzpr-samples/slither.js): "Draw lines along the edges of
some cells to form a loop. 1. The loop cannot branch off or cross itself. 2. A number
indicates the amount of edges surrounding the cell that are visited by the loop." Nikoli
vol. 26. The LMD wiki files it under *Fences*
(https://wiki.logic-masters.de/index.php/Slitherlink/en redirects there), and the LMD
portal's Slitherlink collection page states it as "Digits in the grid indicate how many
edge pieces that are adjacent to a grid cell (from 0 to 3) belong to the loop"
(https://logic-masters.de/Raetselportal/Suche/spezial.php?chlang=en&listname=rundwege).

**Structure.** Decision: one bit per *grid edge* (2 x 9 x 10 = 180 edges on a 9x9). Global:
the chosen edges form a single closed curve — every vertex has degree 0 or 2, and the
edge set is connected. Clues: a per-cell count 0..3 of used surrounding edges. Derived
structure worth exploiting: the loop partitions cells into inside and outside, which is a
free binary shading layer.

**Sudoku hybrid suitability under the CP-SAT lens: Good, and the edge layer is
smaller than it looks.**

*Variables.* 81 digits plus 180 **edge bools** (2 x 9 x 10 on a 9x9), not per-cell
loop-shape variables. Optionally 81 inside/outside bools.

*Expensive globals.* The single-loop condition. On an edge layer the clean
encoding is: every vertex has degree 0 or 2 (100 vertices, each a linear
constraint over its ≤4 incident edges with the domain {0,2}), plus subtour
elimination. Vertex degree alone permits multiple disjoint loops, so you need one
of: a single-commodity flow over selected edges to one chosen root, which is the
device the repo already runs; or `AddCircuit` on the *vertex* graph with arc
literals, which handles subtour elimination natively but needs a Hamiltonian
framing (self-loop literals for unvisited vertices) that fits Slitherlink well.
`AddCircuit` is the better first try here because the loop lives on vertices and
the genre allows vertices off the loop.

*The inside/outside bonus.* Add 81 parity bools with `inside[p] XOR inside[q] ==
edge between p and q` across every cell border, and the grid border pinned outside.
That is 144 XOR constraints and it hands you a free binary shading layer — plus it
is a strong redundant constraint that helps the solver, not just the puzzle.

*Size and cost on 9x9.* 180 edge bools + 100 degree constraints + circuit or flow
+ 81 inside bools + 144 XORs. **Moderate to heavy** — the largest decision layer
in the survey, and loop models are where CP-SAT time goes.

*Digit coupling.* Two options. Direct: the digit is the cell's edge count, but the
count is 0..3 and digits are 1..9, so the published hybrid remaps (4 acts as 0,
5-9 inert). That remap is a table constraint, fine. Better: couple through the
free inside/outside bools — "inside cells are even", "cages sum only their inside
cells" — all linear, no remap, and every digit participates.

*Verdict.* **Good**, with the inside/outside coupling rather than the clue-count
one. Budget the most solver time of any shading-family entry.

**Existing hybrids:** well attested.
- *Slitherlink Sudoku*, LMD 000H6A
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000H6A): normal
  Sudoku plus killer cages; "Draw a Slitherlink along the lines of the grid that passes
  through every cage"; "1s, 2s, and 3s are normal Slitherlink clues. 4s are 0s for the
  purposes of Slitherlink"; regions between the grid edge and the loop contain no 2x2
  areas and no repeated digits. Tagged "Sudoku, Slitherlink, Killer (Variant)".
- *Slitherlink Sum Sudoku* by hurrdurr, 2026-02-09, and *Slitherlink Yin Yang* by yttrio,
  2025-03-22 (83 solvers, 99%), both listed on the LMD Slitherlink collection page
  (https://logic-masters.de/Raetselportal/Suche/spezial.php?chlang=en&listname=rundwege);
  the same page lists *Filtered Out (fillomino/slitherlink)* by jwsinclair and *Japanese
  Slitherlink* by KNT, i.e. Slitherlink crossed with a region genre and with a
  number-placement clue type.
- LMD carries a Slitherlink tag (https://logic-masters.de/Raetselportal/?chlang=en); GM
  Puzzles has 121 Slitherlink posts
  (https://www.gmpuzzles.com/blog/category/loop/slitherlink/).

## 2.2 Masyu (ましゅ, "Mashu"; Pearl Necklace, White and Black Pearls)

**Rules** (https://puzz.link/js/pzpr-samples/mashu.js): "Draw lines through orthogonally
adjacent cells to form a loop that goes through every circle. 1. The loop cannot branch
off or cross itself. 2. The loop must turn on black circles and travel straight through
the cells before and after the circle. 3. The loop must go straight through white circles,
and turn in at least one of the cells on either side." Nikoli vol. 90; Nikoli's own
English page gives the same four rules (https://www.nikoli.co.jp/en/puzzles/masyu/).

**Structure.** Decision: per-cell loop shape (unused, or one of two straights and four
turns). Global: one closed loop, not required to visit every cell. Clues: white and black
circles constraining the loop's behaviour at and adjacent to a cell.

**Sudoku hybrid suitability under the CP-SAT lens: Good — the best loop entry.**

*Variables.* Per-cell loop shape as 6 bools (two straights, four turns) plus an
"unused" bool, `AddExactlyOne` per cell: 81 x 7 = 567 bools. Equivalently 162
half-edge bools with degree constraints, which is smaller and preferred: each cell
has degree 0 or 2 over its 4 sides, and the shape bools are derived only where a
clue needs them.

*Expensive globals.* One loop. `AddCircuit` over the 81 cells with 4 directed arc
literals each plus a self-loop literal per unvisited cell — ~370 literals, and
subtour elimination comes free from the constraint. This is the single most useful
fact for the whole loop family: **`AddCircuit` with self-loops is the right device
whenever the loop need not cover every cell**, which is Masyu, Geradeweg, Balance
Loop, Country Road, Moon or Sun, Castle Wall and Linesweeper.

*Size and cost on 9x9.* ~370 arc literals, 81 degree constraints, a handful of
clue constraints. **Moderate.** Cheaper than Slitherlink because the loop lives on
cells, matching the sudoku's own index space.

*Digit coupling.* The clue is shape-at-a-cell, which reifies directly: "black
circle" is `turn[p] AND straight[before] AND straight[after]`, a clause over
neighbouring shape bools. Coupling options are all cheap — circle colour decided by
digit parity is one reified clause per circle; "the digit gives the length of the
straight segment through this cell" is a sum of consecutive straight bools, linear;
the published Massive Masyudoku coupling ("the digit counts the cells the loop
visits in the corresponding box") is `x[p] == sum(on_loop[q] for q in box)`, a
plain linear equality and the cheapest coupling in the loop family.

*Verdict.* **Good.** Build the loop machinery here first; the rest of the family
reuses it.

**Existing hybrids:** the strongest evidence in the loop family.
- *Masyudoku* is a **named genre in its own right** on the LMD wiki
  (https://wiki.logic-masters.de/index.php/Masyudoku/en): "Fill some cells with digits 1
  to 6 so that each digit appears exactly once in every row, column and outlined region.
  All cells that are not filled with digits should be traversed with a Masyu loop."
- *Massive Masyudoku*, LMD 000SRW, 2026-05-12
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000SRW): a Masyu grid
  beside a Region-Sum-Lines Sudoku, with the interaction "the digits in the RSL sudoku
  grid state how many cells the loop visits in the corresponding 2x3 area of the Masyu".
- *Masyu-Slitherlink* is also a wiki genre
  (https://wiki.logic-masters.de/index.php/Masyu-Slitherlink/en), and the portal carries a
  *Variables Tapasyu* (Tapa x Masyu) entry
  (https://logic-masters.de/Raetselportal/?chlang=en).
- *Polysemy (Castle wall/Masyu/Knapp daneben)*, LMD 000OUD
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000OUD), from the Sudoku
  Skunkworks Discord's Puzzle Agency Contest.
- GM Puzzles runs *Castle Wall (Masyu)* hybrids as a standing form
  (https://www.gmpuzzles.com/blog/2021/08/castle-wall-masyu-by-mark-sweep/,
  https://www.gmpuzzles.com/images/puzzles/190618-CastleWall-Masyu.pdf), and has 121 Masyu
  posts (https://www.gmpuzzles.com/blog/category/loop/masyu/).

## 2.3 Country Road (カントリーロード)

**Rules** (https://puzz.link/js/pzpr-samples/country.js): "Draw lines through orthogonally
adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. Every
country must be visited exactly once. 3. A number indicates how many cells inside the
country are visited by the loop. 4. Two adjacent cells in different countries cannot both
be unused by the loop." Nikoli vol. 65. LMD wiki agrees
(https://wiki.logic-masters.de/index.php/Country_Road/en).

**Structure.** Decision: per-cell loop shape. Global: one loop; each region entered
exactly once (a strong regional constraint); no two unused cells adjacent across a region
border. Clues: a per-region visit count.

**Sudoku hybrid suitability under the CP-SAT lens: Good.**

*Variables.* Masyu's layer: 81 on-loop bools, per-cell degree over 4 sides,
`AddCircuit` arc literals with self-loops.

*Expensive globals.* One loop, plus rule 2 — each region visited exactly once.
"Visited exactly once" means the loop's intersection with a box is a single
contiguous path, which is *not* the same as "the box contains loop cells". Encode
it as: the number of loop edges crossing each box's boundary is exactly 2. That is
9 linear constraints over the border-crossing edge bools, exact and cheap, and it
is a much better encoding than any connectivity-within-box argument. Rule 4 (no
two unused cells adjacent across a region border) is a clause list over the 54
border pairs.

*Size and cost on 9x9.* ~370 arc literals + 9 linear + 54 clauses. **Moderate**,
the same as Masyu.

*Digit coupling.* Native and linear: `x[p] == sum(on_loop[q] for q in box(p))`,
range 1..9. Identical in shape to the published Masyudoku coupling, but here it is
the genre's own clue rather than an added rule.

*Verdict.* **Good.** The boundary-crossing-count trick makes the signature rule
nearly free, and the coupling is native. Best value in the loop family after Masyu
and Geradeweg.

**Existing hybrids:** LMD carries a Country Road tag
(https://logic-masters.de/Raetselportal/?chlang=en). No titled Country Road x Sudoku
hybrid found (searched: LMD portal, GM Puzzles, CTC, general web). [unverified as absence]

## 2.4 Yajilin (ヤジリン, "Arrow Ring"; also Yajirin)

**Rules** (https://puzz.link/js/pzpr-samples/yajilin.js): "Shade some cells on the board,
and draw a single loop that goes through all remaining cells. 1. The loop cannot branch
off or cross itself. 2. Shaded cells cannot be orthogonally adjacent. 3. Cells with
numbers or question marks cannot be shaded, and are not part of the loop. 4. A number
indicates the amount of shaded cells in the given direction." Nikoli vol. 86. A setter's
statement of the same rules: "Shade some white cells and then draw a single closed loop
through all remaining white cells. Shaded cells cannot share an edge with each other.
Some cells are outlined and in gray and cannot be part of the loop. Numbered arrows in
such cells indicate the total number of shaded cells that exist in that direction in the
grid" (https://swaroopg92.blogspot.com/2022/08/puzzle-no-173-yajilin.html).

**Structure.** Two decision layers at once: binary shade *and* a loop through every
unshaded, unclued cell. Global: one loop covering all non-shaded non-clue cells, shaded
cells non-adjacent. Clues: directional shaded counts on cells that are outside both layers.

**Sudoku hybrid suitability under the CP-SAT lens: Workable, and expensive.**

*Variables.* 81 digits, 81 shading bools, and a loop layer over the unshaded
non-clue cells: arc literals plus self-loops.

*Expensive globals.* The loop must cover **every** unshaded, unclued cell. Under
`AddCircuit` that is stated by forcing each such cell's self-loop literal false —
straightforward to write, but it makes the circuit near-Hamiltonian over a set the
solver is simultaneously choosing, which is the hardest combination in this
document. Shaded non-adjacency is 144 clauses. The directional clue is a linear sum
of shading bools along a ray, cheap.

*Size and cost on 9x9.* ~370 arc literals + 81 shading bools, with the coverage
condition coupling the two layers. **Heavy.**

*Digit coupling.* Awkward. Clue cells are outside both layers, so their digits do
double duty; the directional shaded count can exceed 9. The natural fixes push you
toward Koburin (2.13) or Regional Yajilin (2.28), both of which have in-range
clues on the same machinery.

*Verdict.* **Workable.** Two entangled decision layers with a near-Hamiltonian
coverage rule is the worst cost/coupling ratio among the well-known loop genres.

**Existing hybrids:** LMD carries a Yajilin tag
(https://logic-masters.de/Raetselportal/?chlang=en); GM Puzzles has 114 Yajilin posts
(https://www.gmpuzzles.com/blog/category/loop/yajilin/); the wiki carries *Yajilin Plus*
and *Majilin* as derived genres
(https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en). *Koburin* (2.13) is the
Nikoli-published Yajilin variant with adjacency clues. No titled Yajilin x Sudoku hybrid
found (searched: LMD portal, GM Puzzles, CTC, Logic Masters India, general web).
[unverified as absence]

## 2.5 Simple Loop (Loop Special / Pure Loop)

**Rules** (https://puzz.link/js/pzpr-samples/simpleloop.js): "Draw a loop that goes through
every unshaded cell. 1. The loop cannot branch off or cross itself. 2. The loop cannot go
through shaded cells." LMD wiki: "Draw a single closed loop that travels through all white
cells moving horizontally or vertically. The loop cannot cross itself"
(https://wiki.logic-masters.de/index.php/Simple_Loop/en).

**Structure.** Decision: per-cell loop shape. Global: a Hamiltonian circuit on the unshaded
cells. Clues: only the given shaded pattern.

**Sudoku hybrid suitability under the CP-SAT lens: Workable, and the right
scaffold to build first.**

*Variables.* 81 on-loop bools (all forced true on unshaded cells), arc literals,
degree constraints.

*Expensive globals.* A Hamiltonian circuit on the unshaded cells. `AddCircuit`
with every self-loop literal forced false on unshaded cells states it exactly in
one constraint — this is the cleanest use of `AddCircuit` in the survey, because
the node set is *given* rather than chosen.

*Size and cost on 9x9.* ~370 arc literals and nothing else. **Moderate**, and a
Hamiltonian circuit on 81 nodes is a real search, but with a fixed node set CP-SAT's
circuit propagator does the heavy lifting.

*Digit coupling.* Nothing native, everything supplied — which is the virtue.
"Digits along the loop in visit order obey X" is the interesting one and it needs a
**position variable** per cell: `pos[p]` in 0..80 with `pos[q] == pos[p] + 1`
reified on the arc literal `p -> q`, plus one cell pinned to 0. That is 81 ints and
~290 reified constraints, and it is the general device for any order-based coupling
(see Haisu, 2.25). It is not cheap, but it is the only way to express loop order,
and it is worth building once and reusing.

*Verdict.* **Workable.** Build this model first as the loop scaffold: fixed node
set, one constraint, and the position-variable device that the ordering genres need.

**Existing hybrids:** none found under this name (searched: LMD portal, GM Puzzles, CTC,
general web). The idiom is nonetheless ubiquitous in variant sudoku under other names —
any "draw a path through the grid and the digits along it obey X" ruleset is this
structure. [unverified as absence]

## 2.6 Castle Wall

**Rules** (https://puzz.link/js/pzpr-samples/castle.js): "Draw lines through orthogonally
adjacent cells to form a loop. 1. Lines cannot go through bold borders. 2. White cells
must be inside the loop, and black cells must be outside the loop. 3. A number with an
arrow indicates the number of line segments in that direction. Vertical arrows only count
vertical lines, and horizontal arrows count horizontal lines." Invented by Palmer Mebane.
A setter's fuller phrasing: "Numbers and arrows refer to the total sum of the lengths of
loop segments in the given direction. (An equivalent way to understand these values is to
count the number of cell borders crossed by the loop in that direction.)"
(https://swaroopg92.blogspot.com/2021/06/puzzle-no-157-castle-wall.html).

**Structure.** Decision: per-cell loop shape. Global: one loop; an explicit inside/outside
condition on clue cells. Clues: directional segment counts, each carrying an inside/outside
colour.

**Sudoku hybrid suitability under the CP-SAT lens: Good.**

*Variables.* Masyu's loop layer, plus the inside/outside parity bools that
Slitherlink gets for free — here they are required by the rules rather than
optional.

*Expensive globals.* One loop (`AddCircuit` with self-loops), plus the
inside/outside determination. Compute inside/outside with the crossing-parity
device: `inside[p] XOR inside[q] == (the loop edge separating p and q is used)`,
144 XOR constraints with the outside pinned at the border. Clue cells are then
pinned inside or outside by unit clauses. Rule 3's directional segment counts are
linear sums of edge-crossing bools along a ray.

*Size and cost on 9x9.* ~370 arc literals + 81 inside bools + 144 XORs.
**Moderate.** The XOR layer is cheap and, as in Slitherlink, acts as a strong
redundant constraint.

*Digit coupling.* Two halves, and the colour half is the cheap one: a clue's
inside/outside status maps to a digit property (parity, high/low) with one reified
clause. The count half can exceed 9 and is better used as a cage-sum-like quantity
than a single digit.

*Verdict.* **Good.** The genre hands you an explicit binary layer over the digits
and the encoding for it is 144 XORs.

**Existing hybrids:**
- *Castle Wall (Masyu)*, a repeated GM Puzzles form — by Mark Sweep, 2021-08-20
  (https://www.gmpuzzles.com/blog/2021/08/castle-wall-masyu-by-mark-sweep/), and by Ashish
  Kumar, 2019-06-18
  (https://www.gmpuzzles.com/images/puzzles/190618-CastleWall-Masyu.pdf).
- *Polysemy (Castle wall/Masyu/Knapp daneben)*, LMD 000OUD
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000OUD).
- LMD carries a Castle Wall tag (https://logic-masters.de/Raetselportal/?chlang=en); GM
  Puzzles has 66 Castle Wall posts
  (https://www.gmpuzzles.com/blog/category/loop/castle-wall/). No titled Castle Wall x
  Sudoku found. [unverified as absence]

## 2.7 Balance Loop

**Rules** (https://puzz.link/js/pzpr-samples/balance.js): "Draw lines through orthogonally
adjacent cells to form a loop that goes through every circle. 1. The loop cannot branch
off or cross itself. 2. The straight line segments coming out of a white circle must have
equal length. 3. The straight line segments coming out of a black circle must have
different lengths. 4. Numbers indicate the sum of the length of the line segments."
Invented by Prasanna Seshadri.

**Structure.** Decision: per-cell loop shape. Global: one loop through every circle. Clues:
per-circle equality/inequality of the two arm lengths, plus an optional arm-length sum.

**Sudoku hybrid suitability under the CP-SAT lens: Good.**

*Variables.* Masyu's loop layer plus, per circle, two **arm-length ints** in
0..8.

*Expensive globals.* One loop. The arm lengths need a segment-length device:
`len[p,d] == sum of consecutive straight-through bools from p in direction d`,
encoded as a chain of reified implications (the k-th cell counts only if all
earlier ones do) — the same prefix device as a sight clue, ~8 bools per direction
per circle. Then rules 2 and 3 are `len_a == len_b` or `len_a != len_b`, one
constraint each.

*Size and cost on 9x9.* ~370 arc literals + ~32 prefix bools and 2 ints per
circle. **Moderate.**

*Digit coupling.* The best in the loop family for directness: rule 4's "numbers
indicate the sum of the segment lengths" is `x[p] == len_a + len_b`, a plain linear
equality between a digit and two ints, in range on a 9x9. Rules 2 and 3 are
equality and inequality — the same shape as Kropki and inequality clues, which
compose with sudoku reasoning natively.

*Verdict.* **Good.** Native in-range linear coupling on a standard loop layer, and
the prefix device is shared with Geradeweg and the sight-clue genres.

**Existing hybrids:** none titled found (searched: LMD portal, GM Puzzles, CTC, general
web). GM Puzzles has 51 Balance Loop posts
(https://www.gmpuzzles.com/blog/category/loop/balance-loop/), so the genre is established
even though the hybrid is not. [unverified as absence]

## 2.8 Double Back

**Rules** (https://puzz.link/js/pzpr-samples/doubleback.js): "Draw a loop that goes through
every unshaded cell. 1. The loop cannot branch off or cross itself. 2. The loop cannot go
through shaded cells. 3. The loop visits each outlined region exactly twice." Invented by
Palmer Mebane.

**Structure.** Simple Loop plus a per-region visit count fixed at two. Clues: the region
partition only.

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* Simple Loop's layer (Hamiltonian on unshaded cells).

*Expensive globals.* The Hamiltonian circuit, plus "the loop visits each region
exactly twice", which by the Country Road argument is "exactly 4 loop edges cross
each box boundary" — 9 linear constraints, cheap and exact.

*Size and cost on 9x9.* As Simple Loop plus 9 linears. **Moderate.**

*Digit coupling.* None native; the region count is fixed at two rather than being
a per-box number, so there is no digit to read off. Country Road gives the same
machinery with a *variable* per-box count, which is a digit.

*Verdict.* **Workable**, and dominated by Country Road for hybrid purposes. Build
Country Road.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.9 Detour

**Rules** (https://puzz.link/js/pzpr-samples/detour.js): "Draw a loop that goes through
every cell. 1. The loop cannot branch off or cross itself. 2. A number indicates how many
times the loop turns inside the outlined region."

**Structure.** Hamiltonian loop over all cells, plus a per-region turn count. Clues: turn
counts.

**Sudoku hybrid suitability under the CP-SAT lens: Good, but the loop is the
tightest in the family.**

*Variables.* Loop layer with every self-loop literal false (Hamiltonian on all 81
cells), plus 81 turn bools.

*Expensive globals.* A Hamiltonian circuit on all 81 cells — the tightest global
here, and the loop layer will dominate the solve. The turn count is cheap: `turn[p]`
is reified from the cell's two incident directions being perpendicular, one
constraint per cell, and the clue is `sum(turn[q] for q in box) == value`.

*Size and cost on 9x9.* ~370 arc literals, 81 turn bools, 9 linear clues.
**Heavy**, entirely because of Hamiltonicity.

*Digit coupling.* Native and linear: `x[p] == sum(turn[q] for q in box(p))`, range
0..9. One of the cleanest couplings in the loop family — it is just that the loop
carries most of the puzzle, so the generator must keep sudoku clues light or the
two layers will over-determine each other.

*Verdict.* **Good** on coupling, **heavy** on search. Worth a prototype precisely
to measure how a full-coverage circuit behaves at 81 nodes, which is a number the
repo does not yet have.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.10 Geradeweg

**Rules** (https://puzz.link/js/pzpr-samples/geradeweg.js): "Draw lines through
orthogonally adjacent cells to form a loop that goes through every circle. 1. The loop
cannot branch off or cross itself. 2. Every straight line segment that touches a clue must
have a length equal to the clue's value. 3. A question mark can be replaced with any
number."

**Structure.** Decision: per-cell loop shape. Global: one loop through every circle. Clues:
a segment-length equality at each circle.

**Sudoku hybrid suitability under the CP-SAT lens: Good — the first loop genre to
model.**

*Variables.* Masyu's loop layer (arc literals with self-loops, degree
constraints), plus one segment-length int per circle in 1..9 and the prefix bools
that compute it.

*Expensive globals.* One loop, and nothing else. Rule 2 — "every straight segment
touching a clue has length equal to the clue" — is a per-circle constraint over the
same prefix-length device as Balance Loop, and because it pins *both* arms to the
same value it prunes harder per clue than any other loop clue in the survey.

*Size and cost on 9x9.* ~370 arc literals + ~32 prefix bools and one int per
circle. **Moderate**, at the cheap end of the loop family.

*Digit coupling.* The cleanest in the whole document: segment length on a 9x9 runs
1..9, exactly the digit range, and the clue is one number in one cell. `x[p] ==
len[p]` — a bare equality between a digit variable and a model int, no remap, no
reification chain at the coupling itself. The loop need not cover every cell, so
the digit layer keeps real freedom.

*Verdict.* **Good.** Best coupling-to-cost ratio of any loop genre, and no
published hybrid exists. The strongest loop pick.

**Existing hybrids:** LMD carries a **Geradeweg tag alongside its Sudoku tag**
(https://logic-masters.de/Raetselportal/?chlang=en), which is the portal's own signal that
the genre is in circulation there. No titled Geradeweg x Sudoku hybrid surfaced this round
(searched: LMD portal, GM Puzzles, CTC, general web). [unverified as absence]

## 2.11 Maxi Loop

**Rules** (https://puzz.link/js/pzpr-samples/maxi.js): "Draw a loop that goes through every
cell. 1. The loop cannot branch off or cross itself. 2. A number indicates the length of
the longest visit to that region." Invented by Inaba Naoki.

**Structure.** Hamiltonian loop over all cells; per-region, the longest single contiguous
visit. Clues: that maximum.

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* Hamiltonian loop layer plus per-box visit-run lengths.

*Expensive globals.* Hamiltonicity on 81 cells (as Detour), plus a **maximum**
over the lengths of the loop's contiguous visits to a box. A max is
`AddMaxEquality` over a set of run-length ints, and the runs themselves must be
identified — which needs entry/exit detection per box and a length per run. That
is markedly more machinery than Detour's turn count for a weaker clue.

*Size and cost on 9x9.* **Heavy.**

*Digit coupling.* `x[p] == max run length in box`, in range. Native, but a maximum
constrains one run and says nothing about the others, so each clue prunes less than
Detour's turn count for more encoding.

*Verdict.* **Workable**, dominated by Detour.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.12 Mid-Loop (真ん中のループ)

**Rules** (https://puzz.link/js/pzpr-samples/midloop.js): "Draw lines through orthogonally
adjacent cells to form a loop that goes through every circle. 1. The loop cannot branch off
or cross itself. 2. Each circle marks the center of the straight line segment it lies on."
Nikoli vol. 163. Note: circles sit on cell edges or centres depending on parity, so a
segment of even length has its "centre" on a border.

**Structure.** Decision: per-cell loop shape. Global: one loop through every circle. Clues:
a midpoint assertion — geometric, not numeric.

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* Masyu's loop layer plus prefix arm lengths per circle.

*Expensive globals.* One loop. The midpoint rule is `len_a == len_b` measured from
the circle's position — the Balance Loop white-circle constraint — except that
circles may sit on cell borders as well as centres, so the model needs two circle
geometries. Handle that by placing circles on a half-integer index and computing
arm lengths in half-cells, which doubles the prefix chains.

*Size and cost on 9x9.* **Moderate.**

*Digit coupling.* None native — the clue carries no number. Adding one turns it
into Geradeweg. The positional virtue (circles on borders use Kropki real estate)
is real but does not by itself create coupling.

*Verdict.* **Workable.** Strictly weaker than Geradeweg on coupling, at similar
cost.

**Existing hybrids:** LMD carries a **Mid-loop tag alongside its Sudoku tag**
(https://logic-masters.de/Raetselportal/?chlang=en). No titled hybrid found.
[unverified as absence]

## 2.13 Koburin (こぶりん)

**Rules** (https://puzz.link/js/pzpr-samples/koburin.js): as Yajilin, except rule 4: "A
number indicates the amount of shaded cells in the (up to) four orthogonally adjacent
cells." Nikoli vol. 116.

**Structure.** As Yajilin (2.4), with a neighbourhood clue in place of a directional one.

**Sudoku hybrid suitability under the CP-SAT lens: Workable — Yajilin's cost,
Minesweeper's clue.**

*Variables.* As Yajilin: 81 shading bools plus a loop covering every unshaded
unclued cell.

*Expensive globals.* The same near-Hamiltonian coverage over a chosen node set
that makes Yajilin heavy. No relief here.

*Size and cost on 9x9.* **Heavy**, as Yajilin.

*Digit coupling.* Much better than Yajilin's: the clue is `sum of the ≤4
orthogonal neighbours' shading bools`, range 0..4, a plain linear equality with the
digit — the Minesweeper shape, the friendliest in the document.

*Verdict.* **Workable.** If you model anything in the Yajilin family, model this
one: identical solver cost, a strictly better coupling.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.14 Myopia

**Rules** (https://puzz.link/js/pzpr-samples/myopia.js): "Draw lines along the edges of
some cells to form a loop. 1. The loop cannot branch off or cross itself. 2. Arrows point
towards the lines closest to the clue. If a clue has multiple arrows, the distance to the
closest line must be the same. Directions without an arrow must have a line further away,
or not have a line in that direction."

**Structure.** Slitherlink's edge decision layer, with a nearest-line directional clue
instead of an edge count.

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* Slitherlink's 180 edge bools, degree constraints, circuit or flow.

*Expensive globals.* The loop, plus an **argmin** clue: the arrowed directions are
those whose nearest loop edge is closest, and unarrowed directions must be strictly
further or empty. Encode with a per-clue distance int per direction — computed by a
prefix chain over edges — then `dist_arrowed == min over all`, plus strict
inequalities for the unarrowed ones. `AddMinEquality` handles the min; the strictness
needs care when a direction has no edge at all, which wants a sentinel value.

*Size and cost on 9x9.* Slitherlink's layer plus 4 distance ints and ~4 prefix
chains per clue. **Heavy.**

*Digit coupling.* Not native — the clue is relational. "The digit gives the
distance" is the obvious fix, linear and in range, but it changes the genre.

*Verdict.* **Workable.** Slitherlink's expensive layer with a harder clue and no
native digit. Low priority.

**Existing hybrids:** LMD carries a **Myopia tag alongside its Sudoku tag**
(https://logic-masters.de/Raetselportal/?chlang=en), and the wiki has a Myopia page in
three languages (https://wiki.logic-masters.de/index.php/Myopia). No titled hybrid found.
[unverified as absence]

## 2.15 Onsen-Meguri (温泉めぐり)

**Rules** (https://puzz.link/js/pzpr-samples/onsen.js): "Draw lines through the center of
some cells to form multiple loops. 1. Loops cannot branch or overlap, and cannot cross
themselves or each other. 2. Every loop goes through exactly one circle, and every circle
must have a loop. 3. Every outlined room must be visited by at least one loop. 4. A loop
can enter and exit a room no more than once. 5. Each loop must visit the same amount of
cells in every room it enters. 6. A number indicates how many cells the loop visits in
each room." Nikoli vol. 155.

**Structure.** Multiple disjoint loops, one per circle. Global: per-room visit counts
constant within a loop (rule 5 is the genre's signature). Clues: that constant.

**Sudoku hybrid suitability under the CP-SAT lens: Poor to Workable — multi-loop
is the problem.**

*Variables.* A loop layer that must support **several disjoint loops**, which
`AddCircuit` cannot express: one circuit constraint means one circuit. Multi-loop
needs either one `AddMultipleCircuit` (CP-SAT has it, but it permits any number of
circuits, so "exactly one loop per circle" must then be imposed separately) or a
loop-id int per cell with reified equality across arcs plus a per-id flow.

*Expensive globals.* Loop identity per cell is the cost, and it is the same
quotient-graph awkwardness as the diagonal-connectivity genres: a labelling whose
classes the solver is choosing. Rules 4 and 5 (a loop enters a room once, and
visits the same number of cells in every room it enters) then need per-loop,
per-room counts — a two-index family of ints.

*Size and cost on 9x9.* **Heavy.**

*Digit coupling.* Rule 5 is structurally Region Sum Lines, which is appealing, and
rule 6's per-room visit count is a digit in range. But you can get the Region Sum
Lines flavour from a single-loop genre at a fraction of the cost.

*Verdict.* **Poor to Workable.** Multi-loop models are the most expensive shape in
this survey; the puzzle content does not justify it.

**Existing hybrids:** none found under this name (searched: LMD portal, GM Puzzles, CTC,
general web). The Region Sum Lines analogy is visible in *Massive Masyudoku*, LMD 000SRW
(https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000SRW), which pairs a Masyu
loop with a Region-Sum-Lines Sudoku. [unverified as absence]

## 2.16 Pipelink (パイプリンク) and Loop Special (`loopsp`)

**Rules** — Pipelink (https://puzz.link/js/pzpr-samples/pipelink.js): "Draw a loop that goes
through every cell. 1. Two perpendicular line segments may intersect each other, but they
may not turn at their intersection or otherwise overlap. 2. Some cells have given loop
segments. These cells cannot have other lines added to them." Nikoli vol. 45. Loop Special
(https://puzz.link/js/pzpr-samples/loopsp.js) is the multi-loop version with numbered
circles: "All circles with identical numbers must be part of the same loop, and different
numbers must be in different loops." Nikoli vol. 57.

**Structure.** Decision: per-cell loop shape, *including a crossing state* — so the layer
is larger than the other loop genres. Global: Hamiltonian coverage (Pipelink), or loop
identity classes (Loop Special).

**Sudoku hybrid suitability under the CP-SAT lens: Poor.**

*Variables.* Crossings break the clean degree-2 formulation: a crossed cell has
degree 4, so the per-cell shape domain grows and `AddCircuit` no longer applies
directly — the loop is no longer a simple circuit on the cell graph. The standard
workaround splits each cell into two independent channels (horizontal and
vertical), doubling the node count to 162 and requiring a matching between them.
Loop Special additionally needs loop-id labels (see 2.15).

*Expensive globals.* A circuit over a split graph, plus, for Loop Special,
multi-loop identity.

*Size and cost on 9x9.* **Heavy.**

*Digit coupling.* Pipelink has no clue vocabulary at all beyond given segments.
Loop Special's "same number, same loop" is a genuine digit hook but it needs the
expensive loop-id layer to say it.

*Verdict.* **Poor.** Crossings cost real encoding and buy no coupling.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.17 Round Trip

**Rules** (https://puzz.link/js/pzpr-samples/roundtrip.js): "Draw lines through orthogonally
adjacent cells to form a loop. 1. The loop cannot branch off or retrace itself. When the
loop visits a cell twice, it must travel in a straight line each time. 2. The numbers to
the left/right of the rows indicate the number of cells visited by the nearest section of
the loop that travels horizontally in that row. Likewise, the numbers to the top/bottom of
the columns indicate the number of cells visited by the nearest section of the loop that
travels vertically in that column." Invented by Craig Kasper.

**Structure.** Loop with crossings allowed, plus outside clues counting the length of the
nearest parallel segment.

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* A loop with crossings (split-cell graph as in 2.16), plus per-row and
per-column nearest-segment length ints.

*Expensive globals.* The split-cell circuit, plus a "nearest section" clue which
is an argmin-then-length: find the closest horizontal run in the row, report its
length. That is a prefix scan plus a conditional length, ~2 chains per clue.

*Size and cost on 9x9.* **Heavy**, mostly from crossings.

*Digit coupling.* Outside clues are the standard sudoku idiom and the length is
1..9, in range — the coupling is good. It is the decision layer that is expensive.

*Verdict.* **Workable.** Good clue, costly loop. If you want an outside-clue loop,
consider putting outside clues on a no-crossing genre instead.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web). GM
Puzzles has 18 Round Trip posts
(https://www.gmpuzzles.com/blog/category/loop/round-trip/). [unverified as absence]

## 2.18 Tapa-Like Loop

**Rules** (https://puzz.link/js/pzpr-samples/tapaloop.js): "Draw lines through orthogonally
adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. The loop
cannot go through clues. 3. Clues represent the numbers of consecutive cells occupied by
the loop each time it enters the (up to) eight cells surrounding the clue. 4. A question
mark can be replaced by any positive number. If a cell only has a single question mark, the
number is allowed to be zero."

**Structure.** Loop decision layer with Tapa's 8-neighbourhood run-length clue.

**Sudoku hybrid suitability under the CP-SAT lens: Good.**

*Variables.* Masyu's loop layer plus, per clue, the 8 neighbour on-loop bools.

*Expensive globals.* One loop. The clue is Tapa's, and it gets Tapa's encoding:
enumerate the 256 patterns of the 8-neighbourhood in Python, keep those whose
run multiset matches the clue, post with `AddAllowedAssignments`. Exact, one table
per clue, no auxiliary run variables — and as in Tapa, the clue cell's own digit
can be a column of the table, making "digit == clue" free.

*Size and cost on 9x9.* ~370 arc literals + a ≤256-row table per clue.
**Moderate.** The clue side is free; the loop side is the standard cost.

*Digit coupling.* Native via the table trick, range 1..8. Plus the loop supplies
ordering structure that plain Tapa lacks.

*Verdict.* **Good.** Tapa's best-in-class clue encoding mounted on the standard
loop layer — the most under-explored Good entry in the loop family.

**Existing hybrids:** the LMD portal carries a *Variables Tapasyu* entry — Tapa x Masyu
(https://logic-masters.de/Raetselportal/?chlang=en). *Regional Necklace Tapa Loop* by
swaroop guggilam (https://swaroopg92.blogspot.com/2021/07/puzzle-no-167-regional-necklace-tapa.html)
combines a Tapa clue set, a shading layer and a loop that alternates between shaded and
unshaded cells, with a per-region turn count — a live example of Tapa clues driving a loop.
GM Puzzles has 33 Tapa-Like Loop posts
(https://www.gmpuzzles.com/blog/category/loop/tapa-like-loop/). No titled Sudoku hybrid
found. [unverified as absence]

## 2.19 Moon or Sun (お月さまと太陽)

**Rules** (https://puzz.link/js/pzpr-samples/moonsun.js): "Draw lines through orthogonally
adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. Every
region must be visited exactly once. 3. Within a region, the loop must pass through all
moons and no suns, or all suns and no moons. 4. All regions must have at least one moon or
sun that is used by the loop. 5. The loop may not pass through the same type of clue in two
consecutively used regions." Nikoli vol. 154.

**Structure.** Loop with per-region single visit; a binary choice per region (moons or
suns) that must alternate along the loop's region sequence.

**Sudoku hybrid suitability under the CP-SAT lens: Good.**

*Variables.* Masyu's loop layer, plus one **choice bool per region** (this box
takes moons or suns) and the box-boundary crossing counts.

*Expensive globals.* One loop; "every region visited exactly once" is the Country
Road trick — exactly 2 loop edges cross each box boundary, 9 linear constraints.
Rule 3 is then a clause per clue: if the box is in moon mode, every moon in it is
on the loop and every sun is off. Rule 5 — no two *consecutively visited* regions
share a clue type — is the only rule needing the loop's region order, and it is
expressible without full position variables: because each box is entered once, the
loop induces a cyclic sequence of boxes, and consecutive boxes are those joined by
a loop edge across their shared border. So rule 5 becomes: for each pair of
adjacent boxes, if a loop edge crosses their shared border then their mode bools
differ. That is ~12 reified clauses, and it is the neat encoding of this genre.

*Size and cost on 9x9.* ~370 arc literals + 9 mode bools + ~21 linear/clauses.
**Moderate.**

*Digit coupling.* Map moon/sun onto a digit property (parity, high/low) and the
alternation becomes a statement about digits with one reified clause per clue — a
two-way interaction with no invented arithmetic.

*Verdict.* **Good.** The alternation rule reduces to adjacent-box mode bools, which
is far cheaper than it first appears.

**Existing hybrids:** LMD carries a **Moon-or-Sun tag alongside its Sudoku tag**
(https://logic-masters.de/Raetselportal/?chlang=en). No titled hybrid found.
[unverified as absence]

## 2.20 Numberlink (ナンバーリンク) and Arukone

**Rules** — Numberlink (https://puzz.link/js/pzpr-samples/numlin.js): "Draw paths going
through the cells to connect identical numbers. 1. Two paths cannot occupy the same cell."
Arukone (https://puzz.link/js/pzpr-samples/arukone.js) is the variant that additionally
requires full coverage: "2. All cells must be used by a path connecting two letters." The
LMD wiki states Arukone as "Connect the same letters with a line going horizontally and
vertically from field to field. Every field can be used only once"
(https://wiki.logic-masters.de/index.php/Arukone/en).

**Structure.** Decision: per-cell, which path (if any) occupies it and in what shape.
Global: disjointness; for Arukone, full coverage. Clues: the endpoint pairs.

**Sudoku hybrid suitability under the CP-SAT lens: Poor.**

*Variables.* A path-id int per cell plus per-cell shape, or one flow network *per
endpoint pair* — with nine digit-pairs that is nine commodities, ~2600 flow ints.

*Expensive globals.* Multi-commodity flow is the most expensive connectivity shape
in this document. Numberlink also famously admits many solutions without a full
coverage rule, so uniqueness proofs will be slow and often negative.

*Size and cost on 9x9.* **Heavy.**

*Digit coupling.* The only natural hook — endpoints are digits, identical digits
connected — forces all nine cells of each digit onto one path, which is
over-tight in the same way Dominion's letter rule is.

*Verdict.* **Poor.** Expensive encoding, weak coupling, bad uniqueness behaviour.

**Existing hybrids:** LMD carries a Number Link tag
(https://logic-masters.de/Raetselportal/?chlang=en). No Sudoku hybrid found.
[unverified as absence]

## 2.21 Nagenawa (なげなわ) and Ring-Ring

**Rules** — Nagenawa (https://puzz.link/js/pzpr-samples/nagenawa.js): "Draw lines through
the center of some cells to make rectangular loops. 1. Loops may cross each other, but may
not overlap or share a corner. 2. Numbers indicate how many cells in the outlined region
are used by a loop." Nikoli vol. 123. Ring-Ring
(https://puzz.link/js/pzpr-samples/ringring.js): same rectangle-loop rules, but "fill each
empty cell with a rectangular loop" — full coverage, no numeric clue. Nikoli vol. 135.

**Structure.** Decision: rectangle placements rather than free loop shapes. Global:
non-overlap, no shared corners, crossings allowed. Clues: per-region usage counts
(Nagenawa) or none (Ring-Ring).

**Sudoku hybrid suitability under the CP-SAT lens: Workable, and cheaper than it
looks.**

*Variables.* Not a free loop layer: **rectangle placement bools**. Every loop is a
rectangle, so enumerate all rectangles on a 9x9 (2025 of them, or fewer with a
minimum side of 2) and pick a subset. That converts a loop genre into a placement
genre, which is the single biggest cost saving available in this family.

*Expensive globals.* No circuit constraint at all. Non-overlap and no-shared-corner
are pairwise clauses over placement bools, enumerated once in Python; crossings are
permitted, so only the forbidden pairs are listed. Per-region usage counts are
linear sums.

*Size and cost on 9x9.* ~2000 placement bools with a large but static clause list.
**Moderate** — big but shallow, and CP-SAT presolve reduces placement models well.

*Digit coupling.* Nagenawa's per-region usage count is a digit in range, linear.

*Verdict.* **Workable**, and notable as the one loop-family genre with no loop
constraint in its model.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.22 Snake (Schlange)

**Rules** (https://puzz.link/js/pzpr-samples/snake.js): "Shade some cells into the grid to
form a snake. 1. The snake cannot loop back on itself and visit a cell that's orthogonally
or diagonally adjacent to a cell it has visited before. 2. Black circles must lie on one
end of the path. 3. White circles must lie somewhere along the path, but not at an end.
4. A number outside the grid represents how many cells in the corresponding row or column
are shaded." LMD wiki: "Locate a snake in the grid that travels horizontally and vertically
without touching itself. The head and the tail of the snake are given. Numbers outside the
grid represent the amount of snake segments in the corresponding directions"
(https://wiki.logic-masters.de/index.php/Snake/en).

**Structure.** Decision: binary occupancy that must form a single self-avoiding path with
no diagonal self-contact. Global: path connectivity plus the king-move non-touching rule.
Clues: outside row/column counts, given head and tail.

**Sudoku hybrid suitability under the CP-SAT lens: Good.**

*Variables.* 81 occupancy bools plus a path structure. `AddCircuit` models a
*circuit*, not a path, so use the standard trick: add a virtual node joined to the
two given endpoints, turning the path into a circuit — one constraint, no flow.
Position ints if the coupling needs order.

*Expensive globals.* The circuit (with the virtual node) and the no-diagonal-
self-touch rule, which is a clause list: for every diagonally adjacent pair not
consecutive on the path, not both occupied. Stated over occupancy bools it is 128
clauses with a small exception list at each turn.

*Size and cost on 9x9.* ~370 arc literals + 81 bools + ~128 clauses. **Moderate.**

*Digit coupling.* Outside row and column counts are linear sums of occupancy bools
— the standard sudoku outside-clue idiom, exactly in range. Order-based couplings
("digits along the snake increase") need the position ints and the reified
`pos[q] == pos[p] + 1` device from Simple Loop (2.5), which is the expensive but
reusable part.

*Verdict.* **Good.** A well-understood placement-plus-path model, an in-range
native clue, and a published hybrid tradition to calibrate against.

**Existing hybrids:**
- LMD carries **both a Snake tag and a Snake (Variant) tag** alongside its Sudoku tag
  (https://logic-masters.de/Raetselportal/?chlang=en).
- *Yin-Yang Sudoku*, LMD 0004X6, names "Quarterthru's wonderful Snake-Sum series" as its
  inspiration (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=0004X6) — a
  snake-plus-digit-sum sudoku series.
- *Slithering Snakes* by logicanimal, 2025-12-30, and *A Snake In The Forest* by SlickSquid,
  2024-12-11, both on the LMD Slitherlink collection page
  (https://logic-masters.de/Raetselportal/Suche/spezial.php?chlang=en&listname=rundwege).
- The LMD wiki carries *Snake*, *Snakes*, *Dotted Snake*, *Sum Snake*, *Horse Snake*,
  *Dominosnake* and *Pathfinder Snake* as separate genres
  (https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en).

## 2.23 Slalom / Gokigen Naname (ごきげんななめ)

**Rules** — Gokigen Naname (https://puzz.link/js/pzpr-samples/gokigen.js): "Draw a diagonal
line in every cell, connecting two opposite corners. 1. A number indicates how many lines
meet at that corner. 2. Lines cannot form loops." Nikoli vol. 104. Note that LMD's *Slalom*
page describes this genre — "Put a diagonal wall into every field, in a way that no
completely closed areas occur. The numbers in the circles tell you, how many walls touch
this circle" (https://wiki.logic-masters.de/index.php/Slalom/en) — while puzz.link's
`slalom` pid is a different, gate-ordering loop genre
(https://puzz.link/js/pzpr-samples/slalom.js). The name collision is real; cite carefully.

**Structure.** Decision: two states per cell (the `/` or `\` diagonal). Global: acyclicity
of the resulting graph. Clues: vertex degree counts 0..4.

**Sudoku hybrid suitability under the CP-SAT lens: Workable, and very cheap.**

*Variables.* 81 diagonal bools (one per cell: `/` or `\`). That is the entire
decision layer — the smallest in the loop family.

*Expensive globals.* The vertex degree clue is a linear sum of the ≤4 incident
cells' diagonal bools, one constraint per clued vertex. The global is **acyclicity**
of the graph the diagonals form, which is the one genuinely awkward part: CP-SAT has
no native acyclicity constraint over an undirected edge selection. Options: encode a
spanning-forest with parent pointers and ranks (the cspuz device recorded in
`docs/research/connectivity-techniques.md` §1); or run it as a lazy cut loop —
solve, find a cycle, forbid exactly that cycle's diagonal pattern, re-solve — which
is the repo's own discipline from `renbanana_cpsat.py` and is exact.

*Size and cost on 9x9.* 81 bools, ~100 linear clues, plus the acyclicity device.
**Cheap to moderate** with lazy cuts, since cycles are rare in a well-clued grid.

*Digit coupling.* A diagonal is an orientation, not a quantity, so coupling is
wholly invented ("cells with `/` are odd"). The vertex clue could equal a digit
under an invented convention, as with Creek.

*Verdict.* **Workable.** Tiny model, a nice lazy-cut exercise, weak coupling.

**Existing hybrids:** the LMD portal carries the *Slalom* genre and a *Landvermessung* tag
(https://logic-masters.de/Raetselportal/?chlang=en). A Gokigen-style clue appears in a
Sudoku hybrid on meander lawn — "Draw a diagonal in every cell. Point clues [give] the
diagonals meeting at the point"
(http://meanderlawn.blogspot.com/search/label/puzzle). [Rules text partially recovered;
unverified.]

## 2.24 Icebarn (アイスバーン)

**Rules** (https://puzz.link/js/pzpr-samples/icebarn.js): "Draw a line that starts at the
IN arrow, and goes through every arrow before reaching the OUT arrow. 1. Two perpendicular
line segments may intersect each other only on icy cells, but the loop may not branch or
otherwise overlap. 2. The loop may not turn on icy cells. 3. The loop cannot go against the
direction of an arrow. 4. Connected icy cells are called an icebarn, and every icebarn must
be visited at least once." Nikoli vol. 108.

**Structure.** Directed path from IN to OUT; icy cells force straight travel and permit
crossings; arrows force direction.

**Sudoku hybrid suitability under the CP-SAT lens: Poor.**

*Variables.* A *directed* path with crossings permitted only on icy cells — so the
split-cell graph of 2.16 plus arc direction, plus per-icebarn visit bookkeeping.

*Expensive globals.* Directed path with terrain-conditional crossing rules, forced
directions at arrows, and "every icebarn visited at least once" over a
component-labelled terrain.

*Size and cost on 9x9.* **Heavy.**

*Digit coupling.* Directions are not quantities and the terrain must be given, so
a sudoku grid supplies neither clue content nor structure.

*Verdict.* **Poor.** Highest encoding cost, lowest coupling.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.25 Haisu and Kaisu

**Rules** — Haisu (https://puzz.link/js/pzpr-samples/haisu.js): "Draw a path from S to G
that goes through all cells. 1. The path cannot branch off or cross itself. 2. An outlined
region can be entered and exited multiple times. A number N indicates that the path must go
through that cell on the region's Nth visit." Invented by William Hu. Kaisu
(https://puzz.link/js/pzpr-samples/kaisu.js) is the variant where "On the region's Nth
visit the line must go through exactly N circles, or go through no circles."

**Structure.** Hamiltonian path from a fixed start to a fixed goal; clues index the visit
ordinal of a region.

**Sudoku hybrid suitability under the CP-SAT lens: Good, and the one genre that
justifies position variables.**

*Variables.* A Hamiltonian path from S to G — `AddCircuit` with a virtual node
joining G back to S — plus the **position int** `pos[p]` in 0..80 for every cell,
with `pos[q] == pos[p] + 1` reified on each arc literal. Then a per-box visit
ordinal: `visit[p]` in 1..9, the index of the box-visit that contains p.

*Expensive globals.* Hamiltonicity on 81 cells (as Detour, the tightest global
here) plus the position chain, ~290 reified equalities. The visit ordinal is
derived from position: a new visit starts at p iff p is in box b and its
predecessor is not, so `visit[p] == sum of visit-starts in box b at or before p` —
a prefix count over the path order, which is the expensive derived quantity.

*Size and cost on 9x9.* ~370 arc literals + 81 position ints + 81 visit ints +
~600 reified constraints. **Heavy** — the largest model in the survey.

*Digit coupling.* The best in the document, and the reason to pay: the clue *is*
an ordinal. `x[p] == visit[p]`, a bare equality, range 1..9 on a 9x9 with boxes as
regions. It gives the grid a total order over cells, which digits alone cannot
express, and nothing else here does that natively.

*Verdict.* **Good** on coupling, **heavy** on cost — the one genre where the
expensive position machinery buys something no cheaper genre offers. Build the
position device once in Simple Loop (2.5), then come here.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
Haisu is a young genre (William Hu is a current-generation setter), which is a plausible
reason. This is the most interesting unexploited hybrid in the loop family. [unverified as
absence]

## 2.26 Dotchi-Loop (どっちループ)

**Rules** (https://puzz.link/js/pzpr-samples/dotchi.js): "Draw lines through orthogonally
adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. The loop
goes through all unshaded circles. 3. Within a region, all unshaded circles contain either
a corner or a straight line. 4. The loop cannot go through a shaded circle." Nikoli vol. 167.

**Structure.** Loop; per-region, the circles agree on turn-vs-straight. Clues: circles, some
shaded (loop-forbidden).

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* Masyu's loop layer plus one mode bool per region (this box's circles
all turn, or all go straight).

*Expensive globals.* One loop. Rule 3 is then one reified clause per circle
against its box's mode bool — the same neat device as Moon or Sun's mode bools,
and equally cheap. Shaded circles are unit clauses forcing the cell off the loop.

*Size and cost on 9x9.* ~370 arc literals + 9 mode bools. **Moderate**, at the
cheap end.

*Digit coupling.* No numeric clue, so invented. Mapping the mode bool to a digit
property per box is the natural move and is one reified clause.

*Verdict.* **Workable.** Cheap on top of a loop layer you have already built, but
nothing native to couple to.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.27 Linesweeper

**Rules** (https://wpcunofficial.miraheze.org/wiki/Linesweeper, quoting the WPC 2019
instruction booklet): "Draw a closed loop into the grid that runs horizontally and
vertically and passes through each cell at most once. The loop does not pass through
numbered cells. The numbers indicate how many of the horizontally, vertically and
diagonally neighbouring cells are used by the loop." Invented and named by Jak Marshall
(UK) in 2010; the same page notes the rules are simple enough that the genre has probably
been reinvented several times, citing "Snake Pit" from WPC 1996 as an earlier appearance of
the identical clue. Appeared at WPC 2019 World Cup Round 1 (by Roland Voigt) and WPC 2017
Round 16 (by Ashish Kumar). Corroborating statements at
https://www.cross-plus-a.com/html/cros7lns.htm and
https://www.logic-puzzles.ropeko.ch/php/db/puzzle.php?id=158.

**Structure.** Decision: per-cell loop shape, the loop covering only some cells. Global: one
closed loop. Clues: an 8-neighbourhood count of loop cells, on cells the loop avoids — a
Minesweeper clue over a loop.

**Sudoku hybrid suitability under the CP-SAT lens: Good.**

*Variables.* 81 on-loop bools plus Masyu's arc literals with self-loops — the loop
may skip cells, which is exactly the case `AddCircuit` with self-loop literals
handles best.

*Expensive globals.* One loop, and nothing else. Clue cells are forced off the
loop by unit clauses.

*Size and cost on 9x9.* ~370 arc literals, one linear constraint per clue.
**Moderate** — at the cheapest end of the loop family, because there is no
coverage requirement, no region structure and no prefix chain anywhere.

*Digit coupling.* Native, linear and in range: `x[p] == sum(on_loop[q] for q in
neighbours8(p))`, 0..8 — the Minesweeper shape, the friendliest coupling in the
document, mounted on a loop. This is the cheapest way to get an order-bearing
decision layer with a native digit clue.

*Verdict.* **Good.** The same model serves Bosnian Road (3.18) with one rule flag
changed, so one build covers two genres.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 2.28 Regional Yajilin, Every Second Turn, Loop de Loop

**Regional Yajilin** (also "Yajilin (regions)"). Rules as stated by GridPuzzle
(https://fr.gridpuzzle.com/regional-yajilin, in French; my translation): the grid is
divided into regions; shade some cells and draw a single non-intersecting loop through all
white cells; a number in a region gives the count of shaded cells in that region; a region
without a number may contain any number of shaded cells; no two shaded cells may share a
border; the loop may visit numbered cells, and numbered cells may themselves be shaded.
**Source caveat: GridPuzzle is a puzzle-play site, not a rules authority of the standing of
puzz.link, the LMD wiki, Nikoli or a WPC booklet.** Regional Yajilin appears in neither the
puzz.link corpus nor the LMD wiki, and the LMD wiki's registered Yajilin derivatives are
*Yajilin Plus* and *Majilin* instead
(https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en). Treat the statement above
as [unverified at a primary source]. It is in active circulation — Puzzle Duel ran Regional
Yajilin 9x9 and 8x8 dailies in December 2025 and January 2026
(https://www.puzzleduel.club/archive).

*If that statement is right*, the hybrid verdict is **Good, and better than plain
Yajilin (2.4)**: "a number in a region gives the shaded count in that region" is the
per-box count hook that works so well for Heyawake, Chocona and Shimaguni, in digit range,
and it replaces Yajilin's awkward directional clue on loop-excluded cells. Verify the rules
at a primary source before building.

**Every Second Turn** (also "Alternate Corners") and **Loop de Loop**: **rules not found at
a primary source.** Neither is in the puzz.link genre corpus (244 ids checked) nor has an
LMD wiki page. Both are in circulation — Puzzle Duel ran Every Second Turn 10x12 and 12x12
dailies in 2025 (https://www.puzzleduel.club/archive) and Fit For Puzzle lists both in its
tutorial catalogue (https://fitforpuzzle.com/puzzle-tutorials/) — but that catalogue page
serves only its heading index to a fetcher, no rules bodies, so no rules text was recovered
and it was not retried. Dropped rather than reconstructed from memory.

## 2.29 Every other loop and line genre on the puzz.link index

Complete: every genre in the puzz.link loop and line sections (Make a Loop, Make a
Crossing Loop, Icebarn-like, Connecting Puzzles) with no full entry above. Devices as in
1.34.

| Genre | Rule core (puzz.link) | Devices a model would need |
| --- | --- | --- |
| All or Nothing (`nothing`) | Draw lines through orthogonally adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. If a country is visited by the loop, it must visit all... | AddCircuit — **Workable.** An all-or-nothing per-region rule, cleanly box-shaped. By Inaba Naoki. |
| Angle Loop (`angleloop`) | Draw lines between every symbol to form a loop. 1. Lines go straight from symbol to symbol, and can be drawn at any angle. 2. The loop can not branch off or intersect.... | AddCircuit, rectangle lemma |
| Anglers (`anglers`) | Draw lines so each person (represented by a number) is connected to a fish. 1. Lines cannot branch off or cross. A number or fish can not have more than one line. 2. A... | none of the standard devices — **Workable / cheap.** Outside clue, length in digit range, and no loop global at all. LMD carries an Anglers tag. |
| Ant Mill (`antmill`) | Shade some dominoes on the board to form a loop. 1. Two dominoes may not be orthogonally adjacent. 2. Every domino is diagonally adjacent to exactly two other dominoes... | flow to a root, AddCircuit, rectangle lemma |
| Barns (`barns`) | Draw a loop that goes through every cell. 1. Two perpendicular line segments may intersect each other only on icy cells, but the loop may not branch or otherwise overl... | AddCircuit, position vars |
| Building Walk (`bdwalk`) | You're given a top-down view of a building. Grey cells represent elevators. 1. Draw a path from S to G that doesn't branch off or overlap itself at any cell. 2. The pa... | count clue |
| Crossstitch (`crossstitch`) | Draw diagonal lines to make two loops. 1. A shaded cell is not part of any loop. 2. Loops cannot branch off or cross themselves, but they can cross each other. 3. Two... | AddCircuit, count clue |
| Disorderly Loop (`disloop`) | Draw lines through orthogonally adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. The loop cannot go through gray cells. 3. Arrows point... | AddCircuit, count clue, position vars — **Workable.** An ordered list of the next N segment lengths; digit-range but needs position-ish bookkeeping. |
| Ice Walk (`icewalk`) | Draw a loop that goes through every numbered cell. 1. Two perpendicular line segments may intersect each other only on icy cells, but the loop may not branch or otherw... | AddCircuit, count clue |
| Icelom (`icelom`) | Draw a line that starts at the IN arrow, and goes through every white cell before reaching the OUT arrow. 1. Two perpendicular line segments may intersect each other o... | AddCircuit, position vars |
| Icelom 2 (`icelom2`) | Draw a line that starts at the IN arrow, and goes through every number before reaching the OUT arrow. 1. Two perpendicular line segments may intersect each other only... | AddCircuit, position vars |
| Kouchoku (`kouchoku`) | Draw lines between every node to form a loop. 1. Lines go straight from node to node, and can be drawn at any angle. 2. The loop can not branch off. Nodes must be visi... | AddCircuit |
| Kusabi (`kusabi`) | Draw lines between the circles to form pairs. 1. Lines must turn exactly twice, and each turn must be in the same direction. 2. Lines cannot cross or overlap each othe... | none of the standard devices |
| Line of Sight (`lineofsight`) | Draw lines along the edges of some cells to form a loop. 1. The loop cannot branch off or cross itself. 2. A number represents the length of the first straight line se... | AddCircuit, count clue, sight chain — **Workable.** A visibility clue in digit range on the Slitherlink layer. By Inaba Naoki. |
| Mejilink (`mejilink`) | Draw lines over the dotted lines to form a loop. 1. The loop cannot branch off or cross itself. 2. The amount of cells in a region must equal the number of borders sur... | AddCircuit, count clue, position vars — **Workable.** A counting identity per region — a real arithmetic hook. |
| Mukkonn Enn (`mukkonn`) | Draw a loop that goes through every cell. 1. The loop cannot branch off or cross itself. 2. When the loop exits a clued cell from a side with a number, it must travel... | AddCircuit, sight chain — **Workable to Good.** As ovotovata, clued per cell. From the 2017 WPC organisers. |
| Nagareru-Loop (`nagare`) | Draw lines through orthogonally adjacent cells to form a directional loop. 1. The loop cannot branch off or cross itself. 2. The loop cannot go through a shaded cell.... | AddCircuit — **Poor.** Rich but wholly terrain-dependent, and directions are not quantities. |
| Nanameguri (`nanameguri`) | Draw lines through orthogonally adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. Cells can not be entered more than once. 2. Every outline... | AddCircuit — **Workable.** Country Road with a diagonal obstacle. |
| Ovotovata (`ovotovata`) | Draw lines through orthogonally adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. When the loop exits a numbered region in any direction... | AddCircuit, region ids or placements, sight chain — **Workable to Good.** A run-straight-then-turn length clue, in digit range. By Eric Fox. |
| Pipelink Returns (`pipelinkr`) | Draw a loop that goes through every cell. 1. Two perpendicular line segments may intersect each other only inside a circle, but the loop may not branch or otherwise ov... | AddCircuit |
| Rail Pool (`railpool`) | Draw a loop that visits every cell. 1. The loop cannot branch off or cross itself. 2. A line segment that overlaps a region must have a length indicated by one of the... | AddCircuit, region ids or placements — **Workable to Good.** A multiset of segment lengths per region — strong and digit-range. By Martin Ender. |
| Rassi Silai (`rassi`) | Draw multiple lines through orthogonally adjacent cells. 1. Each region contains exactly one line covering all of the region's cells. 2. Lines cannot branch off or cro... | AddCircuit, position vars |
| Reflect Link (`reflect`) | Draw lines through orthogonally adjacent cells to form a loop. 1. The loop cannot branch off or overlap. 2. All cells where the loop crosses itself are given. The loop... | AddCircuit |
| Remembered Length (`remlen`) | Draw lines through orthogonally adjacent cells to form a directional loop. 1. All unshaded cells must be visited. 2. The loop cannot branch off or cross itself. 3. Eac... | AddCircuit — **Workable to Good.** Next-region visit length, in digit range. By Palmer Mebane. |
| Scrin (`scrin`) | Place several rectangles into the grid, where the corners are located on the dots. 1. Rectangles cannot overlap or have a border in common. 2. A rectangle can contain... | AddCircuit, rectangle lemma, placement bools, count clue, position vars |
| Shirokuro-link (`wblink`) | Draw lines between the circles to form pairs. 1. Lines must be horizontal or vertical, and cannot turn. 2. Lines cannot cross or overlap each other. 3. Each pair consi... | none of the standard devices |
| Slalom (`slalom`) | Draw lines through orthogonally adjacent cells to form a directional loop, starting at the circle. 1. The loop cannot branch off or cross itself. 2. The loop cannot go... | AddCircuit, position vars |
| Touch Slitherlink (`tslither`) | Draw lines along the edges of some cells to form a loop. 1. The loop cannot branch off or cross itself. 2. A number indicates how many times the loop visits the set of... | AddCircuit, count clue — **Workable.** As vslither, counting edges and vertices together. |
| Train Stations (`trainstations`) | Draw a loop that goes through every cell. 1. The loop cannot branch off or overlap. 2. All cells where the loop crosses itself are given. The loop cannot cross itself... | AddCircuit, position vars |
| Vertex Slitherlink (`vslither`) | Draw lines along the edges of some cells to form a loop. 1. The loop cannot branch off or cross itself. 2. A number indicates the amount of vertices surrounding the ce... | AddCircuit, count clue — **Workable.** Slitherlink's 180-edge layer with a vertex count instead of an edge count. |
| Water Walk (`waterwalk`) | Draw a loop that goes through every numbered cell. 1. The loop cannot branch off or cross itself. 2. Blue cells represent water, while regular cells represent ground.... | AddCircuit, count clue — **Workable.** Two terrains plus a grounded-run length clue. By Martin Ender. |

---

# 3. Region-building and region-division puzzles

The decision layer is a region id per cell — equivalently, a border on/off per interior
edge. This family has the most natural digit interaction of the three, because a region
has a *size*, and size is a number. On a 9x9 the sizes that matter run 1..9, which is the
digit range, so "the digit is its region's size" needs no remapping. That single coincidence
is why the region family produces the cleanest Sudoku hybrids, and why Fillomino and
Shikaku hybrids are the ones that actually get set. Under the CP-SAT lens the family splits
sharply in two by encoding cost. Where the regions have a **fixed shape family** —
rectangles, L-shapes, polyominoes from a bank — enumerate the placements in Python and the
model becomes exact cover with no connectivity machinery at all (Shikaku, Nawabari,
Sashigane, Tatamibari, Statue Park). Where regions are **free-form**, you need region ids
and a flow (Araf, Nanro, Light and Shadow) — unless the genre forbids equal-sized regions
from touching, in which case the fillomino collapse makes the region derivable from the
digits and the whole layer disappears (Fillomino, Symmetry Area, Snake Pit).

## 3.1 Fillomino (フィルオミノ; Allied Occupation, Polyominous)

**Rules** (https://puzz.link/js/pzpr-samples/fillomino.js): "Divide the grid into regions.
1. A number indicates the size of the region, in cells. Regions can have any amount of
identical numbers, or none at all. 2. Two regions of the same size cannot be orthogonally
adjacent." Nikoli vol. 47. LMD wiki: "Dissect the diagram into areas and write a number in
every field. The numbers in one area have to be the same and have to tell the number of
fields in that area. Areas of same size may not touch horizontally or vertically, but
diagonally. Given numbers may belong to the same area, and it's possible that there are
areas where no number is given — even with larger numbers than the ones shown"
(https://wiki.logic-masters.de/index.php/Fillomino/en).

**Structure.** Decision: region partition (every cell gets a region id). Global: no two
same-size regions share an edge — a colouring-style condition on the *sizes*, which is what
makes the genre. Clues: numbers that are simultaneously the region size and, in classic
Fillomino, written in every cell of the region.

**Sudoku hybrid suitability under the CP-SAT lens: Good — the repo has already
built and measured this model.**

*Variables.* Exactly the set in `docs/research/fillomino-cpsat.md`: 81 digit ints
`x[p]`, 81 region-id ints `rid[p]`, 81 root bools, 144 `eq[p,q]` edge bools, 288
directed flow ints, 81 `emit` ints.

*Expensive globals.* One, and it does triple duty. The separation rule makes
regions **derivable from the digits** — a region is an orthogonally connected
component of equal digits — so there are no region objects, no region count and no
separation constraint written out. A single-commodity flow whose root emits its own
digit then delivers connectivity *and* digit-equals-size from one conservation
equation. That collapse is the most valuable encoding idea in this repo and the
reason Fillomino is cheaper to model than its rules suggest.

*Size and cost on 9x9.* ~324 ints, ~225 bools, 288 flow ints. **Moderate, and
measured**: sampling 0.1-1 s, uniqueness proofs 0.3-69 s across twelve seeds, median
10.4 s, worst 68.9 s against a 600 s cap. A strip loop is minutes to tens of minutes.
No extrapolation needed — the numbers are on file.

*Digit coupling.* There is no coupling to build, because there is no second layer:
the sudoku digit **is** the fillomino number. Adding sudoku to the model is 27
AllDifferent constraints on variables the fillomino model already has. That is the
limiting case of good coupling.

*Verdict.* **Good.** Lowest engineering risk of any entry — the model, the
self-check against brute force, and the runtime profile are all recorded.

**Existing hybrids:** the best-attested in the region family.
- *Fillomino sudoku*, LMD 000HFV, 2024-03-26
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000HFV):
  "Sudoku: Fill each row, column and 3x3 box with the digits 1-9. Fillomino: Divide the
  grid into regions of orthogonally connected cells. Two regions of the same size may not
  share an edge. Each region must contain at least one circle. Circles must contain the
  digit equal to the size of the regions they are in." Tagged "Sudoku, Fillomino", 116
  solvers at 95%, and **featured on Cracking The Cryptic**.
- *LITSomino*, LMD 000HEI
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000HEI): Fillomino x LITS.
- *Shikaku Fillomino #2 (9x9)*, LMD 000B8V
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000B8V): two region
  partitions over one grid, each cell in exactly one Fillomino and one rectangle.
- *Filtered Out (fillomino/slitherlink)* by jwsinclair, 2025-02-23, and
  *Wichtels Rätselherbst 2025 (12): Fillomino-Eckenrundweg* by wichtel, both on the LMD
  loop collection (https://logic-masters.de/Raetselportal/Suche/spezial.php?chlang=en&listname=rundwege).
- LMD carries **Fillomino and Checkered Fillomino tags** beside its Sudoku tag
  (https://logic-masters.de/Raetselportal/?chlang=en); the wiki carries *Fillomino
  Skyscrapers* and *Doppelstern-Fillomino* as registered genres
  (https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en); GM Puzzles has 158
  Fillomino posts (https://www.gmpuzzles.com/blog/category/regiondivision/fillomino/).

## 3.2 Symmetry Area (`symmarea`) — Fillomino with symmetry

**Rules** (https://puzz.link/js/pzpr-samples/symmarea.js): Fillomino's two rules plus
"3. Every region must have 180° rotational symmetry around its center."

**Sudoku hybrid suitability under the CP-SAT lens: Good, and nearly free on top of
Fillomino.**

*Variables.* Fillomino's set, plus a centre position per region — or, better, no
new variables at all: state the symmetry as a constraint over `rid`.

*Expensive globals.* Fillomino's flow, plus 180° symmetry. The cheap encoding
avoids naming centres: for every pair of cells p, q and every candidate centre, a
region containing p must contain its reflection. Enumerate reflections lazily
instead — solve, find an asymmetric region, forbid that exact membership pattern,
re-solve — which is the repo's lazy-cut discipline and is exact. Symmetry violations
are rare in a clued grid so the loop should be short.

*Size and cost on 9x9.* Fillomino's model plus a cut loop. **Moderate.**

*Digit coupling.* Fillomino's, unchanged and native.

*Verdict.* **Good.** A strict extension of the model the repo already runs, and a
good place to exercise lazy cuts on a region genre.

**Existing hybrids:** none found under this name (searched: LMD portal, GM Puzzles, general
web). [unverified as absence]

## 3.3 Araf (相ダ部屋, "Different Neighbors")

**Rules** (https://puzz.link/js/pzpr-samples/araf.js): "Draw lines over the dotted lines to
divide the board into several blocks. 1. Each block contains exactly two numbers. 2. The
size of the block must be between the two numbers, exclusive. 3. Question marks can be
replaced by any number." LMD wiki: "Divide the grid into some regions. Each region should
contain two numbers and the size of the region should be a number between those two"
(https://wiki.logic-masters.de/index.php/Araf/en). The wiki also registers *Different
Neighbours* as a genre (https://wiki.logic-masters.de/index.php/Different_Neighbours/en).

**Structure.** Decision: region partition. Global: exactly two clues per region. Clues: a
pair of numbers bracketing the region size strictly.

**Sudoku hybrid suitability under the CP-SAT lens: Good.**

*Variables.* 81 digits, 81 `rid` ints, 81 root bools, 288 flow ints, and a size
int per region.

*Expensive globals.* One flow. Unlike Fillomino there is no separation rule, so
regions are **not** derivable from the digits and real `rid` variables are needed —
but the flow is the plain kind (root emits the region size, cells absorb one),
which is the same conservation equation. Rule 1, exactly two clues per region, is a
linear sum over reified membership of clue cells.

*Size and cost on 9x9.* Fillomino's shape without the `eq` edge bools.
**Moderate.**

*Digit coupling.* Native and, unusually, a **range** rather than an equality: the
region's size is strictly between its two clue digits, `min(a,b) < size <
max(a,b)`, which is two linear inequalities over ints the model already has. The
looseness is the point — it stops the region layer from solving independently and
forces the digits to finish the puzzle, which is exactly the property that keeps a
hybrid from splitting into two puzzles.

*Verdict.* **Good.** Fillomino's machinery with a strictly looser clue, which is
better for hybrid design and no harder to encode. Unclaimed as a published hybrid.

**Existing hybrids:** none titled found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.4 Shikaku (四角に切れ, "Divide by Squares"; Number Areas, Rectangles)

**Rules** (https://puzz.link/js/pzpr-samples/shikaku.js): "Draw lines over the dotted lines
to divide the board into rectangles. 1. Each rectangle contains exactly one black circle.
2. A number indicates the size of the rectangle, in cells." Nikoli vol. 27. LMD wiki, with
the alternative names Number Areas and Divide by Box: "Divide the grid into rectangular and
square pieces so that each piece contains exactly one number, that each cell is part of one
piece and that the numbers represent the number of cells of the piece"
(https://wiki.logic-masters.de/index.php/Shikaku/en).

**Structure.** Decision: a rectangle placement per clue — a much smaller space than a free
partition. Global: the rectangles tile the grid exactly. Clues: area per rectangle.

**Sudoku hybrid suitability under the CP-SAT lens: Good — placement bools, no
flow at all.**

*Variables.* 81 digits, plus one bool per **candidate rectangle placement**. For a
clue at cell p with area a, the candidates are the rectangles of area a covering p:
a small set, enumerated in Python from the divisor pairs of a. Across a board with
~15 clues that is a few hundred bools.

*Expensive globals.* **None of the hard kind.** `AddExactlyOne` over each clue's
placements; each cell covered exactly once is a linear equality over the placements
containing it (81 constraints). No connectivity, no flow, no region ids, no 2x2
lemma — a rectangle is connected by construction. This is the cleanest encoding in
the whole region family.

*Size and cost on 9x9.* A few hundred placement bools, 81 cover equalities, ~15
exactly-ones. **Cheap.** An exact-cover model is the shape CP-SAT is best at.

*Digit coupling.* Native and in range: the digit in the circle is the rectangle's
area, 1..9 — which on a 9x9 means 1x1, 1x2, 1x3, 2x2, 2x3, 3x3, 1x9 and friends,
all meaningful shapes. When the area is a *variable* rather than a given, enumerate
placements for every (cell, area) pair and tie the placement bool to `x[p] == a`;
that is still a static table. "Digits do not repeat inside a rectangle" is pairwise
inequality reified on the placement bool, cheap because placements are explicit.

*Verdict.* **Good.** Exact cover over enumerated rectangles, no connectivity
machinery anywhere, native coupling, and published hybrids to calibrate against.
The best cost-to-value ratio in the region family.

**Existing hybrids:** well attested, by a strong setter.
- *Shikasudoku*, LMD 00087H, 2021-11-08 by Qodec
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=00087H), and *Shikasudoku
  2*, LMD 00093U, 2022-02-12 (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=00093U):
  "Divide the grid into rectangular regions of orthogonally connected cells. Each rectangle
  contains exactly one circle... A number in a circle represents how many cells are in the
  rectangle the circle belongs to... Every cell in the grid is part of a rectangle." The
  setter names Phistomefel's *Sudokurotto* and udukos's *Juosan Killer sudoku* as the
  inspirations — i.e. a small established line of pencil-genre x sudoku hybrids.
- *6x6 Shikaku Sudoku*, LMD 000IVK, 2024-07-10 by jinkey
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000IVK): adds
  "Shikaku rectangles of the same area may not touch each other" and "Digits do not repeat
  inside a shikaku rectangle".
- *Shikaku Fillomino #2 (9x9)*, LMD 000B8V
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000B8V).
- LMD carries a Shikaku tag (https://logic-masters.de/Raetselportal/?chlang=en); the wiki
  carries *Pentomino Shikaku* (https://wiki.logic-masters.de/index.php/Pentomino_Shikaku/en).

## 3.5 Cave — see 1.11

Cave is a region genre in spirit (the cave is one region, the walls are the rest) but the
decision layer is binary shading, so it is treated in the shading section. Its Sudoku
hybrid evidence (Cave Sums Sudoku, Twilight Cave Sudoku, Cave Sudoku +) is among the
strongest in this survey.

## 3.6 Nanro (ナンロー, "Signpost")

**Rules** (https://puzz.link/js/pzpr-samples/nanro.js): "Place a number into some of the
cells. Some numbers are given. 1. Each number must be equal to the amount of cells with
numbers inside the outlined region. 2. Every region must contain at least one number.
3. Two equal numbers from different regions cannot be orthogonally adjacent. 4. Numbers
cannot form a 2x2 square. 5. All numbers form an orthogonally contiguous area." Nikoli
vol. 92. The LMD wiki has a Nanro page but its English instructions section is empty
(https://wiki.logic-masters.de/index.php/Nanro/en), so puzz.link is the source here.

**Structure.** Decision: per cell, empty or numbered — a binary layer — plus the number
itself, which is determined by the region's filled count. Global: numbered cells connected,
no numbered 2x2, no equal numbers adjacent across region borders. Clues: some given numbers.

**Sudoku hybrid suitability under the CP-SAT lens: Good.**

*Variables.* 81 digits, 81 "filled" bools, 288 flow ints for the connectivity of
the filled set, plus one count int per box.

*Expensive globals.* One flow — the filled cells form a single connected area.
No-filled-2x2 is 64 windows. Rule 3 (equal numbers from different regions not
orthogonally adjacent) needs to know which box a cell is in, which is static, so it
is a clause list over the 54 border pairs: if both filled and in different boxes,
their counts differ.

*Size and cost on 9x9.* 81 bools + 288 flow ints + 64 windows + 54 clauses.
**Moderate.**

*Digit coupling.* Native: the number in a filled cell equals the count of filled
cells in its box, so `x[p] == sum(f[q] for q in box(p))` **reified on `f[p]`** —
one linear constraint per cell under an enforcement literal, range 1..9. The
wrinkle a designer must settle is what an *unfilled* cell's digit means; the clean
answer is that unfilled cells are the shading layer and carry an ordinary sudoku
digit with no Nanro role.

*Verdict.* **Good.** Native in-range linear coupling, one flow, and a cheap static
clause list for the separation rule.

**Existing hybrids:** LMD carries a **Nanro tag alongside its Sudoku tag**
(https://logic-masters.de/Raetselportal/?chlang=en). No titled Nanro Sudoku found
(searched: LMD portal, GM Puzzles, general web). [unverified as absence]

## 3.7 Spiral Galaxies (天体ショー "Tentai Show", Galaxies, Tentaisho)

**Rules** (https://puzz.link/js/pzpr-samples/tentaisho.js): "Divide the grid into regions.
1. Every region contains exactly one star. 2. Lines cannot go through stars. 3. Every
region must be rotationally symmetric, with a star at the center." Nikoli vol. 96 (2001),
invented by "Gesaku" / "Robocop" — the name puns on 天体 (astronomical) and 点対称 (point
symmetry) (https://wpcunofficial.miraheze.org/wiki/Spiral_Galaxies,
https://www.gmpuzzles.com/blog/spiral-galaxies-rules-info/). GM Puzzles: "Divide the grid
along the indicated lines into connected regions – 'galaxies' – with rotational symmetry.
Each cell must belong to one galaxy, and each galaxy must have exactly one circle at its
center of rotational symmetry." Note the circle may sit on a cell, an edge or a vertex.

**Structure.** Decision: region partition. Global: 180° rotational symmetry of every region
about its given centre — a strong, purely geometric constraint that pairs cells up. Clues:
the circle positions.

**Sudoku hybrid suitability under the CP-SAT lens: Good — symmetry does the work
a flow would otherwise do.**

*Variables.* 81 digits and one membership bool per (cell, galaxy) pair. Because the
centres are **given**, the galaxy set is known up front — say k centres — so this is
81 x k bools, not a labelling the solver must invent. With k around 10 that is ~810
bools.

*Expensive globals.* Much less than the region family average. The symmetry rule
pairs cells: `member[p, g] == member[reflect(p, g), g]`, one equality per cell per
galaxy, and any cell whose reflection falls off the board simply cannot belong.
That single constraint family removes roughly half the freedom before search
starts. Each cell belongs to exactly one galaxy: 81 linear equalities.
Connectivity still needs a flow per galaxy in principle — but in practice the
symmetry plus the exact-cover condition leaves few disconnected candidates, so the
repo's lazy-cut discipline fits well: solve, find a disconnected galaxy, forbid that
membership pattern, re-solve.

*Size and cost on 9x9.* ~810 membership bools, ~400 symmetry equalities, 81 cover
equalities, plus a short cut loop. **Moderate.**

*Digit coupling.* Not native — the clue is a position, not a number — but the
published hybrids show the good moves and all are linear: "symmetric cells within a
galaxy have different parity" is one reified clause per symmetric pair; "a galaxy
behaves as a killer cage" is a linear sum over membership bools; "the digits along
each tail are equal in sum" is a linear sum per tail.

*Verdict.* **Good.** Given centres turn a region-labelling problem into an
exact-cover problem with a strong pairing constraint. Real hybrid evidence and a
WPC record to calibrate against.

**Existing hybrids:** well attested, including at world-championship level.
- *Spiral Galaxy Sudoku with clues*, LMD 000897
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000897):
  "Standard Sudoku and Spiral Galaxy rules apply... One of the digits from 1-9 acts as the
  centre for each galaxy... The sum of the digits in each and any tail around a galaxy must
  be equal... If any 5 or more cells along a row belong to the same galaxy, the digits in
  those cells must read across in ascending order." The post records a whole community
  effort around hamslice's earlier *Spiral Galaxy Sudoku with one clue*.
- *Space Oddity - Irregular Parity Galaxy Killer Sudoku*, LMD 00045K
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=00045K): galaxies
  behave as killer cages; "Two symmetrical cells within a galaxy must have different
  parities, and cells with the same parity within a galaxy must form a single group of
  orthogonally adjacent cells."
- *Galaxies and Pentominoes* and *Galaxies and Tetrominoes*, WPC 2018 Round 6 by Jiří
  Hrdina, plus *Spiral Galaxies^2* by Rohan Rao at WPC 2017 Round 20 — the WPC unofficial
  wiki lists Spiral Galaxies appearances across WPC 2013 through 2024
  (https://wpcunofficial.miraheze.org/wiki/Spiral_Galaxies).
- LMD carries a Galaxies tag (https://logic-masters.de/Raetselportal/?chlang=en); GM
  Puzzles has 31 Spiral Galaxies posts
  (https://www.gmpuzzles.com/blog/category/regiondivision/spiral-galaxies/).

## 3.8 Pentominous

**Rules** (https://puzz.link/js/pzpr-samples/pentominous.js): "Divide the grid into
pentominoes (regions of 5 cells). You can use each pentomino any number of times (including
zero). 1. Two adjacent pentominoes cannot have the same shape, counting rotations and
reflections as the same. 2. A letter indicates the shape of the pentomino it's contained in.
A pentomino may contain any number of identical letters." A setter's phrasing adds that an
inventory may be shown but not all shapes need be used
(https://swaroopg92.blogspot.com/2021/06/puzzle-no-161-pentominous.html).

**Structure.** Decision: region partition, every region exactly 5 cells with a named shape.
Global: adjacent regions differ in shape. Clues: shape letters.

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* Placement bools: every position of every pentomino on a 9x9, a few
thousand, filtered by the letter clues.

*Expensive globals.* Exact cover is cheap (81 linear equalities). Rule 1 — adjacent
pentominoes differ in shape — is a pairwise clause list over placements sharing an
edge, enumerated once in Python; large but static.

*Size and cost on 9x9.* A few thousand placement bools with a big static clause
list. **Moderate to heavy**, mostly from the clause list's size.

*Digit coupling.* Two problems. 81 is not divisible by 5, so a pure tiling is
infeasible and the model must allow uncovered cells — which the published hybrid
does by placing exactly the twelve pentominoes and leaving the rest bare. And the
clue is a shape letter, not a number, so coupling is invented; the published hybrid
supplies German-whispers and region-sum rules, both linear over placement bools.

*Verdict.* **Workable.** The arithmetic mismatch is a genuine design tax, not a
modelling one, and every hybrid pays it.

**Existing hybrids:**
- *Pentomino Sudoku*, LMD 000A76
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000A76): "Place
  exactly one of each of the 12 pentomino shapes in the grid... A clue outside the grid
  indicates the sum of numbers not in pentominos in the row or column. Each pentomino must
  satisfy at least one of the two conditions: 1. Adjacent numbers in the pentomino must
  differ by at least 5. 2. The sum of the numbers in the pentomino is the same in each box
  of the sudoku that the pentomino is in." Tagged "Sudoku, Pentominous, German Whispers
  (Variant), Region Sum Lines (Variant)".
- *Galaxies and Pentominoes*, WPC 2018 Round 6 by Jiří Hrdina
  (https://wpcunofficial.miraheze.org/wiki/Spiral_Galaxies).
- LMD carries Pentominous and Pentopia tags
  (https://logic-masters.de/Raetselportal/?chlang=en); GM Puzzles has 109 Pentominous posts
  (https://www.gmpuzzles.com/blog/category/regiondivision/pentominous/); the wiki carries a
  dozen pentomino genres including *Pentomino Shikaku*, *Pentomino Fences* and *Pentomino
  Borders* (https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en).

## 3.9 Tetrominous, Fourcells, Fivecells, Heteromino

**Rules** — Tetrominous (https://puzz.link/js/pzpr-samples/tetrominous.js): as Pentominous
with tetrominoes. Fourcells (https://puzz.link/js/pzpr-samples/fourcells.js): "Divide the
board into tetrominoes. 1. A number indicates the amount of edges surrounding the cell which
contain a border. 2. All borders must be used to divide two blocks, there can not be any
dead-ends." Nikoli vol. 132. Fivecells (`fivecells`) is the same with pentominoes, Nikoli
vol. 133. Heteromino (https://puzz.link/js/pzpr-samples/heteromino.js): "Divide the board
into triminoes. 1. Triminoes cannot use shaded cells. 2. Two triminoes that share a border
must have different shape or different orientation." Invented by Inaba Naoki.

**Sudoku hybrid suitability under the CP-SAT lens: Workable for Fourcells and
Fivecells, Poor for the rest.**

*Variables.* Placement bools as Pentominous.

*Expensive globals.* Exact cover plus a static adjacency clause list. Heteromino
is the one that tiles 81 evenly (3 cells x 27), so it alone avoids the divisibility
problem — but its rule ("adjacent triminoes differ in shape *or* orientation") is a
weak constraint that leaves an enormous solution space, which is bad for uniqueness
proofs.

*Size and cost on 9x9.* **Moderate.**

*Digit coupling.* Fourcells and Fivecells carry the genuinely good clue: "how many
of this cell's four sides are region borders", 0..4, which under a placement
encoding is a linear sum of reified "my neighbour is in a different placement"
bools — one constraint per clue, in digit range, native. That is the same clue as
Nawabari (3.14) and it is the reason to prefer these over the letter-clued tilings.

*Verdict.* **Workable** for the border-count pair; **Poor** for Tetrominous and
Heteromino, on divisibility and weak determination respectively.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.10 Statue Park

**Rules** (https://puzz.link/js/pzpr-samples/statuepark.js): "Place every shape from the
bank into the grid. Shapes can be rotated or mirrored. 1. All shapes must be used exactly
once. There cannot be shapes in the grid that aren't present in the bank. 2. Two shapes
cannot be orthogonally adjacent. 3. Black circles must overlap a shape, while white circles
must not overlap a shape. 4. All cells not used by shapes must be connected." Invented by
Palmer Mebane. A setter's phrasing confirms the same four rules
(https://swaroopg92.blogspot.com/2021/08/puzzle-number-170-double-statue-park.html).

**Structure.** Decision: placement of a fixed bank of polyominoes. Global: exact use of the
bank, orthogonal separation, connected complement. Clues: black and white circles.

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* Placement bools for the fixed bank of shapes, plus 81 occupancy
bools.

*Expensive globals.* The bank is `AddExactlyOne` per shape — cheap and strong.
Orthogonal separation between shapes is a static clause list over placement pairs.
The cost is rule 4: **the complement must be connected**, which is a flow over the
unoccupied cells — 288 arc ints gated on `not occupied`, the standard device.

*Size and cost on 9x9.* ~1000 placement bools + 81 occupancy + 288 flow ints.
**Moderate to heavy.**

*Digit coupling.* Not native — circles are binary. The documented hybrid borrows
Minesweeper's clue instead ("a number in a white circle counts the black circles
around it"), which is a linear sum of bools and the friendliest coupling available.
That substitution is the move a sudoku hybrid should copy.

*Verdict.* **Workable.** Good placement model, one complement flow, borrowed
coupling.

**Existing hybrids:** *Double Statue Park Twilight* by swaroop guggilam
(https://swaroopg92.blogspot.com/2021/08/puzzle-number-170-double-statue-park.html), a
Statue Park with Minesweeper clues, set in a Cracking The Cryptic Discord speed-setting
contest. GM Puzzles has 87 Statue Park posts
(https://www.gmpuzzles.com/blog/category/objectplacement/statue-park/). No titled Statue
Park x Sudoku found. [unverified as absence]

## 3.11 Tren

**Rules** (https://puzz.link/js/pzpr-samples/tren.js): "Place several 1x2 and 1x3 blocks on
the board, which don't overlap each other. 1. Each number is contained in a block. Blocks
must contain exactly one number. 2. Horizontally oriented blocks can slide left and right,
while vertically oriented blocks can slide up and down. Blocks cannot move outside the grid
or through other blocks. 3. A number inside a block indicates how many spaces the block can
move." The LMD wiki has a Tren page but no English instructions
(https://wiki.logic-masters.de/index.php/Tren/en), and registers a variant *Tren (knapp
daneben)*.

**Structure.** Decision: placements of 1x2 and 1x3 blocks. Global: non-overlap. Clues: a
sliding-freedom number — a distance, not a size.

**Sudoku hybrid suitability under the CP-SAT lens: Workable, with one derived
quantity that costs.**

*Variables.* Placement bools for every 1x2 and 1x3 block position — a few hundred
— plus 81 occupancy bools.

*Expensive globals.* Non-overlap is a linear cover inequality per cell; no
connectivity, no flow, no shape lemma. Cheap so far. The cost is the clue, which is
a **derived** quantity: "how many spaces this block can slide" depends on the
nearest blocking block in its direction, so it is a prefix scan over the occupancy
bools from the block's end — ~8 reified steps per block per direction, and the
answer is a min over the two directions or a per-direction count depending on the
reading.

*Size and cost on 9x9.* A few hundred placement bools plus prefix chains per
clued block. **Moderate.**

*Digit coupling.* The sliding distance is 0..8, in digit range, and "how far could
this block move" is a quantity no other genre here uses — genuinely novel. But it
is a derived scan, not a plain sum, so each clue costs more than a Minesweeper or
box-count clue.

*Verdict.* **Workable.** Small pieces, cheap cover, interesting in-range clue, one
moderately expensive derived quantity. Obscure enough that there is no hybrid
tradition to borrow from.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.12 Sashigane (さしがね, "carpenter's square")

**Rules** (https://puzz.link/js/pzpr-samples/sashigane.js): "Divide the grid into regions of
orthogonally connected cells. 1. Each region must be an L shape with a width of one cell.
2. A circle must be located in the corner of an L shape. 3. Arrows must be located on the
ends of an L shape, and point towards the corner. 4. A number indicates the amount of cells
contained in the L shape." Nikoli vol. 134. The LMD wiki gives the same four numbered rules
(https://wiki.logic-masters.de/index.php/Sashigane/en).

**Structure.** Decision: region partition into 1-wide L shapes. Global: exact tiling. Clues:
corner circles, endpoint arrows, and region sizes.

**Sudoku hybrid suitability under the CP-SAT lens: Good — placement bools again.**

*Variables.* One bool per candidate L-shape: an elbow cell, an arm length each way,
both arms 1-wide. Enumerating all L placements on a 9x9 gives a few thousand, and
the circle and arrow clues cut that hard before the solve.

*Expensive globals.* **None.** Exact cover over cells is 81 linear equalities; each
circle is the elbow of exactly one chosen L; each arrow is an arm tip pointing at
its elbow, which filters the candidate list in Python rather than constraining the
model. No connectivity — an L is connected by construction — no flow, no lemma.

*Size and cost on 9x9.* A few thousand placement bools, 81 cover equalities.
**Cheap to moderate**, and the three clue types prune the enumeration before CP-SAT
sees it.

*Digit coupling.* Native and in range: the number in a circle is the L's cell
count, 1..9, tied directly to the placement bool. Three clue types on one layer
gives a setter far more tuning room than a single size clue, and all three are
static filters rather than constraints.

*Verdict.* **Good.** Exact cover with no connectivity machinery and a native
in-range clue — structurally the same win as Shikaku, on a richer shape family.
Unclaimed as a published hybrid.

**Existing hybrids:** LMD carries a **Sashigane tag alongside its Sudoku tag**
(https://logic-masters.de/Raetselportal/?chlang=en). No titled Sashigane Sudoku found
(searched: LMD portal, GM Puzzles, general web). [unverified as absence]

## 3.13 Snake Pit (`snakepit`)

**Rules** (https://puzz.link/js/pzpr-samples/snakepit.js): "Divide the grid into regions,
where each region represents a snake. 1. A snake is a path that is at least 2 cells long and
exactly 1 cell wide, and can have any amount of turns. 2. A snake cannot loop back on itself
and visit a cell that's orthogonally or diagonally adjacent to a cell it has visited before.
3. Two snakes of the same length cannot be orthogonally adjacent. 4. A number indicates the
length of the snake, in cells. Snakes can have any amount of identical numbers. 5. A circle
indicates an endpoint of a snake, while a gray cell must not be on the endpoints of a snake."

**Structure.** Decision: region partition into self-avoiding 1-wide paths. Global: rule 3 is
Fillomino's adjacency rule on lengths. Clues: lengths and endpoint markers.

**Sudoku hybrid suitability under the CP-SAT lens: Good, but the snake shape costs
more than a rectangle.**

*Variables.* 81 digits, 81 `rid` ints, 81 roots, 288 flow ints — the Fillomino
set, since regions have sizes and "equal lengths may not be adjacent" is Fillomino's
separation rule.

*Expensive globals.* The Fillomino collapse applies in part: rule 3 makes
equal-length snakes non-adjacent, so a component of equal digits is a single
region and the `eq`-edge trick transfers. What does **not** transfer is the shape
rule: each region must be a 1-wide self-avoiding path with no diagonal
self-contact. The 1-wide part has the same local characterisation as Nuribou's bars
(no 2x2 window with three or more cells of one region), and the no-diagonal-contact
part is a clause list over diagonal pairs in the same region. Together they are
exact and local — no path enumeration needed.

*Size and cost on 9x9.* Fillomino's model plus 64 windows plus ~128 diagonal
clauses. **Moderate to heavy.**

*Digit coupling.* Fillomino's, unchanged: the digit is the snake's length, native
and in range. Plus the snake gives an ordering along each region, available via
position variables if wanted, at the usual cost.

*Verdict.* **Good.** Fillomino's coupling and collapse, a local shape rule, and an
ordering bonus — a strong and entirely unclaimed target.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web). LMD
carries Snake and Snake (Variant) tags but those are the shading genre
(https://logic-masters.de/Raetselportal/?chlang=en). [unverified as absence]

## 3.14 Nawabari (なわばり, "Territory")

**Rules** (https://puzz.link/js/pzpr-samples/nawabari.js): "Draw lines over the dotted lines
to divide the board into rectangles. 1. Each rectangle contains exactly one number. 2. A
number indicates the amount of edges surrounding the cell which contain a border." Nikoli
vol. 51.

**Structure.** Decision: rectangle partition (as Shikaku). Clues: a per-cell border count
0..4 — a *local* clue about the partition, not a size.

**Sudoku hybrid suitability under the CP-SAT lens: Good — Shikaku's model with a
local clue.**

*Variables.* Rectangle placement bools as Shikaku (3.4), plus per-edge "is a
border" bools derived from the placements.

*Expensive globals.* **None.** Exact cover over rectangles, and the clue is the
cheapest region clue in the survey: "how many of this cell's four sides are region
borders" is a linear sum of four border bools, each of which is reified from
"my neighbour is in a different placement". Strictly local, one constraint per clue.

*Size and cost on 9x9.* A few hundred placement bools, 81 cover equalities, 144
border bools. **Cheap.**

*Digit coupling.* Native, linear, in range 0..4. And it complements Shikaku
usefully: Shikaku's clue is global to a region (its area), Nawabari's is local to a
cell, so the two tune differently and one model with a flag serves both — the same
rectangle enumeration, a different clue family.

*Verdict.* **Good.** Cheapest region model with a native clue, and it shares its
enumeration with Shikaku.

**Existing hybrids:** the LMD portal carries a *Landvermessung* ("land survey") tag
(https://logic-masters.de/Raetselportal/?chlang=en), which is the German-tradition
territory-division genre. No titled Nawabari x Sudoku found. [unverified as absence]

## 3.15 Tatamibari (たたみばり)

**Rules** (https://puzz.link/js/pzpr-samples/tatamibari.js): "Draw lines over the dotted
lines to divide the board into regions. 1. Each region contains exactly one clue. 2. A
vertical line indicates that the region is a rectangle where the height is larger than the
width. 3. A horizontal line indicates that the region is a rectangle where the width is
larger than the height. 4. A plus sign indicates that the region is a square. 5. Region
borders must not form 4-way intersections." Nikoli vol. 107.

**Structure.** Rectangle partition with shape-class clues (tall, wide, square) and the
tatami rule 5 forbidding four-way border crossings.

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* Rectangle placement bools as Shikaku, filtered per clue by shape
class (taller than wide, wider than tall, square).

*Expensive globals.* Exact cover, plus rule 5, the tatami rule: region borders may
not form a four-way intersection. That is a check on each interior vertex — of the
four edges meeting there, not all four are borders — so 64 linear constraints over
the border bools Nawabari already defines. Purely local, cheap, and unusual enough
to be worth having in the toolkit.

*Size and cost on 9x9.* A few hundred placement bools + 64 vertex constraints.
**Cheap to moderate.**

*Digit coupling.* Not native: the clue is a shape class, not a number. The natural
fix is the ambiguous-clue idiom the published Nurikabe hybrids use — let the digit's
parity or magnitude choose the clue type, one reified clause per clue. That works
and is cheap, but it is an invented rule.

*Verdict.* **Workable.** Cheap model, nice local vertex rule, invented coupling.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.16 Ripple Effect (波及効果 "Hakyuu")

**Rules** (https://puzz.link/js/pzpr-samples/ripple.js): "Place a number in each cell. Some
numbers are given. 1. Numbers must be between 1 and N, where N is the size of the region.
2. Each region contains exactly one of each number. 3. Two equal numbers N in the same row
or column must have at least N spaces between them." Nikoli vol. 73. LMD wiki: "Fill in each
cell with a digit so that each region with the area n contains digits from 1 to n. Same
digits in a row or column should have a distance between them, as many times as at least
themselves. For example, if there are two 4's in the same row/column, there should be at
least four cells between those"
(https://wiki.logic-masters.de/index.php/Ripple_Effect/en).

**Structure.** This is a *number-placement* genre with a given region partition, not a
region-building one. Decision: a digit per cell. Clues: givens.

**Sudoku hybrid suitability under the CP-SAT lens: Good — there is barely a model
to write.**

*Variables.* 81 digits. No second layer at all: the region partition is **given**,
so there is nothing to decide but numbers.

*Expensive globals.* **None.** Rule 2 is AllDifferent per region, which with the
nine boxes is the sudoku box rule already. Rule 3 is a pairwise constraint: for
each pair of cells in the same row or column at distance d, forbid both holding a
value v > d — which is a clause per (pair, value), or more compactly a reified
`x[p] == x[q] => distance >= x[p]`. On a 9x9 that is a few thousand small clauses,
all static.

*Size and cost on 9x9.* 81 ints and a static clause list. **Cheap.**

*Digit coupling.* There is no coupling to build — like Fillomino, the genre's
numbers are the sudoku's digits. The caveat is puzzle-side rather than
solver-side: on a proper sudoku no digit repeats in a row at all, so rule 3 is
vacuous within a row and only bites across the whole grid or under irregular
regions. Fix it by applying the distance rule globally or by using non-box regions.

*Verdict.* **Good** as a constraint to add cheaply; weak as a standalone hybrid
unless the region partition departs from the boxes.

**Existing hybrids:** LMD carries **Hakyuu and Suguru tags alongside its Sudoku tag**
(https://logic-masters.de/Raetselportal/?chlang=en) — Suguru is the closely related
region-with-1..N genre.

## 3.17 Suraromu (スラローム)

**Rules** (https://wiki.logic-masters.de/index.php/Suraromu/en; puzz.link carries no
`suraromu` rules text): "1. Draw a single loop, starting and ending at the numbered circle...
The loop may not cross itself or branch off. 2. The dotted lines are called gates. The loop
must pass straight through every gate exactly once, by traversing exactly one cell in each
gate. (The number in the circle represents the total number of gates.) 3. A numbered black
cell represents the order in which the loop passes through the gate which touches that black
cell... A gate numbered 1 must be the first gate visited in the loop... and so forth."
Nikoli genre.

**Structure.** A loop genre, not a region one — the "regions" are gates (line segments).
Clues: gate visit ordinals.

**Sudoku hybrid suitability under the CP-SAT lens: Workable.**

*Variables.* A loop layer (arc literals, self-loops) plus position ints, because
the clue is a visit ordinal over gates.

*Expensive globals.* One loop, plus the gate structure: each gate crossed exactly
once and straight through, which is a linear constraint per gate over the loop
edges in it. The ordinal clue then needs the position-variable device from Simple
Loop (2.5) restricted to gates — cheaper than Haisu's per-cell ordering, since only
the gates need an index.

*Size and cost on 9x9.* ~370 arc literals + one int per gate + the position chain.
**Moderate to heavy.**

*Digit coupling.* The ordinal is in digit range, as with Haisu, but gates are line
segments between cells and a sudoku grid has no natural gate geometry — every cell
already means something. The coupling is therefore bolted on rather than native.

*Verdict.* **Workable.** Haisu (2.25) gets the same ordering hook with a geometry
that fits the grid. Prefer Haisu.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.18 Bosnian Road

**Rules** (https://wiki.logic-masters.de/index.php/Bosnian_Road/en): "Draw a loop in the
grid by travelling horizontally and vertically without touching itself. The numbers in the
grid indicate the number of cells occupied by the loop in the 8 neighbouring cells."

**Structure.** A loop on cells (not edges) that may not touch itself, with an
8-neighbourhood count clue — i.e. a Minesweeper clue over a loop.

**Sudoku hybrid suitability under the CP-SAT lens: Good — the same model as
Linesweeper.**

*Variables.* 81 on-loop bools plus arc literals with self-loops.

*Expensive globals.* One loop, plus the non-self-touching rule: no two on-loop
cells are diagonally adjacent unless consecutive on the loop, and no two are
orthogonally adjacent unless joined by a chosen arc. Both are clause lists over the
arc literals, ~250 clauses, static.

*Size and cost on 9x9.* ~370 arc literals, one linear constraint per clue, ~250
clauses. **Moderate**, at the cheap end of the loop family.

*Digit coupling.* Native, linear, in range: `x[p] == sum(on_loop[q] for q in
neighbours8(p))`, 0..8 — the Minesweeper shape again.

*Verdict.* **Good**, and it shares its model with Linesweeper (2.27): the two
differ only in whether the loop may touch itself, so one build with a rule flag
covers both.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.19 Nondango (ノンダンゴ)

**Rules** (https://puzz.link/js/pzpr-samples/nondango.js): "You're given a grid with circles
in some of the cells. Change some of the circles from white to black. 1. Each outlined
region must contain exactly one black circle. 2. There cannot be a horizontal, vertical or
diagonal run of 3 adjacent circles of the same color." Nikoli vol. 152.

**Structure.** Decision: binary recolouring of a given circle set. Global: one black per
region; no three-in-a-line of one colour among *adjacent* circles. Clues: the circle layout.

**Sudoku hybrid suitability under the CP-SAT lens: Workable, and very cheap.**

*Variables.* 81 digits plus one bool per **given circle** — typically 20-30, not
81, because the circle set is given and only their colour is decided.

*Expensive globals.* **None.** One black per box is 9 linear equalities. The
no-three-in-a-line rule is a clause per collinear triple of *adjacent* circles,
enumerated in Python across rows, columns and both diagonals — a static list of a
few dozen clauses. No connectivity, no flow, no shape rule.

*Size and cost on 9x9.* ~30 bools and a few dozen constraints. **Cheap** — the
smallest decision layer in the region family.

*Digit coupling.* Not native. The diagonal reach of the no-three rule is the
interesting part, since the sudoku does not otherwise use diagonals, but a digit
hook must be invented.

*Verdict.* **Workable.** Almost free to model, moderate payoff — a good warm-up
model rather than a destination.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.20 Toichika (とういちか) and Toichika 2

**Rules** — Toichika (https://puzz.link/js/pzpr-samples/toichika.js): "Place an arrow in one
cell of each country. Some arrows are given. 1. Two arrows which point toward each other
form a pair. All arrows must be paired. 2. Paired arrows must not be in adjacent countries.
3. All cells between a pair of arrows must be empty." Nikoli vol. 129. Toichika 2
(https://puzz.link/js/pzpr-samples/toichika2.js) replaces arrows with numbers: "4. A pair of
numbers N must have exactly N cells between them", plus a pairing rule in row or column.

**Sudoku hybrid suitability under the CP-SAT lens: Toichika Poor, Toichika 2 Good.**

*Variables.* One placement per box: which cell carries the arrow or number, plus
its direction (Toichika) or value (Toichika 2). That is 9 cell choices, a tiny
layer.

*Expensive globals.* Toichika's pairing — all arrows form mutually pointing pairs
with nothing between them — is a matching over 9 objects with emptiness conditions
along each ray: a clause list, cheap. Toichika 2 replaces it with a distance
condition.

*Size and cost on 9x9.* Tiny either way. **Cheap.**

*Digit coupling.* Toichika 2 carries what is, under this lens, one of the most
appealing couplings in the document: **"a pair of numbers N has exactly N cells
between them"** — a digit determining a geometric distance. Encode as: for the two
cells holding the pair, `|col_q - col_p| == x[p] + 1` (or the row form), one linear
constraint reified on the pairing bool. A digit that fixes a distance is a strong,
long-range constraint that sudoku solvers and CP-SAT both exploit well, and it costs
one linear equality. Toichika's arrows are directions with no quantity and offer
nothing.

*Verdict.* **Toichika 2 Good**, on a tiny model with an unusually strong native
coupling; **Toichika Poor**.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.21 Doppelblock

**Rules** (https://puzz.link/js/pzpr-samples/doppelblock.js): "Place a number in some cells,
and shade the other cells. 1. Every row and column has exactly 2 shaded cells. 2. Numbers
must be between 1 and N-2, where N is the width of the board. 3. Each row and column
contains exactly one of each number. 4. A clue outside the grid indicates the sum of the
numbers which appear between the two shaded cells in the corresponding row or column."
Invented by Inaba Naoki. The LMD wiki carries a *Doppelblock-Sudoku* page
(https://wiki.logic-masters.de/index.php/Doppelblock-Sudoku).

**Structure.** A number-placement genre with a two-shaded-per-line rule. Decision: digits
plus a binary shading. Clues: outside sums.

**Sudoku hybrid suitability under the CP-SAT lens: Good, and it is already a
sudoku model.**

*Variables.* 81 ints in 0..7 where 0 means "blank", or 81 digits plus 81 blank
bools — the former collapses the two layers into one variable, the same move that
makes Star Battle tiny.

*Expensive globals.* **None.** Exactly two blanks per row and column is 18 linear
equalities. Rules 2 and 3 are AllDifferent over the non-blank values per line. The
outside clue — the sum of the numbers strictly between the two blanks — is the one
derived quantity, and it needs a sandwich-style encoding: a prefix "after the first
blank" bool and a "before the second blank" bool per cell, then a linear sum of the
products. Variant sudoku has done sandwich sums for years and the encoding is
standard.

*Size and cost on 9x9.* 81 ints, 18 linear equalities, ~18 sandwich chains.
**Cheap to moderate.**

*Digit coupling.* There is nothing to couple — the genre's numbers are the grid's
numbers, as with Fillomino and Ripple Effect. That is the limiting case.

*Verdict.* **Good.** A named hybrid already exists on the LMD wiki, the model is
essentially a sudoku with two blanks per line, and sandwich sums are well-trodden.

**Existing hybrids:** **Doppelblock-Sudoku is a registered genre on the LMD wiki**
(https://wiki.logic-masters.de/index.php/Doppelblock-Sudoku), alongside
*Doppelblock-Hochhäuser* (Doppelblock x Skyscrapers)
(https://wiki.logic-masters.de/index.php/Doppelblock-Hochh%C3%A4user). That is direct,
primary-source evidence of the hybrid existing as a named type.

## 3.22 Every other region and area-number genre on the puzz.link index

Complete: every genre in the puzz.link region sections (Divide into Areas, Divide
into Areas without number, Tatami Puzzles, Areas and Numbers) with no full entry above.
Devices as in 1.34. The Areas-and-Numbers rows repay reading first: several are already
standard variant-sudoku constraints under another name.

| Genre | Rule core (puzz.link) | Devices a model would need |
| --- | --- | --- |
| Aho-ni-Narikire (`aho`) | Draw lines over the dotted lines to divide the board into several blocks. 1. Each block contains exactly one black circle. 2. A number indicates the size of the block,... | rectangle lemma, region ids or placements, count clue |
| Border Block (`bdblock`) | Draw lines over the dotted lines to divide the board into several blocks. 1. All identical numbers must be in the same block, and different numbers must be in differen... | region ids or placements, position vars — **Workable.** The "all branch points given" completeness rule is a strong negative constraint. |
| Cojun (`cojun`) | Place a number in each cell. Some numbers are given. 1. Numbers must be between 1 and N, where N is the size of the region. 2. Each region contains exactly one of each... | placement bools — **Good / cheap.** Region 1..N with a vertical ordering rule. |
| Combi Block (`cbblock`) | Draw lines over the dotted lines to divide the board into blocks. 1. Each block must contain exactly two outlined regions. 2. Two adjacent blocks cannot have the same... | rectangle lemma, region ids or placements |
| Compass (`compass`) | Draw lines over the dotted lines to divide the board into several blocks. 1. Each block contains exactly one cell with a compass. 2. A number in a compass indicates ho... | region ids or placements, count clue — **Good / moderate.** Four directional counts in one clue cell, all digit-range. LMD carries Compass tags. |
| Double Choco (`dbchoco`) | Divide the grid into regions of any size. 1. Each region contains one white and one grey contiguous area. Both areas must be the same size and shape. They can be rotat... | flow to a root, region ids or placements, count clue — **Good / moderate.** Congruence between a region's two halves is a strong, unusual rule; size in range. |
| Family Photo (`familyphoto`) | Divide the grid into rectangular regions of orthogonally connected cells. 1. Each region must contain exactly one number, which indicates how many circles are in the r... | region ids or placements, count clue |
| Fillmat (`fillmat`) | Draw lines over the dotted lines to divide the board into several regions. 1. All regions must be a rectangle or square with a width of 1, and a length between 1 and 4... | rectangle lemma, region ids or placements, count clue, position vars — **Workable.** Nuribou as a partition; the 1-wide bar lemma applies. |
| Fractional Division (`fracdiv`) | Draw lines over the dotted lines to divide the board into several blocks. 1. Each block contains exactly one cell with a number. 2. A number indicates the ratio of cir... | region ids or placements, count clue |
| Goats and Wolves (`shwolf`) | Draw lines over the dotted lines to divide the board into cages. 1. Each cage contains at least one animal. 2. A cage cannot contain both goats and wolves. 3. Lines ca... | AddCircuit, region ids or placements |
| Hanare-gumi (`hanare`) | Place one number in a cell of each region on the board. 1. The number in the region should be equal to the size of the region. 2. If two numbers share a row or column,... | placement bools — **Good / cheap.** One number per region equal to its size, with a digit-determined separation rule. |
| KaitoRamma (`kramma`) | Draw lines over the dotted lines to divide the board into blocks. 1. Each block contains at least one circle. 2. A block cannot contain both white and black circles. 3... | region ids or placements |
| Kazunori Room (`kazunori`) | Place a number into every cell. 1. Each region contains every number between 1 to N exactly twice, where N is half the number of cells in the region. 2. Two numbers of... | no-2x2 windows, placement bools — **Good / cheap.** Each value twice per region, adjacent, with touching-cell sum clues. |
| L-route (`loute`) | Divide the grid into regions of orthogonally connected cells. 1. Each region must be an L shape with a width of one cell. 2. A circle must be located in the corner of... | region ids or placements |
| La Paz (`lapaz`) | Shade some cells on the board, and divide the rest into regions of 2 cells. 1. No two shaded cells are horizontally or vertically adjacent. 2. Numbers must be containe... | region ids or placements, count clue — **Workable.** Row/column counts over a domino layer — cheap and digit-range. By Shye. |
| Lohkous (`lohkous`) | Draw lines over the dotted lines to divide the board into several blocks. 1. Each block must contain exactly one square with one or more numbers on it. 2. All lines mu... | rectangle lemma, region ids or placements — **Workable.** A multiset of run lengths per block: rich but fiddly. By Hempuli. |
| Makaro (`makaro`) | Place a number in each empty cell. Some numbers are given. 1. Numbers must be between 1 and N, where N is the size of the region. 2. Each region contains exactly one o... | placement bools — **Good / cheap.** Arrows point at the largest neighbour; region 1..N. |
| Meandering Numbers (`meander`) | Place a number in each cell to make a path in each region. Some numbers are given. 1. Numbers must be between 1 and N, where N is the size of the region. 2. Each regio... | placement bools — **Good / cheap.** Consecutive numbers must be orthogonally adjacent — already a variant-sudoku idiom. |
| Mirror Block (`mirrorbk`) | Draw lines over the dotted lines to divide the board into regions. 1. A number indicates the size of the region that contains it. 2. Regions can have no more than 1 nu... | region ids or placements, count clue |
| New KaitoRamma (`kramman`) | Draw lines over the dotted lines to divide the board into blocks. 1. Each block contains at least one circle. 2. A block cannot contain both white and black circles. 3... | region ids or placements |
| NIKOJI (`nikoji`) | Divide the grid into regions, with each region containing one letter. 1. Regions with the same letter must be identical in shape and orientation, and must have the let... | region ids or placements — **Workable.** Congruence again, but letter-clued rather than numeric. |
| Putteria (`putteria`) | Place one number in a cell of each region on the board. 1. The number in the region should be equal to the size of the region. 2. Numbers cannot be orthogonally adjace... | placement bools — **Good / cheap.** One number per region equal to its size, non-adjacent, not repeated in a line. |
| Renban-Madoguchi (`renban`) | Place a positive number into every cell. 1. The numbers in each region must all form a consecutive sequence, in any order. 2. The difference between two numbers separa... | placement bools, sight chain, position vars — **Good / cheap.** "Numbers in each region form a consecutive sequence" is literally the Renban line of variant sudoku. |
| Rooms of Factors (`factors`) | Place a number in each cell. 1. Numbers must be between 1 and N, where N is the width of the board. 2. Each row and column contains exactly one of each number. 3. Clue... | placement bools |
| Sashikazune (`sashikazune`) | Divide the grid into regions of orthogonally connected cells. 1. Each region must be an L shape with a width of one cell. 2. A number indicates the distance between it... | region ids or placements, count clue |
| Slash Pack (`slashpack`) | Draw diagonal lines through the center of some cells to divide the board into regions. 1. Two lines cannot overlap within a cell. All lines must be drawn from one corn... | region ids or placements — **Good in principle.** A latin-square-per-region rule, but on an awkward diagonal partition. |
| Square Jam (`squarejam`) | Draw lines over the dotted lines to divide the grid into square-shaped regions. 1. A number indicates the side length of the square it's contained in. Squares may have... | rectangle lemma, region ids or placements, count clue, position vars — **Good / cheap.** Side length 1..9, native, and squares are a tiny placement family. By Eric Fox. |
| Sudoku (`sudoku`) | Place a number in each cell. Some numbers are given. 1. Numbers must be between 1 and N, where N is the width of the board. 2. Each row, column and outlined block cont... | placement bools |
| Sukoro-room (`sukororoom`) | Place a number between 1 and 4 into some of the cells. Some numbers are given. 1. Each number is equal to the amount of (up to 4) orthogonally adjacent cells that also... | flow to a root, placement bools, count clue — **Good / cheap.** A neighbour-count number, Minesweeper-shaped. |
| Tachiawase Block (`tachibk`) | Draw lines over the dotted lines to divide the two grids into several blocks. 1. A number indicates the size of the block in cells. A block can contain one or more num... | region ids or placements, count clue |
| Taj Mahal (`tajmahal`) | Draw a square around each given circle. 1. All squares must have a circle in the center. The square's corners must be located on the grid points. 2. Two squares may no... | rectangle lemma, count clue |
| Tonttiraja (`tontti`) | Draw horizontal and vertical lines from the points to divide the grid into regions. You can connect two points, or draw from a point to the outer border. 1. Cells can... | region ids or placements, count clue, sight chain, position vars |
| Tri-place (`triplace`) | Draw lines along the dotted lines to divide the grid into triminoes (blocks of 3 cells). 1. Clue cells are not part of any block. 2. A clue on the bottom of a cell ind... | region ids or placements, count clue |
| Uso-tatami (`usotatami`) | Draw lines over the dotted lines to divide the board into several regions. 1. All regions must be a rectangle or square with a width of 1. 2. A region must have exactl... | rectangle lemma, region ids or placements, position vars — **Workable.** A negative size clue — the number differs from the region size — which prunes unusually. |
| Voxas (`voxas`) | Draw lines over the dotted lines to divide the board into several areas. Some lines are given. 1. All areas must be rectangular in shape, and must be 2 or 3 cells in s... | rectangle lemma, region ids or placements |
| Wafusuma (`wafusuma`) | Divide the grid into regions. 1. A circle must divide two different regions. 2. A number on a circle indicates the sum of the sizes of the two adjacent regions. 3. Two... | region ids or placements |
| Yajitatami (`yajitatami`) | Draw lines over the dotted lines to divide the board into several regions. 1. All regions must be a rectangle or square with a width of 1 and a length of at least 2. 2... | rectangle lemma, region ids or placements, count clue, position vars — **Workable to Good.** Each clue carries two facts, both digit-range. |

---

# 4. Sources read (continued)

Appended as the run progressed, after the initial block near the top.

- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=0003CM (LITS classic, rules)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000HEI (LITSomino)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000IKY (LITS Battle)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=0004X6 (Yin-Yang Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=0009P1 (Yin Yang Kropki Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000QNK (Yin Yang Sum Frame Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000HLV (Yin Yang Sudoku Deconstruction)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000GBW (Santa Pesto Pt. 2, nurimisaki-derived)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=0002G5 (Star Battle Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000J1E (HöhlenSTIL, Cave x LITS)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000QU3 (Cave Sums Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000ALC (Twilight Cave Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000EC2 (Cave Sudoku +)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000CW1 (Minesweeper Sudoku)
- https://www.gmpuzzles.com/blog/2022/07/minesweeper-sudoku-by-serkan-yurekli/
- https://erasablegames.com/battleship-sudoku/
- https://erasablegames.com/akari-light-up-on-sudoku/
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000H6A (Slitherlink Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000SRW (Massive Masyudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000OUD (Polysemy, Castle Wall/Masyu)
- https://logic-masters.de/Raetselportal/Suche/spezial.php?chlang=en&listname=rundwege (LMD loop collection)
- https://www.nikoli.co.jp/en/puzzles/masyu/
- https://www.gmpuzzles.com/blog/2021/08/castle-wall-masyu-by-mark-sweep/
- https://www.gmpuzzles.com/images/puzzles/190618-CastleWall-Masyu.pdf
- https://krazydad.com/masyu/tutorial/
- https://swaroopg92.blogspot.com/search/label/Total%20Puzzles (setter blog: Yajilin, Castle Wall, Tapa, Heyawake, Statue Park, Pentominous, Slitherlink, Necklace rulesets)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000HFV (Fillomino sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000B8V (Shikaku Fillomino #2)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=00087H (Shikasudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=00093U (Shikasudoku 2)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000IVK (6x6 Shikaku Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000897 (Spiral Galaxy Sudoku with clues)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=00045K (Space Oddity, Galaxy Killer Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000A76 (Pentomino Sudoku)
- https://wpcunofficial.miraheze.org/wiki/Spiral_Galaxies
- https://www.gmpuzzles.com/blog/spiral-galaxies-rules-info/
- https://wiki.logic-masters.de/index.php/Masyudoku/en
- https://wiki.logic-masters.de/index.php/Country_Road/en, /Simple_Loop/en, /Fillomino/en,
  /Araf/en, /Ripple_Effect/en, /Sashigane/en, /Spiral_Galaxies/en, /Suraromu/en,
  /Bosnian_Road/en, /Shikaku/en, /Anglers/en, /Arukone/en, /Snake/en, /Slalom/en
- https://wiki.logic-masters.de/index.php/Doppelblock-Sudoku
- https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en (290 English genre pages)
- https://logic-masters.de/Raetselportal/Suche/erweitert.php?tag_id=4002 (Cave tag, 233 puzzles)

**Fetch discipline.** From the point the rate limit was set, requests ran one at a time,
at most one per host per ten seconds, with no URL retried after a failure and index pages
preferred over per-genre pages wherever an index states the rules. The bulk rules corpus was
already on disk by then; the later work was four requests in total.

**Could not reach or could not use:**
- https://puzz.link/rules.html and https://puzz.link/list.html rendered pages — JS-only.
  Worked around via the `data-pid` attributes in the raw list HTML and the per-genre
  `js/pzpr-samples/<pid>.js` data files, which is what the rules citations point at.
- https://www.gmpuzzles.com/blog/rules/ — the rules index serves only a sidebar to a
  fetcher. Individual GM Puzzles post pages and the per-genre "rules and info" pages
  (e.g. the Spiral Galaxies one above) do work, and were used where cited.
- https://gapp-puzzles.com/ has no genre or rules index; it is a daily puzzle series from
  the Cracking The Cryptic Discord. `https://gapp-puzzles.com/genres/` is a 404.
- https://wiki.logic-masters.de/index.php?title=Kategorie:Rätselart — empty; the live
  categories are `Kategorie:Haupträtselart/de` (844 German entries) and
  `Kategorie:Puzzletype/en` (290 English entries).
- The LMD advanced search (`Suche/erweitert.php`) accepts a `tag_id` filter by GET but
  ignored a title-text filter in every POST form I tried, so hybrid evidence was gathered
  by web search against the portal rather than by a tag-intersection query. A
  tag-intersection query would be a better method if someone works out the parameter.
- https://fitforpuzzle.com/puzzle-tutorials/ — a large tutorial catalogue covering ~250
  genres including Every Second Turn, Regional Yajilin and Loop de Loop, but it serves only
  its heading index to a fetcher; no rules bodies were returned. Not retried. Worth a look
  in a browser by a human.
- Puzzle Square JP (https://puzsq.logicpuzzle.app/) was not needed once the puzz.link
  corpus was in hand, and was not fetched.
- WPF Sudoku GP instruction booklets were not fetched directly; WPC evidence here comes
  from the WPC unofficial wiki and from puzzle pages citing booklets (e.g. Twilight Cave
  Sudoku citing the WPC 2019 booklet p. 48).

# 5. Summary table

Verdict key, now under the CP-SAT lens: **Good** = worth writing a generator and
uniqueness checker for — the digit coupling is native (typically an int equal to a sum
of bools, or no second layer at all) and the globals encode exactly at acceptable cost;
**Workable** = encodable, but the coupling is invented or a global is expensive;
**Poor** = don't. The cost tag is the expected solve and uniqueness-proof burden:
*cheap* (no connectivity, no flow, static clause lists), *moderate* (one flow or one
circuit), *heavy* (two networks, Hamiltonian coverage, multi-loop, multi-commodity flow,
two adjacency graphs, or order-dependent derived quantities). "Evidence" counts distinct
published Sudoku hybrids found in this run; a "—" means none found after searching the
LMD portal, GM Puzzles and the open web.

| Genre | Family | Decision layer | Global constraints | Verdict | Sudoku-hybrid evidence |
| --- | --- | --- | --- | --- | --- |
| Nurikabe | Shading | binary shade | shaded connected, no 2x2 shaded, one clue per island | Good / heavy | yes (5) |
| Hitori | Shading | binary shade | shaded non-adjacent, white connected | Poor / cheap | — |
| LITS | Shading | tetromino per region | connected, no 2x2, congruent neighbours banned | Workable / cheap | via LITS x Cave/Fillomino/Star Battle (3) |
| Tapa | Shading | binary shade | connected, no 2x2 | Good / moderate | via Tapa x Masyu/Nurikabe (2) |
| Kurodoko / Kuromasu | Shading | binary shade | shaded non-adjacent, white connected | Good / moderate | — (tag only) |
| Heyawake | Shading | binary shade | shaded non-adjacent, white connected, white run crosses ≤1 border | Good / moderate | via Starwacky (1) |
| Yin-Yang | Shading | binary colour, all cells | both colours connected, no monochrome 2x2 | Good / moderate | yes (4+) |
| Nurimisaki | Shading | binary shade | white connected, no monochrome 2x2, complete cape marking | Good / moderate | yes (1) |
| Shakashaka | Shading | 5-state per cell | white areas are rectangles (incl. 45°) | Poor / heavy | — |
| Star Battle | Shading/placement | binary star | king-move separation, exact count per row/col/region | Good / cheap | yes (3) |
| Cave / Corral | Shading | binary shade | white connected, walls reach border | Good / moderate | yes (4) |
| Canal View | Shading | binary shade | shaded connected, no 2x2 | Workable / moderate | clue type in use (2) |
| Kurotto | Shading | binary shade | none | Good / moderate | via Sudokurotto (1) |
| Mochikoro / Mochinyoro | Shading | binary shade | white regions rectangles, diagonally connected, no 2x2 | Workable / heavy | — |
| Light and Shadow | Shading | binary shade | both colours partition, one clue per area | Good / moderate | — |
| Chocona | Shading | binary shade | shaded blocks are rectangles | Good / cheap | — (repo work) |
| Stostone | Shading | binary shade | one block per region, gravity fills bottom half | Workable / heavy | — (tag only) |
| Nuribou | Shading | binary shade | shaded blocks are 1-wide bars, equal bars not diagonal | Workable / heavy | — |
| Norinori | Shading | binary shade | shaded set is dominoes, two per region | Good / cheap | — (tag only) |
| Choco Banana | Shading | binary shade | shaded groups rectangles, white groups not | Good / moderate | — (repo work) |
| Shimaguni | Shading | binary shade | one island per region, separated, neighbours differ in size | Good / cheap | — (tag only) |
| Aqre | Shading | binary shade | shaded connected, no run of 4 in either colour | Good / moderate | — |
| Aquapelago | Shading | binary shade | shaded non-adjacent but diagonally grouped, white connected, no white 2x2 | Workable / heavy | — |
| Minesweeper | Shading/placement | binary mine | total count only | Good / cheap | yes (2) |
| Battleships | Shading/placement | binary occupancy | exact fleet, king-move separation | Good / cheap | yes (2+) |
| Akari | Shading/placement | binary bulb | all white lit, bulbs don't see each other | Workable / cheap | yes (1) |
| Dominion | Shading | binary shade | shaded set is dominoes, letter-consistent white regions | Workable / moderate | — (tag only) |
| Cross the Streams | Shading | binary shade | connected, no 2x2 | Workable / moderate | — (tag only) |
| Coral | Shading | binary shade | connected, no 2x2, white reaches border | Workable / heavy | — (tag only) |
| Creek | Shading | binary shade | white connected | Workable / cheap | — |
| Tetrochain | Shading | tetromino placement | diagonal chain, orthogonal separation | Poor / heavy | — |
| Slitherlink | Loop | edge on/off | single closed loop | Good / heavy | yes (3) |
| Masyu | Loop | per-cell loop shape | single closed loop through every circle | Good / moderate | yes (3+, incl. a named genre) |
| Country Road | Loop | per-cell loop shape | one loop, each region visited once | Good / moderate | — (tag only) |
| Yajilin | Loop + shading | shade + loop | loop covers all unshaded, shaded non-adjacent | Workable / heavy | — (tag only) |
| Simple Loop | Loop | per-cell loop shape | Hamiltonian on unshaded | Workable / moderate | — |
| Castle Wall | Loop | per-cell loop shape | one loop, explicit inside/outside | Good / moderate | via Castle Wall x Masyu (3) |
| Balance Loop | Loop | per-cell loop shape | one loop through every circle | Good / moderate | — |
| Double Back | Loop | per-cell loop shape | Hamiltonian on unshaded, two visits per region | Workable / moderate | — |
| Detour | Loop | per-cell loop shape | Hamiltonian on all cells | Good / heavy | — |
| Geradeweg | Loop | per-cell loop shape | one loop through every circle | Good / moderate | — (tag only) |
| Maxi Loop | Loop | per-cell loop shape | Hamiltonian on all cells | Workable / heavy | — |
| Mid-Loop | Loop | per-cell loop shape | one loop through every circle | Workable / moderate | — (tag only) |
| Koburin | Loop + shading | shade + loop | as Yajilin | Workable / heavy | — |
| Myopia | Loop | edge on/off | single closed loop | Workable / heavy | — (tag only) |
| Onsen-Meguri | Loop | multi-loop | one loop per circle, equal visit length per room | Poor / heavy | — |
| Pipelink / Loop Special | Loop | loop shape with crossings | Hamiltonian / loop identity classes | Poor / heavy | — |
| Round Trip | Loop | loop with crossings | single loop | Workable / heavy | — |
| Tapa-Like Loop | Loop | per-cell loop shape | single closed loop | Good / moderate | via Tapa x Masyu, Necklace (2) |
| Moon or Sun | Loop | per-cell loop shape | one loop, one visit per region, moon/sun alternation | Good / moderate | — (tag only) |
| Numberlink / Arukone | Path | path id per cell | disjointness (+ coverage) | Poor / heavy | — (tag only) |
| Nagenawa / Ring-Ring | Loop | rectangle loops | non-overlap, no shared corners | Workable / moderate | — |
| Snake | Path | binary occupancy | single self-avoiding path, no diagonal contact | Good / moderate | yes (2+, tags) |
| Slalom / Gokigen | Line | binary diagonal | acyclicity | Workable / cheap | partial (1, unverified) |
| Icebarn | Path | directed path with crossings | terrain-driven | Poor / heavy | — |
| Haisu / Kaisu | Path | Hamiltonian path | region visit ordinals | Good / heavy | — |
| Dotchi-Loop | Loop | per-cell loop shape | per-region turn/straight uniformity | Workable / moderate | — |
| Linesweeper | Loop | per-cell loop shape | single closed loop, loop avoids clue cells | Good / moderate | — |
| Regional Yajilin | Loop + shading | shade + loop | loop covers all white, shaded non-adjacent, per-region shaded count | Good / heavy [unverified rules] | — |
| Bosnian Road | Loop | cell loop | non-self-touching loop, 8-neighbour count clue | Good / moderate | — |
| Fillomino | Region | region id | equal-size regions not adjacent | Good / moderate (measured) | yes (4+) |
| Symmetry Area | Region | region id | as Fillomino + 180° symmetry | Good / moderate | — |
| Araf | Region | region id | two clues per region, size strictly between | Good / moderate | — |
| Shikaku | Region | rectangle placement | exact tiling | Good / cheap | yes (4) |
| Nanro | Region + number | filled/empty + count | connected, no 2x2, equal counts not adjacent across borders | Good / moderate | — (tag only) |
| Spiral Galaxies | Region | region id | 180° symmetry about a given centre | Good / moderate | yes (2 + WPC hybrids) |
| Pentominous | Region | pentomino tiling | adjacent shapes differ | Workable / moderate | yes (2) |
| Tetrominous / Fourcells / Fivecells | Region | fixed-size tiling | adjacent shapes differ / border-count clues | Workable / moderate | — |
| Statue Park | Region/placement | polyomino placement | exact bank, separation, connected complement | Workable / heavy | yes (1, Minesweeper-clued) |
| Tren | Region/placement | 1x2, 1x3 placements | non-overlap; clue is sliding freedom | Workable / moderate | — |
| Sashigane | Region | 1-wide L tiling | exact tiling | Good / cheap | — (tag only) |
| Snake Pit | Region | snake tiling | equal-length snakes not adjacent | Good / heavy | — |
| Nawabari | Region | rectangle tiling | per-cell border count clue | Good / cheap | — (Landvermessung tag) |
| Tatamibari | Region | rectangle tiling | shape-class clues, no 4-way border crossings | Workable / cheap | — |
| Ripple Effect / Hakyuu | Number placement | digit per cell | 1..N per region, distance rule on repeats | Good / cheap | yes (tags: Hakyuu, Suguru) |
| Suraromu | Loop | loop + gate ordinals | single loop through every gate once | Workable / heavy | — |
| Nondango | Region/placement | binary recolour | one black per region, no three-in-line | Workable / cheap | — |
| Toichika | Region/placement | arrow per region | pairing | Poor / cheap | — |
| Toichika 2 | Region + number | number per region | pair separated by exactly N cells | Good / cheap | — |
| Doppelblock | Number placement | digit + 2 blanks per line | Latin square with blanks, outside sums | Good / cheap | yes (a named LMD genre) |
| Compass | Region | region id | four directional counts per clue | Good / moderate | — (tag) |
| Square Jam | Region | square tiling | side-length clues, no 4-way intersections | Good / cheap | — |
| Double Choco | Region | region id | two congruent halves per region | Good / moderate | — |
| Renban / Makaro / Meandering Numbers / Cojun | Region + number | digit per cell | 1..N per region under an ordering/adjacency rule | Good / cheap | already standard variant-sudoku rules |

# 6. Encoding building blocks

Every model in this document is assembled from eight devices. Build each once and
the genres name themselves. The repo's own practice is the reference:
`docs/research/fillomino-cpsat.md` for flow, `docs/research/renbanana_cpsat.py` and
`docs/research/zombo_brainanas_cpsat.py` for the rectangle lemma, lazy cuts and
staged hunts, `examples/_shared/cpsat.py` for the solve/forbid/re-solve discipline,
`docs/research/ortools-tuning.md` for the solver settings.

**Single-commodity flow to a root.** One int per directed edge (288 on a 9x9), a
root bool per cell, conservation `inflow - outflow == 1 - emit` at every cell, arcs
gated on the cells sharing the property being connected. Proves a set is connected;
when the root emits a *variable* amount it also proves size-equals-that-amount in
the same equation, which is the fillomino trick. Used by: Nurikabe (twice), Yin-Yang
(twice), Tapa, Kurodoko, Heyawake, Cave, Canal View, Nurimisaki, Aqre, Coral, Creek,
Cross the Streams, Nanro, Araf, Fillomino, Light and Shadow, Snake Pit, Statue Park.
Rejected alternatives are on file: parent-pointer spanning forests need an extra
region id to stay correct, and lazy no-good cuts on disconnection turn one solve
into an unbounded loop.

**Region ids made free by the separation rule.** When a genre forbids equal-sized
regions from touching, a region *is* a connected component of equal digits, so no
region objects, no region count and no separation constraint need be written —
everything follows from one statement per component. Used by: Fillomino, Symmetry
Area, Snake Pit, and partially Nuribou. This is the cheapest region encoding known
here and the first thing to check for in any new region genre.

**Loop via `AddCircuit` with self-loops.** Arc literals for the four directions out
of each cell plus a self-loop literal per cell, ~370 literals on a 9x9. Subtour
elimination is native to the constraint. Force a self-loop literal false to require
coverage of that cell; leave it free when the loop may skip cells. A path instead of
a loop is a circuit with one virtual node joining the endpoints. Used by: Masyu,
Geradeweg, Balance Loop, Country Road, Moon or Sun, Castle Wall, Dotchi-Loop,
Tapa-Like Loop, Linesweeper, Bosnian Road, Simple Loop, Double Back, Detour, Maxi
Loop, Yajilin, Koburin, Haisu, Snake. Slitherlink's variant lives on the vertex
graph over 180 edge bools with degree-0-or-2 constraints.

**Placement bools instead of cell states.** Enumerate the legal placements of a
shape in Python, one bool each, `AddExactlyOne` per clue or per bank item, and a
linear cover equality per cell. Turns a shape-detection problem into exact cover,
which is CP-SAT's best case, and makes pairwise shape rules a static clause list
computed before the solve. Used by: Shikaku, Nawabari, Tatamibari, Sashigane,
Pentominous, Fourcells, Fivecells, Statue Park, Battleships, LITS (per box), Tren,
Nagenawa and Ring-Ring. This device removes the need for a flow entirely wherever
the shape is connected by construction.

**The rectangle lemma, and its 1-wide cousin.** A colour's groups are all filled
rectangles iff the colour is connected and no 2x2 window holds exactly three cells
of it — 64 window constraints, exact and local, already written in
`renbanana_cpsat.py`. The same style of window argument gives 1-wide bars: no 2x2
window holds three or more. Used by: Chocona, Choco Banana, Mochikoro, Mochinyoro,
Tasquare, Lookair, Nuribou, Snake Pit, Square Jam.

**No-2x2 and run-length clause lists.** Both are static clauses computed once. No
monochrome 2x2 is 64 windows per colour. A run-length bound (Aqre's "no four in a
row of either colour") is two clauses per window of four, 216 on a 9x9. They cost
nothing and prune hard, which is the best combination a generator can get. Used by:
Nurikabe, Tapa, Canal View, Yin-Yang, Nurimisaki, Aqre, Coral, Cross the Streams,
Nanro, Aquapelago, Heyawake's rule 3 (as a segment clause list).

**Count clues as linear sums of bools.** `x[p] == sum(b[q] for q in some set)` — an
int equal to a sum of booleans — is the friendliest constraint shape in this
document and the one CP-SAT presolve handles best. It covers every per-box shaded
count (Heyawake, Chocona, Aqre, Shimaguni, Stostone, Nanro), every 8-neighbourhood
count (Minesweeper, Koburin, Linesweeper, Bosnian Road), every outside row/column
count (Battleships, Snake, Aquarium), and every per-box loop-visit or turn count
(Country Road, Detour, Masyudoku's published coupling). When a genre's clue is a
count, the hybrid is cheap.

**Sight and segment chains.** A visibility clue needs prefix bools:
`see[p,d,k] => see[p,d,k-1] AND the k-th cell is the right colour`, ~8 per direction
per clue, then a linear sum. The same chain measures a straight loop segment's
length. Cheap in bool form; the expensive variant is a *sum of the digits seen*,
which needs a bool-times-int product per step and is the costliest device here —
prefer one direction, a two-digit clue, or a group sum instead. Used by: Kurodoko,
Cave, Canal View, Nurimisaki, Coral, Akari, Myopia, Geradeweg, Balance Loop,
Mid-Loop, Round Trip, Doppelblock's sandwich sums.

**Position variables for order.** `pos[p]` in 0..80 with `pos[q] == pos[p] + 1`
reified on each arc literal, one cell pinned to 0: 81 ints and ~290 reified
equalities. The only way to express "in the order the loop visits them", and the
most expensive device in the toolkit. Build it once in Simple Loop. Used by: Haisu
and Kaisu (where the ordinal *is* the clue and pays for itself), Suraromu, and any
"digits along the line increase" coupling on Snake or Simple Loop.

**Two disciplines, not devices, that the repo already enforces.** First, **stage the
hunt**: sample the decision layer alone, then fit digits on each fixed layer, never
a joint search — `renbanana_cpsat.py` says so explicitly and the Zombo prototype
agrees. Second, **forbid on the answer variables only**. `enumerate_all_solutions`
is a trap for exactly these models: auxiliary flow, region-id and placement
variables produce phantom second solutions, and it reported n=2 on a unique
fillomino. Use solve, read back, forbid on the cells, solve again — and treat a
`TimeoutError` as no verdict, never as unique.

# 7. Ranked recommendations for this repo

**The lens:** would I want to write a CP-SAT generator and uniqueness checker for
this genre as a sudoku hybrid, in the style of `examples/fillomino/generate.py`,
`renbanana_cpsat.py` and `zombo_brainanas_cpsat.py`? The ranking weighs three
things: how naturally the digit layer couples (ideally an int equal to a sum of
bools, or no second layer at all), how expensive the global constraints are to
encode exactly, and whether the genre is unclaimed enough to be worth the build.

**Build these ten, in this order.**

1. **Star Battle.** The smallest model in the survey and the best warm-up: no
   connectivity, no shape rule, no flow. Place 1..7 plus two stars per house and the
   two layers collapse into one variable per cell — 81 ints, ~90 linear constraints,
   sub-second proofs. Published hybrid exists to check against.
2. **Chocona.** The rectangle lemma alone, 64 windows, plus `x[p] == sum of shaded
   in box`. No flow anywhere. Cheapest *good* coupling in the document, and every
   line of the shape encoding is already in `renbanana_cpsat.py`. Unclaimed.
3. **Geradeweg.** The loop family's best coupling-to-cost ratio: segment length is
   1..9, exactly the digit range, so the clue is a bare equality with no remap. One
   `AddCircuit`, one prefix chain per circle, and the loop need not cover every cell
   so the digit layer keeps freedom. No published hybrid anywhere — the strongest
   unclaimed pick in the survey.
4. **Light and Shadow.** Fillomino's flow with a colour layer: both colours
   partition into clued areas whose size equals a digit, 1..9, on every cell. The
   repo's best-understood encoding transfers almost verbatim and the genre has no
   published hybrid at all.
5. **Shikaku.** Exact cover over enumerated rectangles — no connectivity machinery
   of any kind — with a native in-range area clue and four published hybrids to
   calibrate against. The best cost-to-value ratio in the region family.
6. **Minesweeper.** Pure 0/1 linear algebra: every clue is a sum of eight bools
   equalling a digit. CP-SAT presolve eats this. Two published hybrids, including a
   Serkan Yürekli GM Puzzles piece, so the design space is charted.
7. **Linesweeper, and Bosnian Road with it.** One `AddCircuit`, no coverage rule, no
   region structure, no prefix chain, and a Minesweeper clue mounted on a loop — the
   cheapest way to get an order-bearing decision layer with a native digit clue. One
   build with a rule flag covers both genres, neither of which has a hybrid.
8. **Shimaguni.** The one genre whose global constraint decomposes onto the sudoku's
   own boxes: nine independent 3x3 connectivity problems, each an
   `AddAllowedAssignments` table, so the model contains no flow at all. Island size
   equals a digit, and the neighbouring-boxes-differ rule reads like a latin-square
   argument.
9. **Sashigane.** Exact cover over enumerated L-shapes with three clue types —
   size, elbow, arrow — of which the size is a native in-range digit and the other
   two are static filters on the enumeration rather than constraints. Unclaimed.
10. **Araf.** Fillomino's machinery with a strictly *looser* clue: the region size
    is bracketed between two digits rather than pinned. That looseness is what stops
    the region layer solving itself, which is the single most common failure mode of
    a hybrid. Unclaimed.

**Cheap because the repo already has the encoding.** These reuse a device that is
written, debugged and measured here, so the build is assembly rather than research:
**Fillomino** and **Symmetry Area** (the flow-plus-equal-digit collapse, with a
recorded runtime profile — 0.3-69 s proofs, median 10.4 s); **Choco Banana** (the
rectangle lemma, the lazy-cut loop, and an independent verifier all exist);
**Chocona**, **Mochikoro**, **Square Jam**, **Tasquare** and **Nuribou** (the
rectangle lemma and its 1-wide cousin); **Nawabari** and **Tatamibari** (Shikaku's
rectangle enumeration with a different clue family); **Snake Pit** (Fillomino's
collapse plus two local shape rules); **Doppelblock** and **Ripple Effect** (no
second layer at all — they are sudoku variants wearing another name).

**Avoid, and why — under this lens the reasons are encoding costs, not taste.**

- **Multi-loop genres** — Onsen-Meguri, Loop Special, Pipelink. `AddCircuit` means
  *one* circuit; several loops need per-cell loop-id labels whose classes the solver
  is choosing, which is the most expensive shape in this document. Pipelink's
  crossings additionally force a split-cell graph at double the node count.
- **Multi-commodity flow** — Numberlink and Arukone. Nine endpoint pairs means nine
  commodities, ~2600 flow ints, and the genre admits many solutions without full
  coverage, so uniqueness proofs are slow *and* usually negative.
- **Two adjacency graphs in one model** — Aquapelago (orthogonal white connectivity
  plus diagonal shaded groups), Mochikoro and Tetrochain (a flow on the quotient
  graph of regions under diagonal adjacency, where the graph itself is a decision
  variable).
- **Sums along a sight line** — the bool-times-int product per prefix step is the
  costliest coupling device here. Cave Sums and four-way Kurodoko digit sums want
  it; take the one-direction, two-digit or group-sum fix instead.
- **Order-dependent simulation** — Stostone's gravity. Rigid blocks falling is
  sequential, and the tractable column-count reformulation is a strict relaxation
  that changes the puzzle. 9 is also odd, so "bottom half" needs a board change.
- **Half-cell geometry** — Shakashaka. The white regions' boundaries run diagonally
  through cells, so the rectangle lemma has no analogue and there is no compact cut
  to post lazily. Heavy cost for geometry rather than puzzle content.
- **Weak or vacuous coupling** — Hitori (its no-repeats rule is implied by the
  sudoku and presolve deletes it, leaving an unconstrained shading), Numberlink and
  Dominion (the natural digit reading forces all nine cells of a digit into one
  region or path, which is over-tight), Icebarn and Nagare (directions and given
  terrain, neither of which a sudoku grid supplies), Toichika v1 (arrows carry no
  quantity — model Toichika 2 instead, whose "a pair of N has exactly N cells
  between them" is a digit fixing a distance in one linear constraint).
- **Fixed-size tilings that do not divide 81** — Pentominous (5) and Tetrominous
  (4). Every hybrid pays a design tax working around it.

**One note carried over.** If any of these is ever also built as a SudokuMaker
constraint component rather than only as a CP-SAT model, the repo's `update`
soundness invariant applies and connectivity is where it fails — see
`docs/research/connectivity-techniques.md` and
`docs/research/infection-shading-model.md`.
