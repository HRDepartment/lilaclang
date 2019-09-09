import {ast} from './compiler';
import fs = require("fs");

const file = process.argv.slice(2).join(" ") || "testfile.lil";
const input = fs.readFileSync(__dirname + "/" + file, "utf8");
if (!file || !input) {
    console.log("Input required");
    process.exit(1);
}

console.log(JSON.stringify(input));
const tree = ast(input, file);
if (tree.errors.length) {
    process.stdout.write("Errors: \n");
    process.stdout.write(tree.errors.join("\n"));
    process.stdout.write("\n");
}

process.stdout.write("AST:\n");
process.stdout.write(
    JSON.stringify(tree.program, undefined, 4)
);
