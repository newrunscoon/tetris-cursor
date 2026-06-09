// ============================================================
// 테트리스 핵심 데이터, 충돌 판정, 자동 낙하, 키 입력 및 렌더링
// ============================================================

// --- 캔버스 및 보드 크기 상수 ---
const canvas = document.getElementById('game-board');
const ctx = canvas.getContext('2d');

const COLS = 10;  // 가로 칸 수
const ROWS = 20;  // 세로 칸 수
const CELL_SIZE = canvas.width / COLS; // 한 칸의 픽셀 크기 (30px)

// 낙하 속도 · 레벨 설정
const BASE_DROP_INTERVAL = 500;  // 레벨 1 기본 낙하 간격 (ms)
const MIN_DROP_INTERVAL = 120;   // 최대 속도 하한
const DROP_SPEED_STEP = 40;      // 레벨마다 줄어드는 간격 (ms)
const SCORE_PER_LEVEL = 1000;    // 이 점수마다 레벨 1 상승

// 다음 블록 미리보기 캔버스
const nextCanvas = document.getElementById('next-piece');
const nextCtx = nextCanvas.getContext('2d');
const NEXT_PREVIEW_COLS = 4;
const NEXT_CELL_SIZE = nextCanvas.width / NEXT_PREVIEW_COLS;

// 줄 삭제 점수 (동시에 지운 줄 수 → 추가 점수)
const LINE_SCORES = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const gameOverOverlay = document.getElementById('game-over-overlay');
const restartButton = document.getElementById('restart-button');
let score = 0;
let nextPieceType = null;

// --- (1) 10×20 보드 그리드 ---
// 0 = 빈 칸, 문자열 = 고정된 블록의 색상(hex)
// createBoard()로 매번 새 2차원 배열을 만들어 사용한다.
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

const board = createBoard();

// 보드 그리드를 빈 상태로 되돌린다.
function resetBoard() {
  const freshBoard = createBoard();
  for (let row = 0; row < ROWS; row++) {
    board[row] = freshBoard[row];
  }
}

// --- (2) 7가지 테트로미노 정의 ---
// 각 블록: color(색상), shapes[0](기본 모양 매트릭스, 1=채워진 칸)
// 회전은 shapes[0]을 시계방향으로 돌려 계산한다 (rotation: 0~3).
const TETROMINOES = {
  I: {
    color: '#00f0f0', // 하늘색
    shapes: [
      [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
    ],
  },
  O: {
    color: '#f0f000', // 노란색
    shapes: [
      [
        [1, 1],
        [1, 1],
      ],
    ],
  },
  T: {
    color: '#a000f0', // 보라색
    shapes: [
      [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
    ],
  },
  S: {
    color: '#00f000', // 초록색
    shapes: [
      [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
      ],
    ],
  },
  Z: {
    color: '#f00000', // 빨간색
    shapes: [
      [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
      ],
    ],
  },
  J: {
    color: '#0000f0', // 파란색
    shapes: [
      [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
    ],
  },
  L: {
    color: '#f0a000', // 주황색
    shapes: [
      [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0],
      ],
    ],
  },
};

// 7가지 블록 종류 목록 (랜덤 스폰에 사용)
const PIECE_TYPES = Object.keys(TETROMINOES);

// 현재 화면에 그릴 떨어지는 블록 상태
// type: 블록 종류, rotation: 회전 인덱스, x/y: 보드 그리드 좌표(왼쪽 위 기준)
const currentPiece = {
  type: 'T',
  rotation: 0,
  x: 0,
  y: 0,
};

// 블록 종류에 맞는 현재 회전 매트릭스를 반환한다.
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

// 매트릭스의 가로·세로 칸 수를 구한다.
function getMatrixSize(matrix) {
  return {
    width: matrix[0].length,
    height: matrix.length,
  };
}

// 보드 맨 위 가로 중앙에 블록이 오도록 x, y 좌표를 계산한다.
function getSpawnPosition(type) {
  const matrix = TETROMINOES[type].shapes[0];
  const { width } = getMatrixSize(matrix);
  return {
    x: Math.floor((COLS - width) / 2),
    y: 0,
  };
}

// --- 충돌 판정 ---

// 조각의 각 칸을 보드 좌표로 변환해 순회하는 헬퍼
// callback(col, row)가 true를 반환하면 즉시 true, 끝까지 없으면 false
function forEachPieceCell(piece, offsetX, offsetY, callback) {
  const matrix = getPieceMatrix(piece);

  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (!matrix[row][col]) continue;

      const boardCol = piece.x + col + offsetX;
      const boardRow = piece.y + row + offsetY;

      if (callback(boardCol, boardRow)) {
        return true;
      }
    }
  }

  return false;
}

