import crypto from "crypto";
import { Socket } from "socket.io";
import { validateToken } from "../lib/token";
import {
	AckPolicy,
	Consumer,
	JetStreamClient,
	JetStreamManager,
	NatsConnection,
	StringCodec,
	connect,
} from "nats";
import Redis from "ioredis";

const natsUrl = process.env.NATS_URL || "localhost:4222";
const redisUrl = `${process.env.REDIS_HOST || 'localhost'}`;
const redisPort = parseInt(process.env.REDIS_PORT || "6379");
console.log("Redis URL: Port", redisUrl, ":", redisPort);
const waitingusers: { [userId: number]: (matchDetails: any) => void } = {};
let initialized = false;
let natsClient: NatsConnection = null!;
let jetstream: JetStreamClient = null!;
const redis = new Redis(redisPort, redisUrl);
const instanceId = crypto.randomUUID().substring(0, 15).replaceAll("-", "");
const abortSignal = new AbortController();
const consumers: Consumer[] = [];
const stringCodec = StringCodec();
const streamName = "match-maker-pub";

process.on("SIGTERM", abortSignal.abort);
process.on("SIGINT", abortSignal.abort);
process.on("SIGQUIT", abortSignal.abort);

abortSignal.signal.addEventListener(
	"abort",
	async () => {
		console.log("Server stopped");
		for (const c of consumers) {
			c.delete();
		}
		await natsClient.drain();
		await natsClient.close();
	},
	{ once: true }
);

export async function initMatchmaker() {
	if (initialized) {
		console.error("Match maker is already initialized");
		return;
	}
	console.log("Match maker started. Instance ID:", instanceId);
	await redis.ping();
	natsClient = await connect({ servers: [natsUrl] });
	jetstream = natsClient.jetstream();
	const manager = await jetstream.jetstreamManager();

	// await manager.streams.delete(streamName); // remove stream

	await manager.streams.add({
		name: streamName,
		description: "Match-maker publisher",
		subjects: ["match-maker.waiting-queue.>", "match-maker.match-found.>"], // wildcard (>) -> add, delete. 2nd subject = (>) instance id
	});
	await initMatchMakerConsumer(manager);
	initialized = true;
}

async function initMatchMakerConsumer(manager: JetStreamManager) {
	const consumerName = `matchfound_receiver_${instanceId}`;
	await manager.consumers.add(streamName, {
		ack_policy: AckPolicy.Explicit,
		durable_name: consumerName,
		filter_subject: `match-maker.match-found.${instanceId}`,
	});
	const consumer = await jetstream.consumers.get(streamName, consumerName);
	processMatchMakerMessages(consumer);
}

async function processMatchMakerMessages(stream: Consumer) {
	consumers.push(stream);
	while (!abortSignal.signal.aborted) {
		const msg = await stream.next();
		if (!msg) {
			continue;
		}
		const data = JSON.parse(msg.string());
		const userId = data.userId;
		const matchDetails = data.matchDetails;
		userId in waitingusers && (waitingusers[userId](matchDetails));
		msg.ack();
	}
}

export function onClientConnect(socket: Socket) {
	let validToken = false;
	let userId = 0;

	socket.on("wait-match", async (matchToken: string) => {
		const token = validateToken(matchToken);
		if (!token.valid) {
			socket.emit("invalid-match-token");
			return;
		}

		validToken = true;
		userId = token.tokenData.userId as number;
		const matchKey = token.tokenData.matchKey as string;

		const userStatusJson = await redis.get(`STATUS_${userId}`);
		const userStatus = JSON.parse(userStatusJson ?? "{}");
		if (
			userStatus &&
			userStatus.status &&
			userStatus.status == "MATCHING"
		) {
			socket.emit("in-matching");
			return;
		}

		await addUserToWaitQueue(userId, matchKey);

		waitingusers[userId] = (matchDetails: any) => {
			socket.emit("match-found", matchDetails);
			delete waitingusers[userId];
		};
	});

	socket.on("exit-match", async () => {
		socket.emit("exit-successful");
	});

	socket.on("cancel-match-search", async () => {
		if (!userId) return;
		await removeUserFromMatch(userId);
	});

	socket.on("disconnect", async () => {
		await cleanupUserDataAfterDisconnect(userId);
		delete waitingusers[userId];
	});
}

async function cleanupUserDataAfterDisconnect(userId: number) {
	const userStatus = await redis.get(`STATUS_${userId}`);
	if (!userStatus) return;
	const userData = JSON.parse(userStatus);
	if (userData.status != "MATCHING") return;
	await redis
		.multi()
		.lrem(userData.bucketKey, 1, userId)
		.del(`STATUS_${userId}`)
		.exec();
}

async function removeUserFromMatch(id: number) {
	await jetstream.publish(
		"match-maker.waiting-queue.delete",
		stringCodec.encode(id.toString())
	);
}

async function addUserToWaitQueue(
	userId: number,
	matchKey: string
): Promise<boolean> {
	const payload = stringCodec.encode(
		JSON.stringify({ userId, matchKey, instanceId })
	);
	await jetstream.publish("match-maker.waiting-queue.add", payload);
	return true;
}
