import fs from "fs";
import path from "path";

export const onPreBuild = function ({ inputs }) {
	if (process.env.NETLIFY) {
		console.log("Running replace plugin");
		// Replace the string in the file
		const filePath = path.resolve(inputs.replace_path);
		const fileContent = fs.readFileSync(filePath, "utf8");
		const newContent = fileContent.replace(
			inputs.replace_string,
			process.env[inputs.env_replace_with]
		);
		fs.writeFileSync(filePath, newContent, "utf8");
	} else {
		console.log("Not on Netlify, skipping replace plugin");
	}
};
