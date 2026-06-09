/**
 * Tetris 게임 로직 자동 QA
 * script.js의 규칙과 동기화 유지 (상수 변경 시 함께 수정)
 *
 * 실행: node .cursor/skills/tetris-qa/scripts/verify-logic.mjs
 */

// --- script.js와 동일한 상수 ---
const COLS = 10;
const ROWS = 20;

const LINE_SCORES = { 1: 100, 2: 300, 3: 500, 4: 800 };

const BASE_DROP_INTERVAL = 500;
const MIN_DROP_INTERVAL = 120;
const DROP_SPEED_STEP = 40;
const SCORE_PER_LEVEL = 1000;

const TETROMINOES = {
  I: { color: '#00f0f0', shapes: [[[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]]] },
  O: { color: '#f0f000', shapes: [[[1, 1], [1, 1]]] },
  T: { color: '#a000f0', shapes: [[[0, 1, 0], [1, 1, 1], [0, 0, 0]]] },
  S: { color: '#00f000', shapes: [[[0, 1, 1], [1, 1, 0], [0, 0, 0]]] },
  Z: { color: '#f00000', shapes: [[[1, 1, 0], [0, 1, 1], [0, 0, 0]]] },
  J: { color: '#0000f0', shapes: [[[1, 0, 0], [1, 1, 1], [0, 0, 0]]] },
  L: { color: '#f0a000', shapes: [[[0, 0, 1], [1, 1, 1], [0, 0, 0]]] },
};

const PIECE_TYPES = Object.keys(TETROMINOES);

// --- 게임 로직 (script.js 미러) ---
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function rotateMatrixClockwise(matrix) {
  const rowCount = matrix.length;
  const colCount = matrix[0].length;
  const rotated = Array.from({ length: colCount }, () => Array(rowCount).fill(0));
  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      rotated[col][rowCount - 1 - row] = matrix[row][col];
    }
  }
  return rotated;
}

function getPieceMatrix(piece) {
  let matrix = TETROMINOES[piece.type].shapes[0];
  for (let i = 0; i < piece.rotation % 4; i++) {
    matrix = rotateMatrixClockwise(matrix);
  }
  return matrix;
}

function forEachPieceCell(piece, board, offsetX, offsetY, callback) {
  const matrix = getPieceMatrix(piece);
  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (!matrix[row][col]) continue;
      const boardCol = piece.x + col + offsetX;
      const boardRow = piece.y + row + offsetY;
      if (callback(boardCol, boardRow)) return true;
    }
  }
  return false;
}

function isOutOfBounds(piece, board, offsetX = 0, offsetY = 0) {
  return forEachPieceCell(piece, board, offsetX, offsetY, (col, row) =>
    col < 0 || col >= COLS || row >= ROWS
  );
}

function collidesWithBlocks(piece, board, offsetX = 0, offsetY = 0) {
  return forEachPieceCell(piece, board, offsetX, offsetY, (col, row) => {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    return board[row][col] !== 0;
  });
}

function isValidPosition(piece, board, offsetX = 0, offsetY = 0) {
  return !isOutOfBounds(piece, board, offsetX, offsetY)
    && !collidesWithBlocks(piece, board, offsetX, offsetY);
}

function isRowFull(row) {
  return row.every((cell) => cell !== 0);
}

function clearLines(board) {
  const remainingRows = board.filter((row) => !isRowFull(row));
  const linesCleared = ROWS - remainingRows.length;
  while (remainingRows.length < ROWS) {
    remainingRows.unshift(Array(COLS).fill(0));
  }
  for (let row = 0; row < ROWS; row++) {
    board[row] = remainingRows[row];
  }
  return linesCleared;
}

function addScore(score, linesCleared) {
  if (linesCleared <= 0) return score;
  const points = LINE_SCORES[linesCleared];
  return points ? score + points : score;
}

function getLevel(score) {
  return Math.floor(score / SCORE_PER_LEVEL) + 1;
}

function getDropInterval(score) {
  const level = getLevel(score);
  return Math.max(MIN_DROP_INTERVAL, BASE_DROP_INTERVAL - (level - 1) * DROP_SPEED_STEP);
}

function getRandomPieceType() {
  return PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
}

function getSpawnPosition(type) {
  const matrix = TETROMINOES[type].shapes[0];
  const width = matrix[0].length;
  return { x: Math.floor((COLS - width) / 2), y: 0 };
}

// --- 테스트 러너 ---
const results = [];

function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
}