// 보드 경계(좌·우·아래)를 벗어나는지 판정한다.
// 위쪽(row < 0)은 스폰 직후 일부 블록이 살짝 나갈 수 있어 허용한다.
function isOutOfBounds(piece, offsetX = 0, offsetY = 0) {
  return forEachPieceCell(piece, offsetX, offsetY, (col, row) => {
    return col < 0 || col >= COLS || row >= ROWS;
  });
}

// 이미 고정된 블록과 겹치는지 판정한다.
function collidesWithBlocks(piece, offsetX = 0, offsetY = 0) {
  return forEachPieceCell(piece, offsetX, offsetY, (col, row) => {
    // 보드 밖(특히 위쪽)은 고정 블록 검사 대상이 아니다.
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
      return false;
    }
    return board[row][col] !== 0;
  });
}

// 경계·고정 블록 모두를 고려해 해당 위치에 놓을 수 있는지 판정한다.
function isValidPosition(piece, offsetX = 0, offsetY = 0) {
  return !isOutOfBounds(piece, offsetX, offsetY)
    && !collidesWithBlocks(piece, offsetX, offsetY);
}

// --- 게임 로직 ---

// 현재 조각을 보드에 고정(잠금)한다.
function lockPiece() {
  const matrix = getPieceMatrix(currentPiece);
  const color = TETROMINOES[currentPiece.type].color;

  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (!matrix[row][col]) continue;

      const boardRow = currentPiece.y + row;
      const boardCol = currentPiece.x + col;

      // 보드 안에 있는 칸만 기록한다.
      if (boardRow >= 0 && boardRow < ROWS && boardCol >= 0 && boardCol < COLS) {
        board[boardRow][boardCol] = color;
      }
    }
  }
}

// 한 줄이 가득 찼는지 검사한다 (모든 칸이 0이 아니면 가득 참).
function isRowFull(row) {
  return row.every((cell) => cell !== 0);
}

// 가득 찬 줄을 모두 제거하고, 위 블록을 아래로 내린다.
// 삭제된 줄 수를 반환한다 (동시에 여러 줄 처리 가능).
function clearLines() {
  const remainingRows = board.filter((row) => !isRowFull(row));
  const linesCleared = ROWS - remainingRows.length;

  // 위쪽에 빈 줄을 채워 보드 높이(20줄)를 유지한다.
  while (remainingRows.length < ROWS) {
    remainingRows.unshift(Array(COLS).fill(0));
  }

  for (let row = 0; row < ROWS; row++) {
    board[row] = remainingRows[row];
  }

  return linesCleared;
}

// 지운 줄 수에 따라 점수를 더하고, 레벨·낙하 속도를 갱신한다.
function addScore(linesCleared) {
  if (linesCleared <= 0) return;

  const points = LINE_SCORES[linesCleared];
  if (points) {
    score += points;
    updateScoreDisplay();
    updateLevelDisplay();
    updateDropSpeed();
  }
}

// 현재 레벨을 계산한다 (1000점마다 1레벨 상승).
function getLevel() {
  return Math.floor(score / SCORE_PER_LEVEL) + 1;
}

// 레벨에 따른 낙하 간격(ms)을 계산한다.
function getDropInterval() {
  const level = getLevel();
  return Math.max(
    MIN_DROP_INTERVAL,
    BASE_DROP_INTERVAL - (level - 1) * DROP_SPEED_STEP
  );
}

// 점수·레벨 표시를 갱신한다.
function updateScoreDisplay() {
  scoreElement.textContent = score;
}

