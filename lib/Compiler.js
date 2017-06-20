const github = require("github");
const path = require("path");
const fs = require("fs");

module.exports = class Compiler {
	static recompile(ssh_url) {
		const repoDir = path.join(__dirname, "..", "repo");
		
		console.log(repoDir);
		
		if(fs.existsSync(repoDir)) {
			fs.rmdirSync(repoDir);
		}
	}
};