// (1) 7종 블록
check('7종 테트로미노 정의', PIECE_TYPES.length === 7, PIECE_TYPES.join(', '));

const seenTypes = new Set();
for (let i = 0; i < 500; i++) seenTypes.add(getRandomPieceType());
check('랜덤 스폰 500회 7종 모두 등장', seenTypes.size === 7, [...seenTypes].join(', '));

for (const type of PIECE_TYPES) {
  const { x, y } = getSpawnPosition(type);
  for (let rotation = 0; rotation < 4; rotation++) {
    const piece = { type, rotation, x, y };
    if (!isValidPosition(piece, createBoard())) {
      check(`스폰 유효성: ${type} rot${rotation}`, false);
    }
  }
}
check('7종 × 4회전 스폰 유효', !results.some((r) => r.name.startsWith('스폰 유효성:') && !r.pass));

// (2) 이동·회전·하강
const board = createBoard();
const piece = { type: 'T', rotation: 0, x: 3, y: 0 };

check('초기 위치 유효', isValidPosition(piece, board));
check('오른쪽 이동', isValidPosition(piece, board, 1, 0));
check('왼쪽 이동', isValidPosition(piece, board, -1, 0));
check('아래 이동', isValidPosition(piece, board, 0, 1));
check('시계방향 회전', isValidPosition({ type: 'T', rotation: 1, x: 3, y: 0 }, board));

piece.x = 0;
check('왼쪽 벽 충돌', !isValidPosition(piece, board, -1, 0));

piece.x = 3;
let dropCount = 0;
while (isValidPosition(piece, board, 0, 1)) {
  piece.y += 1;
  dropCount++;
}
check('바닥까지 하강', dropCount > 0, `${dropCount}칸`);

// (3) 줄 삭제·점수
const board2 = createBoard();
for (let row = ROWS - 2; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) board2[row][col] = '#fff';
}
const cleared2 = clearLines(board2);
const score2 = addScore(0, cleared2);
check('2줄 삭제', cleared2 === 2, `${cleared2}줄`);
check('2줄 점수 300', score2 === 300, `${score2}점`);

const board3 = createBoard();
for (let row = ROWS - 3; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) board3[row][col] = '#fff';
}
check('3줄 점수 500', addScore(0, clearLines(board3)) === 500);

const board4 = createBoard();
for (let row = ROWS - 4; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) board4[row][col] = '#fff';
}
const cleared4 = clearLines(board4);
const score4 = addScore(0, cleared4);
check('4줄 동시 삭제', cleared4 === 4, `${cleared4}줄`);
check('4줄 점수 800', score4 === 800, `${score4}점`);

// (4) 레벨·낙하 속도
check('레벨 1 (0점)', getLevel(0) === 1);
check('레벨 2 (1000점)', getLevel(1000) === 2);
check('레벨1 낙하 500ms', getDropInterval(0) === 500);
check('레벨2 낙하 460ms', getDropInterval(1000) === 460);
check('최소 낙하 간격 하한', getDropInterval(100000) === MIN_DROP_INTERVAL);

// (5) 게임 오버·재시작
let gameOver = false;
let dropTimer = 1;
let gameBoard = createBoard();
let score = 0;

function spawnSim(nextPieceType) {
  const type = nextPieceType ?? getRandomPieceType();
  const spawn = getSpawnPosition(type);
  const current = { type, rotation: 0, x: spawn.x, y: spawn.y };
  return { ok: isValidPosition(current, gameBoard), current };
}

function startGameSim() {
  dropTimer = null;
  gameBoard = createBoard();
  score = 0;
  gameOver = false;
  spawnSim(getRandomPieceType());
  dropTimer = 1;
}

for (let row = 0; row < 4; row++) {
  for (let col = 0; col < COLS; col++) gameBoard[row][col] = '#000';
}
const spawnResult = spawnSim('T');
if (!spawnResult.ok) {
  dropTimer = null;
  gameOver = true;
}
check('스폰 불가 → 게임 오버', gameOver && dropTimer === null);

startGameSim();
check('재시작: gameOver 해제', !gameOver);
check('재시작: 보드 비움', gameBoard.every((row) => row.every((c) => c === 0)));
check('재시작: 점수 0', score === 0);
check('재시작: 타이머 재시작', dropTimer !== null);

// --- 요약 ---
const failed = results.filter((r) => !r.pass);
console.log('\n--- Tetris QA 요약 ---');
console.log(`총 ${results.length}항목, ${results.length - failed.length} 통과, ${failed.length} 실패`);

process.exit(failed.length > 0 ? 1 : 0);