function updateLevelDisplay() {
  levelElement.textContent = getLevel();
}

// 레벨 변화에 맞춰 자동 낙하 타이머를 재설정한다.
function updateDropSpeed() {
  if (gameOver || dropTimer === null) return;

  clearInterval(dropTimer);
  dropTimer = setInterval(tick, getDropInterval());
}

// 랜덤 블록 종류를 하나 뽑는다.
function getRandomPieceType() {
  return PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
}

// 다음 블록 미리보기 캔버스에 그린다.
function drawNextPiece() {
  nextCtx.fillStyle = '#000';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (!nextPieceType) return;

  const tetromino = TETROMINOES[nextPieceType];
  const matrix = tetromino.shapes[0];
  const { width, height } = getMatrixSize(matrix);

  // 4×4 영역 안에서 블록을 중앙 정렬
  const offsetX = Math.floor((NEXT_PREVIEW_COLS - width) / 2);
  const offsetY = Math.floor((NEXT_PREVIEW_COLS - height) / 2);

  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (!matrix[row][col]) continue;

      const x = (offsetX + col) * NEXT_CELL_SIZE;
      const y = (offsetY + row) * NEXT_CELL_SIZE;

      nextCtx.fillStyle = tetromino.color;
      nextCtx.fillRect(
        x + 1,
        y + 1,
        NEXT_CELL_SIZE - 2,
        NEXT_CELL_SIZE - 2
      );
    }
  }
}

// 대기 중인 next 블록을 현재 조각으로 꺼내고, 새 next를 준비한다.
function spawnPiece() {
  const type = nextPieceType ?? getRandomPieceType();
  nextPieceType = getRandomPieceType();
  const spawn = getSpawnPosition(type);

  currentPiece.type = type;
  currentPiece.rotation = 0;
  currentPiece.x = spawn.x;
  currentPiece.y = spawn.y;

  drawNextPiece();

  // 스폰 직후부터 충돌이면 더 이상 내릴 공간이 없는 상태(게임 오버)
  return isValidPosition(currentPiece);
}

// 한 칸 아래로 이동을 시도한다. 성공하면 true, 막히면 false.
function tryMoveDown() {
  if (isValidPosition(currentPiece, 0, 1)) {
    currentPiece.y += 1;
    return true;
  }
  return false;
}

// 좌우 이동을 시도한다. dx는 -1(왼쪽) 또는 1(오른쪽).
function tryMoveHorizontal(dx) {
  if (isValidPosition(currentPiece, dx, 0)) {
    currentPiece.x += dx;
    return true;
  }
  return false;
}

// 시계방향 회전을 시도한다. 벽·블록에 막히면 회전하지 않는다 (벽 차기 없음).
function tryRotateClockwise() {
  const nextRotation = (currentPiece.rotation + 1) % 4;
  const testPiece = {
    type: currentPiece.type,
    rotation: nextRotation,
    x: currentPiece.x,
    y: currentPiece.y,
  };

  if (isValidPosition(testPiece)) {
    currentPiece.rotation = nextRotation;
    return true;
  }
  return false;
}

// 조각을 고정하고 새 블록을 스폰한다. 성공하면 true, 게임 오버면 false.
let dropTimer = null;
let gameOver = false;

function showGameOverOverlay() {
  gameOverOverlay.classList.remove('hidden');
  gameOverOverlay.setAttribute('aria-hidden', 'false');
}

function hideGameOverOverlay() {
  gameOverOverlay.classList.add('hidden');
  gameOverOverlay.setAttribute('aria-hidden', 'true');
}

// 새 블록을 둘 공간이 없을 때 낙하를 멈추고 게임 오버를 표시한다.
function triggerGameOver() {
  if (dropTimer !== null) {
    clearInterval(dropTimer);
    dropTimer = null;
  }
  gameOver = true;
  showGameOverOverlay();
  draw();
}

function lockAndSpawn() {
  lockPiece();

  const linesCleared = clearLines();
  addScore(linesCleared);

  if (!spawnPiece()) {
    triggerGameOver();
    return false;
  }

  return true;
}

