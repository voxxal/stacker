const socket = io("https://createtask-server.shia5046.repl.co");
const blockElements = Array.from(document.querySelectorAll("#you > .blocks .row")).map(e => Array.from(e.children));
const enemyBlockElements = Array.from(document.querySelectorAll("#enemy .blocks .row")).map(e => Array.from(e.children));
const joinRoomInput = document.getElementById("join-room-input");
const joinRoom = document.getElementById("join-room");
const createRoom = document.getElementById("create-room");
const createRoomUrl = document.getElementById("create-room-url");
const playBtn = document.getElementById("play");
const status = document.getElementById("status");
const logo = document.getElementById("logo");
const readyBanner = document.getElementById("ready-banner");
const enemyReadyBanner = document.getElementById("enemy-ready-banner");
let roomId = null;
let playerId = -1;
let interval = null;
let playing = false;
let blocks = [...Array(12)].map(() => Array(9).fill(false))
let blocksLeft = 5,
  row = 11,
  offset = 0,
  direction = 1;

// Some logo microinteraction
const colors = ["#DC2626", "#EA580C", "#D97706", "#CA8A04", "#65A30D", "#16A34A", "#059669", "#0D9488", "#0891B2", "#0284C7", "#2563EB", "#4F46E5", "#7C3AED", "#9333EA", "#C026D3", "#DB2777", "#E11D48"];
logo.style.fill = colors[Math.floor(Math.random() * colors.length)];
logo.addEventListener("click", (e) => {
  e.target.style.fill = colors[Math.floor(Math.random() * colors.length)]
})


// Function sets up state for when you join a room.
function roomJoin(room, player) {
  readyBanner.style.display = "none";
  enemyReadyBanner.style.display = "none";
  resetState()
  roomId = room;
  createRoom.disabled = true;
  joinRoomInput.disabled = true;
  joinRoom.innerHTML = "Exit";
  joinRoomInput.value = roomId;
  document.getElementById("enemy").style.display = "block";
  playerId = player;
}

joinRoomInput.value = "";

// Creating a room involves sending a createRoom message
// to the server, along with updating the play button
// for waiting for opponent. When the opponent joins,
// playerJoined event is catched and executes some code
createRoom.addEventListener("click", () => {
  socket.emit("createRoom", (roomId) => {
    roomJoin(roomId, 0);
    joinRoomInput.value = roomId;
    playBtn.disabled = true;
    playBtn.innerHTML = "Waiting for opponent...";
    status.innerHTML = ""
  });
});


// When you press the join room button. The client sends
// some info about the client along with readying the button.
// The button transforms into a exit button after joining a room
// so the else block handles that.
joinRoom.addEventListener("click", () => {
  if (!roomId) {
    socket.emit("joinRoom", joinRoomInput.value, (roomId) => {
      roomJoin(roomId, 1);
      playBtn.innerHTML = "Ready";
      status.innerHTML = ""
    })
  } else {
    socket.emit('leave');
    roomId = null;
    createRoom.disabled = false;
    joinRoomInput.disabled = false;
    joinRoom.innerHTML = "Join"
    joinRoomInput.value = "";
    document.getElementById("enemy").style.display = "none";
    playerId = null;
    playBtn.disabled = false;
    playBtn.innerHTML = "Play";
    resetState()
    readyBanner.style.display = "none";
    enemyReadyBanner.style.display = "none";
  }
})


// When a player leaves, a leave message is sent to all clients
// so when a client recieves one, they know the opponent left.
// In this case we set the playerId to 0, and tell the server that
// we have recieved the leave packet and we are player 0.
// Then we update the playBtn to waiting for opponent.
socket.on('leave', () => {
  playerId = 0;
  socket.emit('ackLeave');
  resetState();
  playBtn.disabled = true;
  playBtn.innerHTML = "Waiting for opponent...";
  readyBanner.style.display = "none";
  enemyReadyBanner.style.display = "none";
})


// When a player joins, this changes the innerHTML to ready
socket.on("playerJoined", () => {
  playBtn.disabled = false;
  playBtn.innerHTML = "Ready"
})

// Once both players are ready, the server sends a startGame
// message, which then starts a 3 second countdown before
// starting the game.
socket.on("startGame", () => {
  readyBanner.innerHTML = 3;
  enemyReadyBanner.innerHTML = 3;
  for (let i = 0; i < 2; i++) {
    setTimeout(() => {
      readyBanner.innerHTML = 2 - i;
      enemyReadyBanner.innerHTML = 2 - i;
    }, (i + 1) * 1000)
  }

  setTimeout(() => {
    readyBanner.innerHTML = "Ready";
    enemyReadyBanner.innerHTML = "Ready";
    readyBanner.style.display = "none";
    enemyReadyBanner.style.display = "none";
    startGame()
  }, 3000)
})

// The other client will send their game state over 10 times a second.
socket.on("gameUpdate", (enemyBlocks) => {
  for (const y in enemyBlocks) {
    for (const x in enemyBlocks[y]) {
      if (enemyBlocks[y][x]) enemyBlockElements[y][x].style.backgroundColor = "#262626";
      else enemyBlockElements[y][x].style.backgroundColor = "white";
    }
  }
})

