"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ast_1 = require("./ast");
class Parser {
    constructor() {
        this.code = "";
        this.file = "";
        this.ast = new ast_1.AST();
        this.pos = 0;
        this.indentLevels = [];
        this.indentLevel = 0;
        this.dedentSpaces = 0;
    }
    current() { return this.code[this.pos]; }
    next() { return this.code[++this.pos]; }
    peek(by = 1) { return this.code[this.pos + by]; }
    reset() {
        this.code = "";
        this.pos = 0;
    }
    parse(code, file = "") {
        this.reset();
        this.code = code;
        this.file = file;
        if (!this.program()) {
            this.expected("an expression");
        }
        return this.ast;
    }
    expect(chr, startpos, msg = "") {
        if (typeof chr === "function" && chr(this.current()) || (this.current() === chr)) {
            this.next();
            return true;
        }
        this.expected(typeof chr === "string" ? chr : msg, startpos);
        return false;
    }
    expected(what, start) {
        const got = this.current() || "<EOF>";
        const posstart = typeof start === "number" ? ` (starting at ${start})` : "";
        this.ast.error(`Expected ${what} at position ${this.pos}${posstart} in file "${this.file}", instead got "${got}"`);
        this.pos = this.code.length;
        return false;
    }
    program() {
        while (!this.finished()) {
            if (!this.pragma() && !this.indentedexpr() && !this.spaces())
                break;
        }
        this.indentLevel = 0;
        this.indentLevels = [];
        return this.ast.programHasNodes();
    }
    expressions(node) {
        const startNodes = node.nodes.length;
        return this.ast.trap(() => {
            while (!this.finished()) {
                if (!this.pragma() && !this.spaces() && !this.expression(node))
                    break;
            }
        }, node).nodes.length > startNodes;
    }
    indentedexpr(startnode) {
        return this.expression(startnode, true);
    }
    expression(startnode, indented = false) {
        if (this.eof() || Parser.isSExprEnd(this.current())) {
            return false;
        }
        const node = startnode || new ast_1.ASTExpression(this.pos);
        let success = false;
        this.ast.trap(() => {
            if (this.atom()) {
                success = true;
                const atom = node.nodes[node.nodes.length - 1];
                if (this.space()) {
                    while (this.spacesUntilNewline(), this.expression(node, indented)) { }
                }
                else if (atom instanceof ast_1.ASTProperty && Parser.isSExprStart(this.current())) {
                    this.ast.trap(() => this.sexpr(), atom);
                }
                if (Parser.isSeparator(this.current())) {
                    if (this.separator()) {
                        this.coalesceAtoms(node);
                    }
                    this.spaces();
                    let hadExpr = false;
                    while (this.expression(node, indented)) {
                        hadExpr = true;
                    }
                    if (hadExpr)
                        this.coalesceAtoms(node);
                }
                else if (indented) {
                    this.indentedblock(node);
                }
            }
        }, node, ast_1.ASTType.Expression);
        if (!success) {
            this.ast.trap(() => {
                success = this.sexpr() || this.block();
            }, node);
        }
        if (success) {
            if (startnode) {
                startnode.combine(node);
            }
            else {
                this.ast.expression(node);
            }
        }
        return success;
    }
    coalesceAtoms(node) {
        let prevExprIndex = node.nodes.length - 1;
        let prevNode;
        for (; prevExprIndex >= 0; prevExprIndex -= 1) {
            const subnode = node.nodes[prevExprIndex];
            if (ast_1.AST.isExpression(subnode)) {
                prevNode = subnode;
                break;
            }
        }
        if (prevExprIndex === node.nodes.length - 1) {
            return;
        }
        if (!prevNode)
            prevNode = node.nodes[0];
        const holder = new ast_1.ASTExpression(prevNode.pos);
        holder.nodes = node.nodes.splice(prevExprIndex + 1);
        node.node(holder);
    }
    sexpr() {
        const startpos = this.pos;
        if (!Parser.isSExprStart(this.current())) {
            return false;
        }
        this.next();
        const sexprnode = new ast_1.ASTExpression(startpos);
        while (this.expression(sexprnode) || this.spaces()) { }
        this.expect(Parser.isSExprEnd, startpos, ") or an expression");
        this.ast.expression(sexprnode);
        return true;
    }
    pragma() {
        if (!Parser.isPragmaStart(this.current(), this.peek())) {
            return false;
        }
        const startpos = this.pos;
        this.next();
        this.next();
        const contents = this.parseGenericString(startpos, Parser.isPragmaEnd);
        this.expect("#", startpos);
        this.ast.pragma(contents, startpos);
        return true;
    }
    indentedblock(node) {
        const startpos = this.pos;
        if (this.indent()) {
            const block = new ast_1.ASTBlock(startpos);
            this.ast.trap(() => {
                do {
                    if (!this.pragma() && !this.indentedexpr() && !this.spaces())
                        break;
                } while (!this.finished() && !this.dedent());
            }, block);
            node.node(block);
            return true;
        }
        return false;
    }
    block() {
        const startpos = this.pos;
        let block;
        if (Parser.isBlockArrow(this.current(), this.peek())) {
            this.next();
            this.next();
            let id;
            let blockinput;
            let space = false;
            if (Parser.isSExprStart(this.current())) {
                this.next();
                this.spaces();
                id = this.identity();
                this.spaces();
                this.expect(Parser.isSExprEnd, startpos, ")");
            }
            space = this.space();
            if (id || space) {
                blockinput = this.blockinput();
            }
            if (blockinput)
                space = this.space();
            this.spacesUntilNewline();
            if (Parser.isNewline(this.current())) {
                block = new ast_1.ASTBlock(startpos);
                if (!this.indentedblock(block)) {
                    block = false;
                }
            }
            else if (Parser.isBlockStart(this.current())) {
                block = this.curlyblock(startpos);
            }
            else {
                block = new ast_1.ASTBlock(startpos);
                if (space) {
                    while (this.expression(block)) { }
                    if (!block.nodes.length) {
                        this.expected("an expression", startpos);
                    }
                }
                else {
                    id = this.identity();
                }
            }
            if (block && blockinput) {
                block.input = blockinput;
            }
            if (id && block) {
                block.identity = id;
            }
            else if (id === false) {
                this.expected("an identity", startpos);
            }
        }
        else {
            block = this.curlyblock(startpos);
        }
        if (!block) {
            return false;
        }
        this.ast.block(block);
        return true;
    }
    curlyblock(startpos) {
        if (!Parser.isBlockStart(this.current())) {
            return false;
        }
        this.next();
        const block = new ast_1.ASTBlock(startpos);
        this.spaces();
        this.expressions(block);
        this.spaces();
        this.expect(Parser.isBlockEnd, startpos, "}");
        return block;
    }
    blockinput() {
        const startpos = this.pos;
        if (!Parser.isBlockInput(this.current())) {
            return false;
        }
        if (Parser.isBlockInput(this.next())) {
            return [];
        }
        this.spaces();
        const properties = this.ast.trap(() => {
            this.property();
            while (this.spaces(), (this.separator() && this.spaces()), this.property()) { }
        }).nodes;
        if (!properties.length) {
            this.expected("a property", startpos);
        }
        this.spaces();
        this.expect(Parser.isBlockInput, startpos, "|");
        return properties;
    }
    indent() {
        const spaces = this.countIndentSpaces() - this.indentLevel;
        if (spaces < 2) {
            this.dedentSpaces = spaces + this.indentLevel;
            return false;
        }
        this.indentLevel += spaces;
        this.indentLevels.push(spaces);
        return !this.finished();
    }
    dedent() {
        let spaces = this.dedentSpaces || this.countIndentSpaces();
        if (this.eof()) {
            return true;
        }
        else if (spaces === 0 || spaces < this.indentLevel) {
            let ilvl = this.indentLevels.length - 1;
            let dec;
            while (ilvl >= 0
                && this.indentLevel - (dec = this.indentLevels[ilvl]) + 1 > spaces) {
                this.indentLevel -= dec;
                spaces -= dec;
                ilvl -= 1;
                this.indentLevels.pop();
            }
            return true;
        }
        this.dedentSpaces = 0;
        return false;
    }
    countIndentSpaces() {
        while (this.parseUntilNotMatch(Parser.isSpaceOrTab).length || this.comment()) { }
        if (!Parser.isNewline(this.current())) {
            return 0;
        }
        while (Parser.isNewline(this.next())) { }
        let spaces = 0;
        let chr = this.current();
        let isspace = false;
        while ((isspace = Parser.isSpace(chr)) || Parser.isTab(chr)) {
            spaces += isspace ? 1 : 2;
            chr = this.next();
        }
        return spaces;
    }
    atom() {
        return this.number() || this.string() || this.array() || this.property();
    }
    number() {
        const startpos = this.pos;
        const sign = this.sign();
        const num = this.binaryNumber() || this.hexNumber() || this.octalNumber() || this.decimalNumber();
        if (typeof num === "boolean") {
            return false;
        }
        num
            .sign(sign)
            .suffix(this.numberSuffix())
            .unit(this.numberUnit(startpos));
        this.ast.number(num, startpos);
        return true;
    }
    sign() {
        const cur = this.current();
        if (cur === "+") {
            this.next();
            return 1;
        }
        else if (cur === "-" && this.peek() !== ">") {
            this.next();
            return -1;
        }
        return 1;
    }
    decimalNumber(fractioned = false) {
        const startpos = this.pos;
        let chr = this.current();
        if (!Parser.isDigit(chr)
            && (!Parser.isFloatSeparator(chr) || !Parser.isDigit(this.peek()))) {
            return false;
        }
        const num = new ast_1.ASTNumber(0, startpos);
        if (Parser.isDigit(chr)) {
            chr = this.parseNumberPart(num, Parser.isDigit);
        }
        else {
            num.digit("0");
        }
        if (Parser.isFloatSeparator(chr)) {
            num.float();
            if (Parser.isDigit(this.peek())) {
                chr = this.parseNumberPart(num, Parser.isDigit);
            }
            else {
                num.digit("0");
            }
        }
        if (Parser.isExponent(chr)) {
            num.exponent(this.sign());
            chr = this.current();
            if (!Parser.isDigit(chr)) {
                num.digit("1");
            }
            else {
                chr = this.parseNumberPart(num, Parser.isDigit);
            }
        }
        if (Parser.isFraction(chr)) {
            if (fractioned) {
                this.expected("a digit");
                return num;
            }
            this.next();
            const fraction = this.decimalNumber(true);
            if (fraction) {
                num.fraction(fraction);
            }
            else {
                this.expected("a fraction");
            }
            chr = this.current();
        }
        return num;
    }
    binaryNumber() {
        return this.nonDecimalNumber(3, "a binary digit", Parser.isBinPrefix, Parser.isBinDigit);
    }
    hexNumber() {
        return this.nonDecimalNumber(1, "a hexadecimal digit", Parser.isHexPrefix, Parser.isHexDigit);
    }
    octalNumber() {
        return this.nonDecimalNumber(2, "an octal digit", Parser.isOctPrefix, Parser.isOctDigit);
    }
    numberSuffix() {
        return this.parseUntilNotMatch(Parser.isNumberSuffix);
    }
    numberUnit(startpos) {
        if (Parser.isFloatSeparator(this.current())) {
            if (Parser.isNumberSuffix(this.peek())) {
                return this.numberSuffix();
            }
            else {
                this.expected("a number suffix", startpos);
                return "";
            }
        }
        return "";
    }
    nonDecimalNumber(type, name, prefix, check) {
        const startpos = this.pos;
        let chr = this.current();
        if (!prefix(chr, this.peek())) {
            return false;
        }
        this.next();
        chr = this.next();
        const num = new ast_1.ASTNumber(type, startpos);
        if (!check(chr)) {
            this.expected(name, startpos);
            return true;
        }
        num.digit(chr);
        this.parseNumberPart(num, check);
        return num;
    }
    parseNumberPart(num, check) {
        let chr = this.current();
        let sep = false;
        while (check(chr) || (sep = Parser.isNumberSeparator(chr))) {
            if (sep) {
                sep = false;
            }
            else {
                num.digit(chr);
            }
            chr = this.next();
        }
        return chr;
    }
    string() {
        let str;
        const startpos = this.pos;
        if (Parser.isStringMarker(this.current())) {
            str = this.parseString();
        }
        else if (Parser.isQuasistringStart(this.current())) {
            str = this.parseQuasistring();
        }
        else {
            return false;
        }
        this.ast.string(str, startpos);
        return true;
    }
    parseString() {
        const startpos = this.pos;
        this.next();
        if (this.eof()) {
            this.expected('"', startpos);
            return "";
        }
        const str = this.parseGenericString(startpos, Parser.isStringMarker);
        this.expect(Parser.isStringMarker, startpos, '"');
        return str;
    }
    parseQuasistring() {
        const startpos = this.pos;
        this.next();
        if (this.eof())
            return "";
        const str = this.parseGenericString(startpos, Parser.isQuasistringEnd);
        if (!this.eof()) {
            this.expect(Parser.isQuasistringEnd, startpos, "` or whitespace");
        }
        return str;
    }
    parseGenericString(startpos, end) {
        let chr = this.current();
        let content = "";
        while (chr !== undefined && !end(chr)) {
            if (Parser.isEscapeCharacter(chr)) {
                chr = this.parseEscapeCharacter(startpos);
            }
            content += chr;
            chr = this.next();
        }
        return content;
    }
    parseEscapeCharacter(startpos) {
        let chr;
        this.next();
        switch (chr = this.current().toLowerCase()) {
            case "\\":
            case '"':
            case "`":
            case "/":
            case "}":
            case "]":
            case "=":
            case " ":
                return chr;
            case "b": return "\b";
            case "f": return "\f";
            case "n": return "\n";
            case "r": return "\r";
            case "t": return "\t";
            case "x": return this.parseXxx(startpos);
            case "u": return this.parseUx(startpos);
            default:
                this.expected("a character escape", startpos);
                return "";
        }
    }
    parseXxx(startpos) {
        this.next();
        const code = parseInt(this.next() + this.next(), 16);
        if (isNaN(code)) {
            this.expected("a hexadecimal digit", startpos);
            return "";
        }
        return String.fromCharCode(code);
    }
    parseUx(startpos) {
        this.next();
        const code = Parser.isBlockStart(this.next())
            ? this.parseUntilNotMatch(Parser.isHexDigit)
            : this.current() + this.next() + this.next() + this.next();
        const codepoint = parseInt(code, 16);
        if (isNaN(codepoint)) {
            this.expected("a valid UTF-8 codepoint", startpos);
            return "";
        }
        return String.fromCodePoint(codepoint);
    }
    array() {
        const startpos = this.pos;
        let chr = this.current();
        if (!Parser.isArrayStart(chr)
            || Parser.isArrayEnd(this.peek()) && Parser.isIdentifierCharacter(this.peek(2))) {
            return false;
        }
        chr = this.next();
        this.ast.startArray(startpos);
        if (!Parser.isArrayEnd(chr)) {
            while (this.separator() || this.spaces() || this.atom()) { }
        }
        this.ast.endArray();
        this.expect(Parser.isArrayEnd, startpos, "]");
        return true;
    }
    property() {
        const startpos = this.pos;
        let tags;
        let sigil = ast_1.PropertySigil.None;
        let identifier = [];
        let type;
        const parseIdentifier = () => {
            if (!Parser.isIdentifier(this.current(), this.peek())) {
                return false;
            }
            identifier = this.identifier();
            if ((sigil === ast_1.PropertySigil.Value || sigil === ast_1.PropertySigil.Reference)
                && typeof identifier[0] === "string") {
                const firstid = identifier[0];
                if (firstid[0] === "." || firstid[0] === "&") {
                    identifier[0] = firstid[0] + identifier;
                    sigil = ast_1.PropertySigil.None;
                }
            }
            if (Parser.isTypeSpecifier(this.current())) {
                type = this.typespecifier();
            }
            return true;
        };
        if (Parser.isPropertyTagsStart(this.current(), this.peek())) {
            tags = this.propertytags();
            if (Parser.isPropertySigil(this.current())) {
                sigil = this.propertysigil();
            }
            if (!parseIdentifier()) {
                this.expected("an identifier", startpos);
            }
        }
        else if (Parser.isPropertySigil(this.current())) {
            sigil = this.propertysigil();
            if (!parseIdentifier()) {
                identifier = [Parser.sigilToString(sigil)];
                sigil = ast_1.PropertySigil.None;
            }
        }
        else {
            parseIdentifier();
        }
        if (identifier.length > 0) {
            this.ast.property(identifier, sigil, tags, type, startpos);
            return true;
        }
        return false;
    }
    propertytags() {
        const startpos = this.pos;
        const tags = new ast_1.ASTPropertyTags(startpos);
        this.next();
        this.next();
        if (Parser.isPropertyTagsEnd(this.current())) {
            this.next();
            return tags;
        }
        while (this.spaces() || this.propertytag(tags)) { }
        this.expect(Parser.isPropertyTagsEnd, startpos, "]");
        return tags;
    }
    propertytag(tags) {
        const startpos = this.pos;
        let name = "";
        let value = "";
        let chr = this.current();
        if (!Parser.isArrayStart(chr)) {
            return false;
        }
        this.next();
        this.spaces();
        chr = this.current();
        if (chr === "=") {
            this.expected("any character but '='", tags.pos);
            return true;
        }
        name = this.parseGenericString(startpos, (c) => {
            return Parser.isEquals(c) || Parser.isArrayEnd(c);
        });
        if (Parser.isEquals(this.current())) {
            this.next();
            value = this.parseGenericString(startpos, Parser.isArrayEnd);
        }
        if (!name) {
            this.expected("a property tag name", tags.pos);
            return true;
        }
        name = name.trim();
        value = value.trim();
        tags.tag(value ? { name, value } : { name });
        return true;
    }
    propertysigil() {
        const chr = this.current();
        let sigil;
        switch (chr) {
            case "#":
                sigil = ast_1.PropertySigil.Function;
                break;
            case ".":
                if (this.peek() === "." && this.peek(2) === ".") {
                    this.next();
                    this.next();
                    sigil = ast_1.PropertySigil.Spread;
                }
                else {
                    sigil = ast_1.PropertySigil.Value;
                }
                break;
            case "&":
                sigil = ast_1.PropertySigil.Reference;
                break;
            case ":":
                if (this.peek() === ":") {
                    this.next();
                    sigil = ast_1.PropertySigil.TypeSymbol;
                }
                else {
                    sigil = ast_1.PropertySigil.Symbol;
                }
                break;
            case "'":
                sigil = ast_1.PropertySigil.GenericType;
                break;
            case "\\":
                if (this.peek() === "\\") {
                    this.next();
                    sigil = ast_1.PropertySigil.ThisStatic;
                }
                else {
                    sigil = ast_1.PropertySigil.This;
                }
                break;
            default: throw new Error("property sigil? " + chr);
        }
        this.next();
        return sigil;
    }
    identifier() {
        if (this.eof())
            return [""];
        const id = [];
        let chr = this.current();
        let curid = "" + chr;
        let encountered = 1;
        if (chr === "[" && this.peek() === "]") {
            curid += this.next();
            encountered += 1;
        }
        else if (chr === "|") {
            while (this.peek() === "|") {
                curid += this.next();
                encountered += 1;
            }
        }
        while (Parser.isIdentifierCharacter(chr = this.next())) {
            if (encountered > 0) {
                const peek = this.peek();
                if (chr === ">" || chr === "<" && (peek !== ">" && peek !== ">")) {
                    break;
                }
                else if ((chr === "~" || chr === "/" || chr === ".") && Parser.isIdentifierCharacter(peek)) {
                    id.push(curid);
                    curid = "";
                    if (chr === "~")
                        id.push(ast_1.IdentifierBoundary.RTLNamespaceAccess);
                    else if (chr === "/")
                        id.push(ast_1.IdentifierBoundary.NamespaceAccess);
                    else if (chr === ".")
                        id.push(ast_1.IdentifierBoundary.InstanceAccess);
                    encountered = 0;
                }
                else if (chr === "[" && peek !== "]") {
                    this.next();
                    id.push(curid);
                    curid = "";
                    const expr = new ast_1.ASTExpression(this.pos);
                    if (!this.expression(expr)) {
                        this.expected("an expression", expr.pos);
                    }
                    else {
                        this.expect("]", expr.pos);
                    }
                    id.push(ast_1.IdentifierBoundary.BracketAccess, expr);
                }
                else {
                    curid += chr;
                    encountered += 1;
                }
            }
            else {
                curid += chr;
                encountered += 1;
            }
        }
        if (curid)
            id.push(curid);
        return id;
    }
    identity() {
        if (Parser.isPropertySigil(this.current())) {
            return [Parser.sigilToString(this.propertysigil())];
        }
        else if (Parser.isIdentifier(this.current(), this.peek())) {
            return this.identifier();
        }
        return false;
    }
    typespecifier() {
        const type = new ast_1.ASTPropertyTypespec(this.pos);
        if (this.current() === "<") {
            this.typeshorthand(type);
        }
        else if (this.current() === ":") {
            this.next();
            this.spaces();
            const expr = new ast_1.ASTExpression(this.pos);
            this.ast.trap(() => {
                while (this.atom() || this.sexpr() || this.block()) { }
            }, expr);
            if (expr.nodes.length) {
                type.expr(expr);
            }
            else {
                this.expected("an expression");
            }
        }
        return type;
    }
    typeshorthand(type) {
        const startpos = this.pos;
        if (this.current() === "<") {
            this.next();
            this.spaces();
            if (!Parser.isIdentifier(this.current(), this.peek())) {
                this.expected("an identifier", startpos);
                return;
            }
            this.typeidentifier(type);
            while (this.spaces(), this.separator(), this.typeidentifier(type)) { }
            this.spaces();
            this.expect(">", startpos);
        }
    }
    typeidentifier(type) {
        if (!Parser.isIdentifier(this.current(), this.peek())) {
            return false;
        }
        type.id(this.identifier());
        this.typeshorthand(type);
        return true;
    }
    comment() {
        const startpos = this.pos;
        let chr = this.current();
        if (Parser.isCommentStart(chr)) {
            chr = this.next();
            if (chr === "*") {
                this.ast.comment(1, this.multilineComment(), startpos);
            }
            else {
                this.ast.comment(0, this.parseUntilMatch(Parser.isNewline), startpos);
            }
            return true;
        }
        return false;
    }
    multilineComment() {
        const self = this;
        let chr = this.next();
        let contents = "";
        (function swallow() {
            while (!self.eof() && chr !== "*") {
                contents += chr;
                chr = self.next();
            }
            if (self.eof() || self.peek() === ";") {
                return;
            }
            contents += chr;
            chr = self.next();
            contents += chr;
            swallow();
        }());
        return contents;
    }
    space() {
        if (Parser.isSpaceOrTab(this.current())) {
            this.next();
            return true;
        }
        return false;
    }
    spaces() {
        let matched = false;
        while (this.parseUntilNotMatch(Parser.isWhitespace).length || this.comment()) {
            matched = true;
        }
        return matched;
    }
    spacesUntilNewline() {
        let matched = false;
        while (this.parseUntilNotMatch(Parser.isSpaceOrTab).length || this.comment()) {
            matched = true;
        }
        return matched;
    }
    separator() {
        let matched = false;
        while (this.parseUntilNotMatch(Parser.isSeparator).length) {
            matched = true;
        }
        return matched;
    }
    finished() {
        return this.ast.errored() || this.eof();
    }
    eof() { return this.pos >= this.code.length; }
    static isNewline(chr) {
        return chr === "\n" || chr === "\r";
    }
    static isSpace(chr) {
        return chr === " ";
    }
    static isTab(chr) {
        return chr === "\t";
    }
    static isSpaceOrTab(chr) {
        return Parser.isSpace(chr) || Parser.isTab(chr);
    }
    static isWhitespace(chr) {
        return Parser.isSpaceOrTab(chr) || Parser.isNewline(chr);
    }
    static isCommentStart(chr) {
        return chr === ";";
    }
    static isDigit(chr) {
        if (chr === undefined)
            return false;
        const code = chr.charCodeAt(0);
        return (code >= 48 && code <= 57);
    }
    static isBinDigit(chr) {
        return chr === "0" || chr === "1";
    }
    static isHexDigit(chr) {
        if (chr === undefined)
            return false;
        const code = chr.charCodeAt(0);
        return (code >= 48 && code <= 57)
            || (code >= 65 && code <= 70)
            || (code >= 97 && code <= 102);
    }
    static isOctDigit(chr) {
        if (chr === undefined)
            return false;
        const code = chr.charCodeAt(0);
        return code >= 48 && code <= 55;
    }
    static isNumberSeparator(chr) {
        return chr === "_";
    }
    static isFloatSeparator(chr) {
        return chr === ".";
    }
    static isFraction(chr) {
        return chr === "/";
    }
    static isExponent(chr) {
        return chr === "e" || chr === "E";
    }
    static isBinPrefix(first, second) {
        return first === "0" && (second === "b" || second === "B");
    }
    static isHexPrefix(first, second) {
        return first === "0" && (second === "h" || second === "H");
    }
    static isOctPrefix(first, second) {
        return first === "0" && (second === "o" || second === "O");
    }
    static isNumberSuffix(chr) {
        return Parser.isIdentifierCharacter(chr) && !Parser.isFraction(chr) && !Parser.isFloatSeparator(chr);
    }
    static isStringMarker(chr) {
        return chr === '"';
    }
    static isQuasistringStart(chr) {
        return chr === "`";
    }
    static isQuasistringEnd(chr) {
        return Parser.isQuasistringStart(chr) || Parser.isWhitespace(chr);
    }
    static isEscapeCharacter(chr) {
        return chr === "\\";
    }
    static isArrayStart(chr) {
        return chr === "[";
    }
    static isArrayEnd(chr) {
        return chr === "]";
    }
    static isBlockStart(chr) {
        return chr === "{";
    }
    static isBlockEnd(chr) {
        return chr === "}";
    }
    static isSExprStart(chr) {
        return chr === "(";
    }
    static isSExprEnd(chr) {
        return chr === ")";
    }
    static isSeparator(chr) {
        return chr === ",";
    }
    static isIdentifierCharacter(chr) {
        return chr !== undefined && !Parser.isWhitespace(chr)
            && (chr !== "{" && chr !== "}" && chr !== "(" && chr !== ")" && chr !== "]"
                && chr !== "\\" && chr !== '"' && chr !== "`" && chr !== "," && chr !== ":"
                && chr !== "|");
    }
    static isInitialIdentifierCharacter(chr) {
        return (chr !== "[" && chr !== "-" && chr !== ">"
            && !Parser.isDigit(chr) && Parser.isIdentifierCharacter(chr));
    }
    static isIdentifier(first, second) {
        return Parser.isInitialIdentifierCharacter(first)
            || (first === "[" && (second === "]" || !Parser.isIdentifierCharacter(second)))
            || (first === "-" && second !== ">")
            || first === "|";
    }
    static isPropertySigil(chr) {
        return chr === "#" || chr === "." || chr === "&" || chr === ":" || chr === "'" || chr === "\\";
    }
    static isTypeSpecifier(chr) {
        return chr === ":" || chr === "<";
    }
    static isPropertyTagsStart(first, second) {
        return first === "#" && second === "[";
    }
    static isPropertyTagsEnd(chr) {
        return chr === "]";
    }
    static isPragmaStart(first, second) {
        return first === "#" && second === "{";
    }
    static isPragmaEnd(chr) {
        return chr === "}";
    }
    static isBlockArrow(first, second) {
        return first === "-" && second === ">";
    }
    static isBlockInput(chr) {
        return chr === "|";
    }
    static isEquals(chr) {
        return chr === "=";
    }
    static sigilToString(sigil) {
        switch (sigil) {
            case ast_1.PropertySigil.Function: return "#";
            case ast_1.PropertySigil.Value: return ".";
            case ast_1.PropertySigil.Reference: return "&";
            case ast_1.PropertySigil.Spread: return "...";
            case ast_1.PropertySigil.Symbol: return ":";
            case ast_1.PropertySigil.TypeSymbol: return "::";
            case ast_1.PropertySigil.GenericType: return "'";
            case ast_1.PropertySigil.This: return "\\";
            case ast_1.PropertySigil.ThisStatic: return "\\\\";
            default: return "";
        }
    }
    parseUntilMatch(test) {
        if (this.eof())
            return "";
        let chr = this.current();
        let content = "";
        while (chr !== undefined && !test(chr)) {
            content += chr;
            chr = this.next();
        }
        return content;
    }
    parseUntilNotMatch(test) {
        return this.parseUntilMatch((c) => !test(c));
    }
}
exports.Parser = Parser;
