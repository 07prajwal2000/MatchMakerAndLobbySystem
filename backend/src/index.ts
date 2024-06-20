import express from "express";
import "dotenv/config";
import tokenRouter from "./routes/token";
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import { initMatchmaker, onClientConnect } from "./routes/matchmaker";
import { initRedis } from "./lib/redis";

async function main() {
  await initRedis();
  await initMatchmaker();
  const PORT = process.env.PORT ?? 3000;
  const app = express();

  const server = createServer(app);
  const socketio = new Server(server, {
    cors: {
      origin: 'http://localhost:5173',
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
  });

  socketio.on('connection', onClientConnect);
  
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    next();
  });
  app.use(tokenRouter);

  server.listen(PORT, () => console.log(`Server listening in http://localhost:${PORT}`));
}

main();