// 아래 화살표: 한 칸 빠르게 내리기 (soft drop)
function softDrop() {
  if (!tryMoveDown()) {
    lockAndSpawn();
  }
}

// 스페이스바: 바닥까지 즉시 내리기 (hard drop)
function hardDrop() {
  while (tryMoveDown()) {}
  lockAndSpawn();
}

// 자동 낙하 1틱: 내려가거나, 막히면 고정 후 새 블록 스폰
function tick() {
  if (gameOver) return;

  if (!tryMoveDown()) {
    lockAndSpawn();
  }

  draw();
}

// --- 키보드 입력 ---

function handleKeyDown(event) {
  if (gameOver) return;

  switch (event.code) {
    case 'ArrowLeft':
      event.preventDefault();
      tryMoveHorizontal(-1);
      draw();
      break;

    case 'ArrowRight':
      event.preventDefault();
      tryMoveHorizontal(1);
      draw();
      break;

    case 'ArrowDown':
      event.preventDefault();
      softDrop();
      draw();
      break;

    case 'ArrowUp':
      event.preventDefault();
      tryRotateClockwise();
      draw();
      break;

    case 'Space':
      event.preventDefault();
      hardDrop();
      draw();
      break;

    default:
      break;
  }
}

// --- (3) 그리기 헬퍼 ---

// 보드 그리드 (col, row) 한 칸을 캔버스 픽셀 좌표로 변환
function gridToPixel(col, row) {
  return {
    x: col * CELL_SIZE,
    y: row * CELL_SIZE,
  };
}

// 지정된 그리드 위치에 한 칸짜리 블록을 그린다.
function drawCell(col, row, color) {
  const { x, y } = gridToPixel(col, row);
  const padding = 1; // 칸 사이 얇은 간격

  ctx.fillStyle = color;
  ctx.fillRect(
    x + padding,
    y + padding,
    CELL_SIZE - padding * 2,
    CELL_SIZE - padding * 2
  );
}

// 보드에 고정된 블록들을 그린다.
function drawBoard() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = board[row][col];
      if (cell) {
        drawCell(col, row, cell);
      }
    }
  }
}

// 보드 배경과 격자선을 그린다.
function drawGrid() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;

  // 세로 격자선
  for (let col = 0; col <= COLS; col++) {
    ctx.beginPath();
    ctx.moveTo(col * CELL_SIZE, 0);
    ctx.lineTo(col * CELL_SIZE, canvas.height);
    ctx.stroke();
  }

  // 가로 격자선
  for (let row = 0; row <= ROWS; row++) {
    ctx.beginPath();
    ctx.moveTo(0, row * CELL_SIZE);
    ctx.lineTo(canvas.width, row * CELL_SIZE);
    ctx.stroke();
  }
}

// 현재 떨어지는 블록(아직 보드에 고정되지 않은 조각)을 그린다.
function drawCurrentPiece() {
  const tetromino = TETROMINOES[currentPiece.type];
  const matrix = getPieceMatrix(currentPiece);

  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (matrix[row][col]) {
        drawCell(currentPiece.x + col, currentPiece.y + row, tetromino.color);
      }
    }
  }
}

// 보드 그리드 + 고정 블록 + 현재 블록을 한 번에 그리는 메인 함수
function draw() {
  drawGrid();
  drawBoard();

  // 게임 오버 시에는 스폰 실패한 조각을 그리지 않는다.
  if (!gameOver) {
    drawCurrentPiece();
  }
}

// 보드·점수·레벨을 초기화하고 게임을 새로 시작한다.
function startGame() {
  if (dropTimer !== null) {
    clearInterval(dropTimer);
    dropTimer = null;
  }

  resetBoard();
  score = 0;
  gameOver = false;
  nextPieceType = getRandomPieceType();
  updateScoreDisplay();
  updateLevelDisplay();
  hideGameOverOverlay();
  spawnPiece();
  draw();
  dropTimer = setInterval(tick, getDropInterval());
}

// --- 초기화: 키 입력·다시 시작 버튼 등록 후 게임 시작 ---
function init() {
  document.addEventListener('keydown', handleKeyDown);
  restartButton.addEventListener('click', startGame);
  startGame();
}

init();
