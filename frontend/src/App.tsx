import axios, { AxiosError, isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const PORT = 8000;

const clientSock = io(`http://localhost:${PORT}`, {
	autoConnect: false,
	timeout: 8_000,
	transports: ["websocket"],
});

type MatchSearchStatus = "NOT STARTED" | "FINDING" | "FOUND" | "EXITING";

function App() {
	const [connected, setConnected] = useState(false);
	const [matchStatus, setMatchSearchStatus] =
		useState<MatchSearchStatus>("NOT STARTED");
	const disableFields = matchStatus != "FINDING" && !connected;
	const [region, setRegion] = useState("AS");
	const [skill, setSkill] = useState("1-2");
	const [matchType, setMatchType] = useState("4P-R-TANK");

	useEffect(() => {
		clientSock.on("connect", () => {
			console.log("ID: ", clientSock.id);
			setConnected(true);
		});
		clientSock.on("disconnect", () => {
			console.log("ID: ", clientSock.id);
			setConnected(false);
			setMatchSearchStatus("NOT STARTED");
		});

		clientSock.on("invalid-match-token", () => {
			setMatchSearchStatus("NOT STARTED");
		});

		clientSock.on("in-matching", () => {
			alert("Already Finding a match");
			setMatchSearchStatus("NOT STARTED");
		});

		clientSock.on("exit-successful", () => {
			setMatchSearchStatus("NOT STARTED");
		});

		clientSock.on("match-found", (matchToken) => {
			console.log("Found match. Token:", matchToken);
			setMatchSearchStatus("FOUND");
		});
	}, []);

	function connectToServer() {
		clientSock.connect();
	}

	function disconnectFromServer() {
		clientSock.disconnect();
	}

	async function onFindMatchBtnClicked() {
		try {
			setMatchSearchStatus("FINDING");
			const response = await axios.post(
				`http://localhost:${PORT}/generate-token`,
				{
					region,
					skillRange: skill,
					matchType,
				}
			);
			const token = response.data.token as string;
			clientSock.emit("wait-match", token);
		} catch (error: AxiosError | any) {
			console.error(
				isAxiosError(error) &&
					"Error message: " + error.response?.data.message
			);
			setMatchSearchStatus("NOT STARTED");
		}
	}

	async function onExitMatchClicked() {
		setMatchSearchStatus("EXITING");
		clientSock.emit("exit-match");
	}

	async function onStopFindMatchClicked() {
		setMatchSearchStatus("NOT STARTED");
		clientSock.emit("cancel-match-search");
	}

	return (
		<div>
			<h4>Connected: {connected.toString()}</h4>

			<div className="ms-4 my-4 d-flex flex-column gap-3 position-relative w-25">
				{disableFields && (
					<div className="position-absolute w-100 h-100 bg-black opacity-50"></div>
				)}
				<h2>Details:</h2>
				<label htmlFor="region" className="form-label">
					Select Region
					<select
						name="region"
						className="form-select w-auto"
						id="region"
						disabled={disableFields}
						onChange={(e) => setRegion(e.target.value)}
						value={region}
					>
						<option value="AS">Asia</option>
						<option value="EU">Europe</option>
						<option value="AU">Australia</option>
						<option value="US">North America</option>
						<option value="AF">Africa</option>
					</select>
				</label>
				<label htmlFor="skill" className="form-label">
					Select skill
					<select
						name="skill"
						id="skill"
						className="form-select w-auto"
						disabled={disableFields}
						onChange={(e) => setSkill(e.target.value)}
						value={skill}
					>
						<option value="0-2">0-2</option>
						<option value="3-5">3-5</option>
						<option value="6-8">6-8</option>
						<option value="9-10">9-10</option>
					</select>
				</label>

				<label htmlFor="match-type" className="form-label">
					Match Type
					<select
						name="match-type"
						id="match-type"
						className="form-select w-auto"
						disabled={disableFields}
						onChange={(e) => setMatchType(e.target.value)}
						value={matchType}
					>
						<option value="4P-R-TANK">Ranked Tank</option>
						<option value="4P-R-DUST">Ranked Dust</option>
						<option value="4P-R-TOON">Ranked Toon</option>
						<option value="4P-UR-TANK">Unranked Tank</option>
						<option value="4P-UR-DUST">Unranked Dust</option>
						<option value="4P-UR-TOON">Unranked Toon</option>
					</select>
				</label>
			</div>

			{connected && <h3>User ID: {clientSock.id}</h3>}
			<button
				className="btn btn-primary"
				disabled={connected}
				onClick={connectToServer}
			>
				Connect
			</button>
			<button
				className="btn btn-danger"
				disabled={!connected}
				onClick={disconnectFromServer}
			>
				Disconnect
			</button>
			<button
				className="btn btn-info"
				disabled={matchStatus != "NOT STARTED" || !connected}
				onClick={onFindMatchBtnClicked}
			>
				Find a match
			</button>
			{matchStatus == "FINDING" && (
				<div className="">
					<h2>Searching for match. Will be back soon</h2>
					<div className="spinner-border"></div>
				</div>
			)}
			{matchStatus == "FINDING" && (
				<button
					className="btn btn-danger"
					onClick={onStopFindMatchClicked}
				>
					Cancel Match Search
				</button>
			)}
			{matchStatus == "FOUND" && (
				<button className="btn btn-danger" onClick={onExitMatchClicked}>
					Exit from match
				</button>
			)}
			{matchStatus == "FOUND" && <h2>Match Found</h2>}
		</div>
	);
}

export default App;
