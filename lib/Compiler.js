"use strict";

const Git = require("nodegit");
const path = require("path");
const fs = require("fs");
const remove = require("remove");
const sass = require("node-sass");
const secrets = require("../secrets.json");
const Snoowrap = require("snoowrap");
const uglifyCSS = require("uglifycss");

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
						let cssBody = "/**\n" +
						`* Stylesheet for r/${secrets.subredditName} generated at ${new Date().toLocaleString()}.\n` +
						"* DO NOT MAKE CHANGES TO THIS STYLESHEET; THEY WILL BE OVERRIDDEN.\n" +
						"* Make your changes in the repository (ask the mods for access).\n" +
						"*/\n\n";

						// Remove charset directive, reddit doesn't like it.
						cssBody += uglifyCSS.processString(result.css.toString().replace(/@charset "[\S]+";/gi, ""));

						fs.writeFileSync(path.join(repoDir, "subreddit.css"), cssBody);

						// Update reddit
						const reddit = new Snoowrap({
							userAgent: "subreddit-css-listener",
							clientId: secrets.reddit.clientId,
							clientSecret: secrets.reddit.clientSecret,
							refreshToken: secrets.reddit.refreshToken
						});

						const subreddit = reddit.getSubreddit(secrets.subredditName);
						
						console.log(`[subreddit-css-listener] Updating r/${subreddit.display_name}...`);
						
						subreddit.updateStylesheet({
							css: cssBody,
							reason: message
						}).then(() => {
							const assetDirectory = path.join(repoDir, secrets.assetFolder);
							const assetPromises = fs.readdirSync(assetDirectory).map(file => subreddit.uploadStylesheetImage({
								name: path.basename(file, path.extname(file)),
								file: path.join(assetDirectory, file),
								imageType: path.extname(file) === "png" ? "png" : "jpg"
							}));
							
							Promise.all(assetPromises).then(resolve).catch(console.error);
						}).catch(error => {
							reddit.composeMessage({
								to: subreddit,
								subject: "Failed to upload new stylesheet.",
								text: `An error occured uploading the stylesheet for /r/${secrets.subredditName}:\n\n${error}`
							}).then(() => {
								console.log(`[subreddit-css-listener] Invalid stylesheet uploaded; modmail sent to /r/${secrets.subredditName}.`);
								reject();
							}).catch(modmailError => {
								console.log("[subreddit-css-listener] Stylesheet upload error:");
								console.log(error);
								console.log("[subreddit-css-listener] Unable to send modmail.");
								reject(modmailError);
							});
						});
					}
				});
			}).catch(console.error);
		});
	}
};