import { Redis } from "ioredis";
import {
	AckPolicy,
	Consumer,
	JetStreamClient,
	NatsConnection,
	StringCodec,
	connect,
} from "nats";
import { RedisLock } from "./lib/RedisLock";

const redis = new Redis();
let natsClient: NatsConnection = null!;
const abortSignal = new AbortController();
let jetstream: JetStreamClient = null!;
const stringCodec = StringCodec();
const locks: { [key: string]: RedisLock } = {};

process.on("SIGTERM", abortSignal.abort);
process.on("SIGINT", abortSignal.abort);
process.on("SIGQUIT", abortSignal.abort);

abortSignal.signal.addEventListener(
	"abort",
	async () => {
		console.log("Server stopped");
		await natsClient.drain();
		await natsClient.close();
	},
	{ once: true }
);

(async () => {
	natsClient = await connect({ servers: ["localhost:4222"] });
	jetstream = natsClient.jetstream();
	const manager = await jetstream.jetstreamManager();
	console.log("Match maker queue server started");

	const consumerName = "matchmaker_add";

	const info = await manager.consumers.add("match-maker-pub", {
		ack_policy: AckPolicy.Explicit,
		durable_name: consumerName,
		filter_subject: "match-maker.waiting-queue.add",
	});
	const consumer = await jetstream.consumers.get(
		"match-maker-pub",
		info.name
	);

	startConsumerAdd(consumer);

	const deleteConsumerName = "matchmaker_delete";
	const deleteConsumerInfo = await manager.consumers.add("match-maker-pub", {
		ack_policy: AckPolicy.Explicit,
		durable_name: deleteConsumerName,
		filter_subject: "match-maker.waiting-queue.delete",
	});
	const deleteConsumer = await jetstream.consumers.get(
		"match-maker-pub",
		deleteConsumerInfo.name
	);
	startConsumerDelete(deleteConsumer);
})();

type UserData = {
	userId: number;
	matchKey: string;
	instanceId: string;
};

async function startConsumerAdd(stream: Consumer) {
	while (!abortSignal.signal.aborted) {
		const msg = await stream.next();
		if (!msg) continue;
		const jsonData = JSON.parse(msg.string()) as UserData;
		await addUserToQueue(jsonData);
		msg.ack();
	}
}

async function addUserToQueue(data: UserData) {
	const redlock = getLock(data.matchKey);

	let locked = await redlock.lock();
	while (locked && !abortSignal.signal.aborted) {
		await wait(500);
		locked = await redlock.lock();
	}

	const counterKey = `${data.matchKey}_COUNT`;
	let counterIdx = parseInt((await redis.get(counterKey)) || "0");
	let key = `${data.matchKey}_${counterIdx}`;
	await redis
  .pipeline()
  .lpush(key, data.userId)
  .set(
    `STATUS_${data.userId}`,
    JSON.stringify({
      status: "MATCHING",
      instanceId: data.instanceId,
      matchKey: data.matchKey,
      bucketKey: key,
      userId: data.userId,
    }))
    .exec();
    const length = await redis.llen(key);
    if (length >= 4) {
      await redis.incr(counterKey);
      await createAndGenerateMatchToken(key);
    }

	await redlock.release();
}

async function createAndGenerateMatchToken(bucketKey: string) {
	console.log("New match", bucketKey);
	const players = await redis.lrange(bucketKey, 0, 4);
	const pipeline = redis.pipeline();
	for (const id of players) {
		pipeline.get(`STATUS_${id}`);
	}
	const results = await pipeline.exec();
	const tranx = redis.multi();
	for (const result of results!) {
		const userData = JSON.parse(result[1] as string);
		userData.status = "MATCHED";
		tranx.set(`STATUS_${userData.userId}`, JSON.stringify(userData));

		await publishMatchFoundMessage(userData.instanceId, userData.userId, {
			message:
				"GAME DETAILS (Server IP/Host, secret token etc. is stored)",
		});

	}
	tranx.set(
		`${bucketKey}_MATCH`,
		"GAME DETAILS (Server IP/Host, secret token etc. is stored)"
	);
	await tranx.exec();
}

async function publishMatchFoundMessage(
	instanceId: string,
	userId: string,
	matchDetails: any
) {
  const data = stringCodec.encode(JSON.stringify({
    userId,
    matchDetails
  }));
  await jetstream.publish(`match-maker.match-found.${instanceId}`, data);
}

async function startConsumerDelete(stream: Consumer) {
	while (!abortSignal.signal.aborted) {
		const msg = await stream.next();
		if (!msg) continue;
		const userId = msg.string();
		const userStatusJson = await redis.get(`STATUS_${userId}`);
		const userStatus = JSON.parse(userStatusJson ?? "");
		if (!userStatus && userStatus.status != "MATCHING") {
			return;
		}
		const redlock = getLock(userStatus.matchKey);
		let locked = await redlock.lock();
		while (!locked) {
			await wait(500);
			locked = await redlock.lock();
		}

		await redis
			.pipeline()
			.lrem(userStatus.bucketKey, 1, userId)
			.del(`STATUS_${userId}`)
			.exec();

		await redlock.release();
		msg.ack();
	}
}

async function wait(millis: number) {
	await new Promise((resolve) => setTimeout(resolve, millis));
}

function getLock(key: string) {
	key = key + "_LOCK";
	const redlock = key in locks ? locks[key] : new RedisLock(redis, key);
	!(key in locks) && (locks[key] = redlock);
	return redlock;
}
