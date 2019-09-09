"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("./parser");
const fs = require("fs");
const file = process.argv.slice(2).join(" ") || "testfile.lil";
const input = fs.readFileSync(__dirname + "/" + file, "utf8");
if (!file || !input) {
    console.log("Input required");
    process.exit(1);
}
console.log(JSON.stringify(input));
const ast = new parser_1.Parser().parse(input, file);
if (ast.errors.length) {
    process.stdout.write("Errors: \n");
    process.stdout.write(ast.errors.join("\n"));
    process.stdout.write("\n");
}
process.stdout.write("AST:\n");
process.stdout.write(JSON.stringify(ast.program, undefined, 4));
