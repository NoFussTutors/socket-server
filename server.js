// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
  },
});

const changeTurn = (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      const currentUserIndex = room.users.findIndex((user) => user.id === room.currentTurn);
      const nextUserIndex = (currentUserIndex + 1) % room.users.length;
      room.currentTurn = room.users[nextUserIndex].id;
      io.in(roomId).emit('change-turn', room.currentTurn);
    }
  };

const PORT = process.env.PORT || 3010;

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  socket.on('create-room', ({ username, characterDetails }) => {
    console.log('create-room - characterDetails:', characterDetails);
    const roomName = generateRandomRoomName();
  
    rooms.set(roomName, {
      roomName,
      createdBy: socket.id,
      users: [
        {
          id: socket.id,
          username,
          characterDetails,
        }
      ]
    });
  
    socket.join(roomName);
    socket.emit('room-created', roomName);
  });

  socket.on('join-room', ({ roomId, username, characterDetails }) => {
    console.log('Joining room with characterDetails:', characterDetails);
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const characterDetailsObj = {
        color: characterDetails?.color || '',
        hat: characterDetails?.hat || '',
        eyes: characterDetails?.eyes || '',
      };
      // Create the `users` array here and add the user to it
      room.users = [...room.users, {
        id: socket.id,
        username,
        characterDetails: characterDetailsObj,
      }];

      socket.join(roomId);
      socket.emit('room-joined', roomId);
      io.in(roomId).emit('update-users', room.users.map(user => ({
        id: user.id,
        username: user.username,
        characterDetails: user.characterDetails,
      }))); // Send updated user list to all users in the room
      return; // Add this return statement to prevent the function from continuing
    } else {
      socket.emit('room-not-found');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const [roomId, room] of rooms) {
      const userIndex = room.users.findIndex((user) => user.id === socket.id);
      if (userIndex > -1) {
        room.users.splice(userIndex, 1);
        if (room.users.length === 0) {
          rooms.delete(roomId);
        } else {
          io.in(roomId).emit('update-users', room.users.map(user => ({
            id: user.id,
            username: user.username,
            characterDetails: user.characterDetails,
          }))); // Send updated user list to all remaining users in the room
        }
        break;
      }
    }
  });

  socket.on('game-started', (roomId) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.currentTurn = room.users[0].id; // Set the first user's turn
      io.in(roomId).emit('game-started');
      io.in(roomId).emit('change-turn', room.currentTurn);
    }
  });
  

  socket.on('drawing', ({ roomId, paths }) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (room.currentTurn === socket.id) { // Make sure it's the current user's turn
        socket.broadcast.to(roomId).emit('drawing', paths);
      }
    }
  });

  socket.on('change-turn', (roomId) => {
    changeTurn(roomId);
  });

  // Add a `get-users` event that sends the latest user data to the client
  socket.on('get-users', (roomId) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      socket.emit('update-users', room.users.map(user => ({
        id: user.id,
        username: user.username,
        characterDetails: user.characterDetails,
      })));
    }
  });
});

const generateRandomRoomName = () => {
  const roomNameLength = 6;
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let roomName = '';

  for (let i = 0; i < roomNameLength; i++) {
    roomName += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return roomName;
};

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
