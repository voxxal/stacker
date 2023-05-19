import express from 'express';
const app = express();
import http from 'http'
import { nanoid } from 'nanoid';
const server = http.createServer(app);
import { Server } from 'socket.io';
// Create a socket.io server, allowing requests from our client,
// and the methods get and post
app.use(express.static('public'))
const io = new Server(server, {
  cors: {
    methods: ["GET", "POST"]
  }
});

const roomsReady = new Map();
const roomsScore = new Map();

io.on('connection', socket => {
  let roomId = null;
  let playerId = null;

  // When a player wants to leave, remove them
  // from the room and set roomId and playerId to
  // null.
  socket.on('leave', () => {
    socket.leave(roomId)
    roomId = null;
    playerId = null;
  })

  // When a client sees opponent leave, set playerId
  // to zero as he is the first player now.
  socket.on('ackLeave', () => {
    playerId = 0;
    roomsReady.set(roomId, [false, false])
  })

  // Create a room with random 4 char id, join the player
  // set the player ready to false and score to 12 12.
  // Then send the roomId back to confirm room was created
  socket.on('createRoom', (callback) => {
    const id = nanoid(4);
    roomId = id;
    playerId = 0;
    socket.join(roomId);
    roomsReady.set(roomId, [false, false])
    roomsScore.set(roomId, [12, 12])
    callback(roomId)
  })

  // If there are less than 2 people, join the room, and
  // broadcast playerJoined.
  socket.on('joinRoom', (id, callback) => {
    const room = io.sockets.adapter.rooms.get(id);
    if(room && room.size < 2) {
      socket.join(id);
      roomId = id;
      playerId = 1;
      callback(id)
      socket.broadcast.to(roomId).emit('playerJoined');
    }
  })

  // If both players are ready, start the game
  socket.on('ready', (callback) => {
    const readyArray = roomsReady.get(roomId);
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room && room.size < 2) return;
    readyArray[playerId] = true;
    io.to(roomId).emit('playerReadied', playerId)
    callback(true)
    if (readyArray.every(x=>x)) {
      io.to(roomId).emit('startGame')
      readyArray[0] = false;
      readyArray[1] = false;
    }
  });

  // Broadcast gamestate to the opponent
  socket.on('gameUpdate', (blocks) => {
    socket.broadcast.to(roomId).emit('gameUpdate', blocks);
  })

  socket.on('win', () => {
    io.in(roomId).emit('score', playerId);
  })

  // If both players lose, check which is less, otherwise
  // store the value and continue.
  socket.on('loss', (row, showOut) => {
    const scores = roomsScore.get(roomId);
    scores[playerId] = row;
    if (scores.every(x => x < 12)) {
      showOut(false);
      if (scores[playerId] < scores[playerId^1]) {
        io.in(roomId).emit('score', playerId);
      } else if (scores[playerId] > scores[playerId^1]) {
        io.in(roomId).emit('score', playerId^1);
      } else {
        io.in(roomId).emit('score', -1)
      }
      scores[0] = 12;
      scores[1] = 12;
    } else {
      showOut(true);
    }
  })
});

// Seperate adapter for leaving room because closing
// tab doesn't get caught by the other leave message.
io.of("/").adapter.on("leave-room", (roomId, id) => {
  io.in(roomId).emit('leave');
  roomsReady.set(roomId, [false, false])
});

// Listen port 3000
server.listen(3000, () => {
  console.log('listening on *:3000');
});
