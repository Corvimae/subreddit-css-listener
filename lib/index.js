const http = require("http");
const webhookHandler = require("github-webhook-handler");
const Compiler = require("./Compiler");
const secrets = require("../secrets.json");

const handler = webhookHandler({
	path: "/webhook",
	secret: secrets.webhook
});

http.createServer((req, res) => {
	handler(req, res, err => {
		res.statusCode = 404;
		res.end("No such location.");
	});

}).listen(7777);

console.log("[subreddit-css-listener] Started on port 7777.");

handler.on("error", err => {
	console.log("[subreddit-css-listener] An error occurred:", err);
});

handler.on("push", event => {
	console.log("Push event recieved!");
	console.log(event);
	console.log(event.payload);

	let shouldUpdate = false;

	event.commits.forEach(commit => {
		if(commit.added.some(x => x.endsWith(".css")) || commit.removed.some(x => x.endsWith(".css")) || commit.modified.some(x => x.endsWith(".css"))) {
			shouldUpdate = true;
		}
	});

	if(shouldUpdate) {
		Compiler.recompile(event.repository.ssh_url);
	}
});

Compiler.recompile(secrets.repository);