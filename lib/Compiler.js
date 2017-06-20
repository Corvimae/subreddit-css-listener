"use strict";

const Git = require("nodegit");
const path = require("path");
const fs = require("fs");
const remove = require("remove");
const sass = require("node-sass");
const secrets = require("../secrets.json");
const Snoowrap = require("snoowrap");

module.exports = class Compiler {
	static recompile(https_url, message) {
		return new Promise((resolve, reject) => {
			const repoDir = path.join(__dirname, "..", "repo");
					
			if(fs.existsSync(repoDir)) {
				remove.removeSync(repoDir);
			}

			const gitOptions = {
				fetchOpts: {
					callbacks: {
						certificateCheck: () => 1,
						credentials: function() {
							return Git.Cred.userpassPlaintextNew(secrets.githubToken, "x-oauth-basic");
						}
					}
				}
			};

			Git.Clone.clone(https_url, repoDir, gitOptions).then(repo => {
				sass.render({
					file: path.join(repoDir, secrets.sassFile),
					outputStyle: "expanded"
				}, (err, result) => {
					if(err) {
						console.error("[subreddit-css-listener] Invalid SASS file(s)!");
						reject(err);
					} else {
						const cssBody = "/**\n" +
						`* Stylesheet for r/${secrets.subredditName} generated at ${new Date().toLocaleString()}.\n` +
						"* DO NOT MAKE CHANGES TO THIS STYLESHEET; THEY WILL BE OVERRIDDEN.\n" +
						"* Make your changes in the repository:\n" +
						`* ${https_url}\n` +
						`*/\n${result.css.toString()}`;

						fs.writeFileSync(path.join(repoDir, "subreddit.css"), cssBody);

						// Update reddit
						const reddit = new Snoowrap({
							userAgent: "subreddit-css-listener",
							clientId: secrets.reddit.clientId,
							clientSecret: secrets.reddit.clientSecret,
							refreshToken: secrets.reddit.refreshToken
						});

						const subreddit = reddit.getSubreddit(secrets.subredditName);
						
						console.log(`Updating r/${subreddit.display_name}...`);
						
						reddit.getSubreddit(secrets.subredditName).updateStylesheet({
							css: cssBody,
							reason: message
						}).then(resolve);
					}
				});
			}).catch(console.error);
		});
	}
};