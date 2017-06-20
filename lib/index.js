"use strict";

const http = require("http");
const webhookHandler = require("github-webhook-handler");
const Compiler = require("./Compiler");
const secrets = require("../secrets.json");

const handler = webhookHandler({
	path: "/webhook",
	secret: secrets.webhook
});

http.createServer((req, res) => {
	handler(req, res, error => {
		res.statusCode = 404;
		res.end("No such location.");
	});
}).listen(7777);

console.log("[subreddit-css-listener] Started on port 7777.");

handler.on("error", err => {
	console.log("[subreddit-css-listener] An error occurred:", err);
});

handler.on("push", event => {
	console.log("[subreddit-css-listener] Push event received.");

	const pushData = event.payload;

	let shouldUpdate = false;

	const hasRelevantFile = list => {
		return list.some(x => x.endsWith(".scss") || x.endsWith(".css"));
	};

	pushData.commits.forEach(commit => {
		if(hasRelevantFile(commit.added) || hasRelevantFile(commit.removed) || hasRelevantFile(commit.modified)) {
			shouldUpdate = true;
		}
	});
	
	if(shouldUpdate) {
		console.log("[subreddit-css-listener] Recompiling and uploading stylesheet...");

		const commitMessage = pushData.head_commit.message.substring(0, 200);
		const message = `Push from ${pushData.head_commit.author.username} - ${commitMessage} (${pushData.head_commit.id.substring(0, 7)})`;

		Compiler.recompile(pushData.repository.html_url, message).then(() => {
			console.log("[subreddit-css-listener] Update complete.");
		});
	}
});