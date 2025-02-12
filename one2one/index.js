const log4js = require("log4js");
const http = require("http");
const socketIo = require("socket.io");
const express = require("express");

const USERCOUNT = 2;

// Logger configuration
log4js.configure({
  appenders: {
    file: {
      type: "file",
      filename: "app.log",
      layout: {
        type: "pattern",
        pattern: "%r %p - %m",
      },
    },
  },
  categories: {
    default: {
      appenders: ["file"],
      level: "debug",
    },
  },
});

const logger = log4js.getLogger();
const app = express();
app.use(express.static("./public"));
const httpServer = http.createServer(app);
const io = socketIo(httpServer);

// Utility function to get the number of users in a room
function getUserCount(room) {
  const roomInfo = io.sockets.adapter.rooms.get(room);
  return roomInfo ? roomInfo.size : 0;
}

// Handle socket connections
io.on("connection", (socket) => {
  logger.debug(`New connection: socket ID ${socket.id}`);

  // Handle message event
  socket.on("message", (room, data) => {
    logger.debug(`Message received in room "${room}":`, data);
    socket.to(room).emit("message", room, data);
  });

  // Handle join event
  socket.on("join", (room) => {
    socket.join(room);
    const userCount = getUserCount(room);
    logger.debug(`Room "${room}" now has ${userCount} users`);

    if (userCount <= USERCOUNT) {
      // 通知当前用户成功加入了房间
      socket.emit("joined", room, socket.id);
      // 如果房间内已有其他用户（userCount > 1），通知房间内的其他用户有新用户加入
      if (userCount > 1) {
        socket.to(room).emit("otherjoin", room, socket.id);
      }
    } else {
      socket.leave(room);
      socket.emit("full", room, socket.id);
    }
  });

  // Handle leave event
  socket.on("leave", (room) => {
    socket.leave(room);
    const userCount = getUserCount(room);
    logger.debug(`Room "${room}" now has ${userCount} users`);

    // 这个消息将会被发送给 房间内的其他客户端，除了当前发送消息的客户端
    socket.to(room).emit("bye", room, socket.id);
    // 消息将会发送给 当前客户端自己
    socket.emit("leaved", room, socket.id);
  });

  // Handle disconnect event
  socket.on("disconnect", () => {
    logger.debug(`Socket ID ${socket.id} disconnected`);
  });
});

httpServer.listen(7003, "0.0.0.0", () => {
  logger.info("HTTP server listening on port 7003");
});