// Whenever a player wins, or both players lose, the score message
// is sent, and depending on the player, will display a message to
// the player.
socket.on("score", player => {
  resetState();
  if (player == -1) {
    status.innerHTML = "Tie!"
  } else if (player == playerId) {
    status.innerHTML = "You win!"
  } else {
    status.innerHTML = "You lose."
  }
})


// Resets state to default paramaters
function resetState() {
  blocksLeft = 5;
  row = 11;
  playing = false;
  offset = 0;
  clearInterval(interval);
  playBtn.disabled = playing;
  status.innerHTML = ""
}

// The start game function. Starts an interval for 60 times
// a second, which calls the game loop function along with
// setting playing to true and resetting blocks state.
function startGame() {
  playing = true;
  interval = setInterval(() => gameLoop(blocks), 16.6666667);
  playBtn.disabled = playing;
  blocks = [...Array(12)].map(() => Array(9).fill(false));
  status.innerHTML = ""
}

// The play button will send a ready packet if the player
// is connected to a room, and otherwise will start the
// game if in singleplayer mode.
playBtn.addEventListener("click", () => {
  if (roomId) {
    socket.emit("ready", (result) => {
      if (result) playBtn.disabled = true
    });
  } else {
    startGame();
  }
})

// When a player readies, show the ready banner
socket.on("playerReadied", (id) => {
  if (id == playerId) {
    readyBanner.style.display = "block";
    readyBanner.animate(
      [ 
        { clipPath: "polygon(0 50%, 100% 50%, 100% 50%, 0 50%)" },
        { clipPath: "polygon(0 0, 100% 0, 100% 100%, 0% 100%)" }
      ],
      {
        duration: 300,
        easing: "cubic-bezier(0.5, 1, 0.89, 1)"
      }
    )
  } else {
    enemyReadyBanner.style.display = "block";
    enemyReadyBanner.animate(
      [ 
        { clipPath: "polygon(0 50%, 100% 50%, 100% 50%, 0 50%)" },
        { clipPath: "polygon(0 0, 100% 0, 100% 100%, 0% 100%)" }
      ],
      {
        duration: 300,
        easing: "cubic-bezier(0.5, 1, 0.89, 1)"
      }
    )
  }
})

function handleClick() {
  if (!playing) return;
  // Animate the blocks with a little downwards thrust
  // to give clicking some more impact.
  document.querySelector("#you .blocks").animate(
    [
      { transform: 'translateY(0)' },
      { transform: 'translateY(0.5rem)'},
      { transform: 'translateY(0)' },
    ],
    {
      duration: 200,
      easing: "cubic-bezier(0.5, 1, 0.89, 1)"
    }
  )
  // This part determines which blocks need to be pruned
  // because they went over the tower.
  let count = 0;
  for (let x = offset; x < offset + blocksLeft; x++) {
    if (row == 11 || blocks[row + 1][x]) {
      blocks[row][x] = true;
      count++;
    }
  }

  // To make the game more intresting, the number of blocks
  // you get shrinks as the tower grows.
  if (row < 3) {
    count = Math.min(count, 1);
  } else if (row < 5) {
    count = Math.min(count, 2);
  } else if (row < 8) {
    count = Math.min(count, 3);
  } else if (row < 10) {
    count = Math.min(count, 4);
  }
  
  blocksLeft = count;
  
  // Pick a random direction to start the next row moving from.
  if (Math.random() > 0.5) {
      offset = 0;
      direction = 1;
  } else {
      offset = 9 - blocksLeft;
      direction = -1;
  }

  // Decrease (move up) the row by 1
  row--;

  // If there are no blocks left, if connected to a room,
  // send a loss packet along with updating the status
  // otherwise in singleplayer mode, just update the status
  if (blocksLeft == 0) {
    const finalRow = row;
    gameLoop()
    resetState()
    if (roomId) {
      socket.emit("loss", finalRow, showOut => {
        if (showOut) status.innerHTML = "You're out! If your opponent scores lower than you, you will still win."
      })
    } else {
      status.innerHTML = "You Lose. Better luck next time :("
    }
  }

  // If you reach the top row and successfully place, win.
  // If you are connected to a room, also emit the win message
  if (row == -1) {
    resetState()
    status.innerHTML = "You win!"
    if (roomId) {
      socket.emit('win')
    }
  }
}

// Clicking or pressing space will handle the click.
document.querySelector("#you .blocks").addEventListener("click", handleClick)
document.addEventListener("keydown", (e) => { if (e.key == " ") { handleClick() }})

let frameCycle = 0;
// The main game loop, runs 60 times a second
function gameLoop(blocks) {
  for (const y in blocks) {
    for (const x in blocks[y]) {
      if (blocks[y][x]) blockElements[y][x].style.backgroundColor = "#262626";
      else blockElements[y][x].style.backgroundColor = "white";
    }
  }

  if (frameCycle < 6) {
    frameCycle++;
  } else {
    offset += direction;
    frameCycle = 0;
    if (roomId) {
      const visualState = structuredClone(blocks);
      for (let x = offset; x < offset + blocksLeft; x++) {
        visualState[row][x] = true;
      }
      socket.emit("gameUpdate", visualState)
    }
  }
  if (offset <= 0) {
    direction = 1;
  }
  if (offset + blocksLeft > 8) {
    direction = -1;
  }

  for (let x = offset; x < offset + blocksLeft; x++) {
    blockElements[row][x].style.backgroundColor = "#262626";
  }
}
