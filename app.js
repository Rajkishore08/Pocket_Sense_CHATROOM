const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 8282;

app.use(express.static(path.join(__dirname, 'public')));

const users = new Map();
const chatRooms = new Map();

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  socket.on('new user', (data, callback) => {
    console.log('New user attempt:', data.username);
    if (users.has(data.username)) {
      callback({ success: false });
    } else {
      callback({ success: true });
      socket.username = data.username;
      users.set(data.username, socket);
      updateOnlineUsers();
      socket.join('general');
      chatRooms.set('general', (chatRooms.get('general') || []).concat(socket.username));
      updateRoomUsers('general');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.username);
    if (socket.username) {
      users.delete(socket.username);
      updateOnlineUsers();
      for (const [room, users] of chatRooms.entries()) {
        const index = users.indexOf(socket.username);
        if (index !== -1) {
          users.splice(index, 1);
          updateRoomUsers(room);
        }
      }
    }
  });

  socket.on('chat message', (msg) => {
    console.log('Message received:', msg);
    io.to(msg.room).emit('chat message', {
      username: socket.username,
      message: msg.message,
      room: msg.room
    });
  });

  socket.on('typing', (room) => {
    socket.to(room).emit('typing', { username: socket.username, room });
  });

  socket.on('stop typing', (room) => {
    socket.to(room).emit('stop typing', { username: socket.username, room });
  });

  socket.on('join room', (room) => {
    console.log(`${socket.username} joining room:`, room);
    socket.join(room);
    chatRooms.set(room, (chatRooms.get(room) || []).concat(socket.username));
    updateRoomUsers(room);
  });

  socket.on('leave room', (room) => {
    console.log(`${socket.username} leaving room:`, room);
    socket.leave(room);
    const users = chatRooms.get(room) || [];
    const index = users.indexOf(socket.username);
    if (index !== -1) {
      users.splice(index, 1);
      chatRooms.set(room, users);
      updateRoomUsers(room);
    }
  });
});

function updateOnlineUsers() {
  const userList = Array.from(users.keys());
  console.log('Updating online users:', userList);
  io.emit('online users', userList);
}

function updateRoomUsers(room) {
  const roomUsers = chatRooms.get(room) || [];
  console.log(`Updating users for room ${room}:`, roomUsers);
  io.to(room).emit('room users', { room, users: roomUsers });
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
