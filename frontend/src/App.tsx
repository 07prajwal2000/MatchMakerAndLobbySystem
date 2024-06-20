import axios from "axios";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const clientSock = io("http://localhost:3000", {
	autoConnect: false,
});

type MatchSearchStatus = "NOT STARTED" | "FINDING" | "FOUND" | "EXITING";

function App() {
	const [connected, setConnected] = useState(false);
	const [matchStatus, setMatchSearchStatus] =
		useState<MatchSearchStatus>("NOT STARTED");

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
			alert("Invalid token");
		});
    
		clientSock.on("exit-successful", () => {
			setMatchSearchStatus('NOT STARTED');
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
		setMatchSearchStatus("FINDING");
		const response = await axios.get(
			"http://localhost:3000/generate-token"
		);
		const token = response.data.token as string;
		console.log("Token:", token);

		clientSock.emit("wait-match", token);
	}

  async function onExitMatchClicked() {
    setMatchSearchStatus('EXITING');
    clientSock.emit('exit-match');
  }

  async function onStopFindMatchClicked() {
    setMatchSearchStatus('NOT STARTED');
    clientSock.emit('cancel-match-search');
  }

	return (
		<div>
			<h4>Connected: {connected.toString()}</h4>
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
				<button
					className="btn btn-danger"
					onClick={onExitMatchClicked}
				>
					Exit from match
				</button>
			)}
			{matchStatus == "FOUND" && <h2>Match Found</h2>}
		</div>
	);
}

export default App;
