import { Socket } from "socket.io";
import { validateToken } from "../lib/token";
import { redis } from "../lib/redis";

const waitingusers: { [userId: number]: (matchToken: string) => void } = {};
const queueName = `WAITING-QUEUE-1`;
const queueSetName = `WAITING-QUEUE-1-SET`;
const maxPlayersInMatch = 3;
let initialized = false;

export function initMatchmaker() {
	if (initialized) {
		console.error("Match maker is already initialized");
		return;
	}

	initialized = true;
	setInterval(async () => {
		const length = await redis.llen(queueName);
		if (length < maxPlayersInMatch) return;

		console.log("Total players in queue:", length);

		for (let i = 0; i < length; i += maxPlayersInMatch) {
      const users = await redis.lrange(queueName, 0, maxPlayersInMatch);

      const matchToken = generateMatchToken();
      const transaction = redis.multi().srem(queueSetName, users);

      for (let id of users) {
        const userId = parseInt(id);
        waitingusers[userId] && waitingusers[userId](matchToken);
        delete waitingusers[userId];
        const matchKey = `IN_MATCH-${id}`;
        transaction.lrem(queueName, 1, id);
        transaction.set(matchKey, matchToken);
        transaction.expire(matchKey, 70);
      }
      await transaction
      .lpush(matchToken, ...users)
      .expire(matchToken, 60)
      .exec();
    }
	}, 5 * 1000);
}

export function onClientConnect(socket: Socket) {
	let userId = 0;
	socket.on("wait-match", async (matchToken: string) => {
		const token = validateToken(matchToken);
		if (!token.valid) {
			socket.emit("invalid-match-token");
			return;
		}
		userId = token.tokenData.userId as number;
		waitingusers[userId] = (matchToken: string) => {
			socket.emit("match-found", matchToken);
		};
		await addUserToWaitQueue(userId);
    socket.on('exit-match', async () => {
      const roomID = await redis.get('IN_MATCH-' + userId);
      const tranx = redis.multi();
      if (roomID) {
        tranx.lrem(roomID, 1, userId);
      }
      await tranx
        .del('IN_MATCH-' + userId)
        .lrem(queueName, 1, userId)
        .srem(queueSetName, userId)
        .exec();
      socket.emit('exit-successful');
    });

    socket.on('cancel-match-search', async () => {
      await redis
        .multi()
        .lrem(queueName, 1, userId)
        .srem(queueSetName, userId)
        .exec();
    });
	});

	socket.on("disconnect", async () => {
		delete waitingusers[userId];
		await redis
			.multi()
			.del(`IN_MATCH-${userId}`)
			.lrem(queueName, 1, userId)
			.srem(queueSetName, userId)
			.exec();
	});
}

async function addUserToWaitQueue(userId: number): Promise<boolean> {
	if (
		(await redis.sismember(queueSetName, userId)) ||
		(await redis.get(`IN_MATCH-${userId}`))
	) {
		return false;
	}
	await redis
		.multi()
		.rpush(queueName, userId)
		.sadd(queueSetName, userId)
		.exec();
	return true;
}

function generateMatchToken() {
	return "Match-Token-1";
}
