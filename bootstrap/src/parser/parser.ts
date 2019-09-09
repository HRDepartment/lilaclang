import {
    AST, ASTNumber, ASTBlock, ASTNode, ASTProperty,
    ASTPropertyTypespec, ASTPropertyTags, ASTExpression,
    Position, PropertySigil, Identifier, IdentifierBoundary,
    ASTNumberType, ASTCommentType, ASTType, ASTElement
} from './ast';

type ChrCheck = (chr: string) => boolean;
type PrefixCheck = (chr1: string, chr2: string) => boolean;

class Parser {
    code = "";
    file = "";
    ast  = new AST();
    private pos  = 0;
    private indentLevels: number[] = [];
    private indentLevel = 0; // sum of indentLevels for performance
    // spaces dedent() should assume that were parsed earlier by indent() for performance,
    // instead of having to backtrack or reparse with peek()
    private dedentSpaces = 0;

    current() { return this.code[this.pos]; }
    next() { return this.code[++this.pos]; }
    peek(by = 1) { return this.code[this.pos + by]; }
    reset() {
        this.code = "";
        this.pos  = 0;
    }

    parse(code: string, file = "") {
        this.reset();
        this.code = code;
        this.file = file;
        if (!this.program()) {
            this.expected("an expression");
        }
        return this.ast;
    }

    private expect(chr: string | ChrCheck, startpos: number, msg = "") {
        if (typeof chr === "function" && chr(this.current()) || (this.current() === chr)) {
            this.next();
            return true;
        }

        this.expected(typeof chr === "string" ? chr : msg, startpos);
        return false;
    }

    private expected(what: string, start?: number) {
        const got = this.current() || "<EOF>";
        const posstart = typeof start === "number" ? ` (starting at ${start})` : "";
        this.ast.error(
            `Expected ${what} at position ${this.pos}${posstart} in file "${this.file}", instead got "${got}"`
        );
        this.pos = this.code.length; // at EOF
        return false;
    }

    private program() {
        while (!this.finished()) {
            if (!this.pragma() && !this.indentedexpr() && !this.spaces()) break;
        }

        this.indentLevel = 0;
        this.indentLevels = [];
        return this.ast.programHasNodes();
    }

    private expressions(node: ASTNode) {
        const startNodes = node.nodes.length;
        return this.ast.trap(() => {
            while (!this.finished()) {
                if (!this.pragma() && !this.spaces() && !this.expression(node)) break;
            }
        }, node).nodes.length > startNodes;
    }

    private indentedexpr(startnode?: ASTExpression) {
        return this.expression(startnode, true);
    }

    private expression(startnode?: ASTExpression, indented = false) {
        // Optimization
        if (this.eof() || Parser.isSExprEnd(this.current())) {
            return false;
        }

        const node = startnode || new ASTExpression(this.pos);
        let success = false;
        this.ast.trap(() => {
            if (this.atom()) {
                success = true;

                const atom = node.nodes[node.nodes.length - 1];
                if (this.space()) { // atom, space
                    while (
                        this.spacesUntilNewline(), this.expression(node, indented)
                    ) {/**/}
                } else if (atom instanceof ASTProperty && Parser.isSExprStart(this.current())) { // property, sexpr
                    this.ast.trap(() => this.sexpr(), atom);
                }

                // current() could have changed here, re-eval
                if (Parser.isSeparator(this.current())) {
                    // A separator forces a expression, so a(b c, d e) is equivalent to a((b c), (d e)).
                    // Of course, a(b, c) become a((b) (c)) which is equivalent
                    // (an expression with a single value evaluates to that value)
                    if (this.separator()) {
                        this.coalesceAtoms(node);
                    }

                    this.spaces();

                    let hadExpr = false;
                    while (this.expression(node, indented)) {
                        hadExpr = true;
                    }

                    // Must do that for anything matched after as well
                    if (hadExpr) this.coalesceAtoms(node);
                } else if (indented) {
                    this.indentedblock(node);
                }
            }
        }, node, ASTType.Expression);

        if (!success) {
            this.ast.trap(() => {
                success = this.sexpr() || this.block();
            }, node);
        }

        if (success) {
            if (startnode) {
                startnode.combine(node);
            } else {
                this.ast.expression(node);
            }
        }

        return success;
    }

    // Coalesce atoms into a single expression.
    private coalesceAtoms(node: ASTExpression) {
        // a
        let prevExprIndex = node.nodes.length - 1;
        let prevNode: ASTElement | undefined;
        for (; prevExprIndex >= 0; prevExprIndex -= 1) {
            const subnode = node.nodes[prevExprIndex];
            if (AST.isExpression(subnode)) {
                prevNode = subnode;
                break;
            }
        }

        // .splice(array.length) just returns [], there is no node to slice here.
        // would only introduce an empty expression which is pointless.
        // occurs in the post-separator coalesceAtoms if we are at the end of the s-expr: a(a, b, c)
        if (prevExprIndex === node.nodes.length - 1) {
            return;
        }

        if (!prevNode) prevNode = node.nodes[0];
        const holder = new ASTExpression(prevNode.pos);
        holder.nodes = node.nodes.splice(prevExprIndex + 1);
        node.node(holder);
    }

    private sexpr() {
        const startpos = this.pos;
        if (!Parser.isSExprStart(this.current())) {
            return false;
        }

        this.next();

        const sexprnode = new ASTExpression(startpos);
        while (this.expression(sexprnode) || this.spaces()) {/**/}
        this.expect(Parser.isSExprEnd, startpos, ") or an expression");

        this.ast.expression(sexprnode);
        return true;
    }

    private pragma() {
        if (!Parser.isPragmaStart(this.current(), this.peek())) {
            return false;
        }

        const startpos = this.pos;
        // Skip "#{"
        this.next();
        this.next();

        const contents = this.parseGenericString(startpos, Parser.isPragmaEnd);
        this.expect("#", startpos);
        this.ast.pragma(contents, startpos);
        return true;
    }

    private indentedblock(node: ASTExpression) {
        const startpos = this.pos;
        if (this.indent()) {
            const block = new ASTBlock(startpos);
            this.ast.trap(() => {
                // indent() strips whitespace for the first line of the block so dedent() would immediately return false
                // a do-while is required
                do {
                    if (!this.pragma() && !this.indentedexpr() && !this.spaces()) break;
                } while (!this.finished() && !this.dedent());
            }, block);
            node.node(block);
            return true;
        }
        return false;
    }

    private block() {
        const startpos = this.pos;
        let block: ASTBlock | false;

        if (Parser.isBlockArrow(this.current(), this.peek())) {
            // Skip ->
            this.next();
            this.next();

            let id: Identifier | false | undefined;
            let blockinput: ASTProperty[] | false | undefined;
            let singleline = false;
            if (Parser.isSExprEnd(this.current())) { // ->)
                this.next(); // )
                singleline = true;
                if (!this.space()) {
                    this.expected("a space", startpos);
                }
            } else {
                if (Parser.isSExprStart(this.current())) { // ->(scope)|blockinput|{exprs}
                    this.next();
                    this.spaces();
                    id = this.identity();
                    this.spaces();
                    this.expect(Parser.isSExprEnd, startpos, ")");
                }

                if (id || this.space()) { // ->(scope)|blockinput|, -> |blockinput|
                    blockinput = this.blockinput();
                }
            }

            this.spacesUntilNewline();
            if (singleline) { // ->)
                block = new ASTBlock(startpos);
                while (this.expression(block)) {/**/}
                if (!block.nodes.length) {
                    this.expected("an expression", startpos);
                }
            } else {
                if (Parser.isBlockStart(this.current())) { // ->{exprs}
                    block = this.curlyblock(startpos);
                } else {
                    block = new ASTBlock(startpos);
                    if (Parser.isIndentedBlock(this.current(), this.peek(1), this.peek(2))) { // ->\n expressions
                        if (!this.indentedblock(block)) {
                            block = false;
                        }
                    } else {
                        id = this.identity();
                    }
                }
            }

            if (block && blockinput) {
                block.input = blockinput;
            }

            if (id && block) {
                block.identity = id;
            } else if (id === false) {
                this.expected("an identity", startpos);
            }
        } else {
            block = this.curlyblock(startpos);
        }

        if (!block) {
            return false;
        }

        this.ast.block(block);
        return true;
    }

    private curlyblock(startpos: Position) {
        if (!Parser.isBlockStart(this.current())) {
            return false;
        }

        this.next(); // {

        const block = new ASTBlock(startpos);
        this.spaces();

        this.expressions(block);
        this.spaces();

        this.expect(Parser.isBlockEnd, startpos, "}");
        return block;
    }

    private blockinput() {
        const startpos = this.pos;
        if (!Parser.isBlockInput(this.current())) {
            return false;
        }
        if (Parser.isBlockInput(this.next())) { // || which is an empty blockinput
            return [];
        }

        this.spaces();
        const properties = this.ast.trap(() => {
            this.property();
            while (this.spaces(), (this.separator() && this.spaces()), this.property()) {/**/}
        }).nodes as ASTProperty[];

        if (!properties.length) {
            this.expected("a property", startpos);
        }

        this.spaces();
        this.expect(Parser.isBlockInput, startpos, "|");
        return properties;
    }

    private indent() {
        // Adjust spaces for the current indent level.
        // 11 spaces with an indent level of 8 should only be seen as 3 spaces.
        const spaces = this.countIndentSpaces() - this.indentLevel;
        if (spaces < 2) {
            this.dedentSpaces = spaces + this.indentLevel;
            return false;
        }

        this.indentLevel += spaces;
        this.indentLevels.push(spaces);
        return !this.finished();
    }

    private dedent() { // true: end of block
        let spaces = this.dedentSpaces || this.countIndentSpaces();

        if (this.eof()) {
            return true;
        } else if (spaces === 0 || spaces < this.indentLevel) { // +- 1, decrease in indent
            let ilvl = this.indentLevels.length - 1;
            let dec: number;
            // Drop down to the closest indent level that matches the number of spaces
            while (ilvl >= 0 // bounds check
                // total indent - current level +- 1 > next indent
                // perhaps better illustrated with an example calculation:
                // indentLevels = [2, 2, 2] spaces = 4 indentLevel = 6
                // 6 - 2 + 1 (5) > 4: true -> indentLevel = 4, spaces = 2
                // 4 - 2 + 1 (3) > 2: false
                // only one indent level is dropped
                && this.indentLevel - (dec = this.indentLevels[ilvl]) + 1 > spaces) {
                this.indentLevel -= dec;
                spaces -= dec;
                ilvl -= 1;
                this.indentLevels.pop();
            }
            return true;
        }

        /* Reset dedentSpaces. This must be done after the dedent check because of code like this:
        if a
            if b
                c
            d

        If the reset is done before the check, 'd' will become part of the Program (root block),
        not part of the if a block. This is because indentedexpr is called recursively and the
        space information would be lost for the block below the current block, if any. */
        this.dedentSpaces = 0;
        return false; // same indent or increase in indent
    }

    private countIndentSpaces() {
        // Parse comments or spaces
        while (
            this.parseUntilNotMatch(Parser.isSpaceOrTab).length || this.comment()
        ) {/**/}

        if (!Parser.isNewline(this.current())) {
            return 0;
        }

        while (Parser.isNewline(this.next())) {/**/} // \r\n and such

        let spaces = 0;
        let chr = this.current();
        let isspace = false;
        while ((isspace = Parser.isSpace(chr)) || Parser.isTab(chr)) {
            // isspace is true if chr is a space or false if chr is a tab
            // a tab is counted as two spaces
            spaces += isspace ? 1 : 2;
            chr = this.next();
        }
        return spaces;
    }

    private atom() {
        return this.number() || this.string() || this.array() || this.property();
    }

    private number() {
        const startpos = this.pos;
        const sign = this.sign();
        // Must parse numbers with prefixes first
        const num: ASTNumber | boolean =
            this.binaryNumber() || this.hexNumber() || this.octalNumber() || this.decimalNumber();
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

    private sign() {
        const cur = this.current();

        if (cur === "+") {
            this.next();
            return 1;
        } else if (cur === "-" && this.peek() !== ">") { // -> would be a block, and a number cannot begin with >
            this.next();
            return -1;
        }

        return 1;
    }

    private decimalNumber(fractioned = false) {
        const startpos = this.pos;
        let chr = this.current();
        // will only match on 1 or .1, will not match on .name etc.
        if (!Parser.isDigit(chr)
            && (!Parser.isFloatSeparator(chr) || !Parser.isDigit(this.peek()))) {
            return false;
        }

        const num = new ASTNumber(ASTNumberType.Decimal, startpos);
        if (Parser.isDigit(chr)) {
            chr = this.parseNumberPart(num, Parser.isDigit);
        } else {
            num.digit("0");
        }

        if (Parser.isFloatSeparator(chr)) {
            num.float();
            if (Parser.isDigit(this.peek())) {
                chr = this.parseNumberPart(num, Parser.isDigit);
            } else {
                num.digit("0");
            }
        }

        if (Parser.isExponent(chr)) {
            num.exponent(this.sign());
            chr = this.current();
            if (!Parser.isDigit(chr)) {
                num.digit("1");
            } else {
                chr = this.parseNumberPart(num, Parser.isDigit);
            }
        }

        if (Parser.isFraction(chr)) {
            // A number cannot have more than 1 fraction component
            if (fractioned) {
                this.expected("a digit");
                return num;
            }

            this.next();
            const fraction = this.decimalNumber(true);
            if (fraction) {
                num.fraction(fraction);
            } else {
                this.expected("a fraction");
            }
            chr = this.current();
        }

        return num;
    }

    private binaryNumber() {
        return this.nonDecimalNumber(ASTNumberType.Binary, "a binary digit", Parser.isBinPrefix, Parser.isBinDigit);
    }

    private hexNumber() {
        return this.nonDecimalNumber(ASTNumberType.Hex, "a hexadecimal digit", Parser.isHexPrefix, Parser.isHexDigit);
    }

    private octalNumber() {
        return this.nonDecimalNumber(ASTNumberType.Octal, "an octal digit", Parser.isOctPrefix, Parser.isOctDigit);
    }

    private numberSuffix() {
        return this.parseUntilNotMatch(Parser.isNumberSuffix);
    }

    private numberUnit(startpos: number) {
        if (Parser.isFloatSeparator(this.current())) {
            if (Parser.isNumberSuffix(this.peek())) {
                return this.numberSuffix();
            } else {
                this.expected("a number suffix", startpos);
                return "";
            }
        }

        return "";
    }

    private nonDecimalNumber(type: ASTNumberType, name: string, prefix: PrefixCheck, check: ChrCheck) {
        const startpos = this.pos;
        let chr = this.current();
        if (!prefix(chr, this.peek())) {
            return false;
        }
        // Skip the prefix
        this.next();
        chr = this.next();

        const num = new ASTNumber(type, startpos);
        if (!check(chr)) {
            this.expected(name, startpos);
            return true;
        }

        num.digit(chr);
        this.parseNumberPart(num, check);
        return num;
    }

    private parseNumberPart(num: ASTNumber, check: ChrCheck) {
        let chr = this.current();
        let sep = false;
        while (check(chr) || (sep = Parser.isNumberSeparator(chr))) {
            if (sep) { // Ignore separators
                sep = false;
            } else {
                num.digit(chr);
            }

            chr = this.next();
        }
        return chr;
    }

    private string() {
        let str: string;
        const startpos = this.pos;
        if (Parser.isStringMarker(this.current())) {
            str = this.parseString();
        } else if (Parser.isQuasistringStart(this.current())) {
            str = this.parseQuasistring();
        } else {
            return false;
        }

        this.ast.string(str, startpos);
        return true;
    }

    private parseString() {
        // TODO: auto-strip indent as expected by spec
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

    private parseQuasistring() {
        const startpos = this.pos;
        this.next();
        if (this.eof()) return "";

        const str = this.parseGenericString(startpos, Parser.isQuasistringEnd);
        if (!this.eof()) { // EOF functions as the end of a quasistring too
            this.expect(Parser.isQuasistringEnd, startpos, "` or whitespace");
        }
        return str;
    }

    private parseGenericString(startpos: number, end: ChrCheck) {
        let chr = this.current();
        let content = "";
        while (chr !== undefined && !end(chr)) {
            if (Parser.isEscapeCharacter(chr)) {
                chr = this.parseEscapeCharacter(startpos);
            }
            // TODO: #{} inline
            content += chr;
            chr = this.next();
        }
        return content;
    }

    private parseEscapeCharacter(startpos: number) {
        let chr: string;

        this.next(); // skip escape char \
        switch (chr = this.current().toLowerCase()) {
            case "\\":
            case '"' :
            case "`" :
            case "/" :
            case "}" :
            case "]" :
            case "=" :
            case " " :
                return chr;
            case "b" : return "\b";
            case "f" : return "\f";
            case "n" : return "\n";
            case "r" : return "\r";
            case "t" : return "\t";
            case "x" : return this.parseXxx(startpos);
            case "u" : return this.parseUx(startpos);
            default  :
                this.expected("a character escape", startpos);
                return "";
        }
    }

    private parseXxx(startpos: number) {
        this.next(); // x
        const code = parseInt(this.next() + this.next(), 16);
        if (isNaN(code)) {
            this.expected("a hexadecimal digit", startpos);
            return "";
        }

        return String.fromCharCode(code);
    }

    private parseUx(startpos: number) {
        this.next(); // u
        const code = Parser.isBlockStart(this.next())
            ? this.parseUntilNotMatch(Parser.isHexDigit)
            // initial is current because of the .next() before; otherwise we would wipe a digit
            : this.current() + this.next() + this.next() + this.next();

        const codepoint = parseInt(code, 16);
        if (isNaN(codepoint)) {
            this.expected("a valid UTF-8 codepoint", startpos);
            return "";
        }

        return String.fromCodePoint(codepoint);
    }

    private array() {
        const startpos = this.pos;
        let chr = this.current();
        if (!Parser.isArrayStart(chr)
            // []= and such is an identifier
            || Parser.isArrayEnd(this.peek()) && Parser.isIdentifierCharacter(this.peek(2))) {
            return false;
        }

        chr = this.next();
        this.ast.startArray(startpos);
        if (!Parser.isArrayEnd(chr)) {
            while (
                this.separator() || this.spaces() || this.atom()
            ) {/**/}
        }
        this.ast.endArray();

        this.expect(Parser.isArrayEnd, startpos, "]");
        return true;
    }

    private property() {
        const startpos = this.pos;
        let tags: ASTPropertyTags | undefined;
        let sigil = PropertySigil.None;
        let identifier: Identifier = [];
        let type: ASTPropertyTypespec | undefined;

        const parseIdentifier = () => {
            if (!Parser.isIdentifier(this.current(), this.peek())) {
                return false;
            }

            identifier = this.identifier();

            // in the case of an identifier that starts with "." or "&"
            // with a property sigil that is equivalent, the identifier becomes ".." or "&&" (and ..=, &&=, etc.)
            if ((sigil === PropertySigil.Value || sigil === PropertySigil.Reference)
                && typeof identifier[0] === "string") {
                const firstid = identifier[0] as string; // required for typescript to understand
                if (firstid[0] === "." || firstid[0] === "&") {
                    identifier[0] = firstid[0] + identifier;
                    sigil = PropertySigil.None;
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
        } else if (Parser.isPropertySigil(this.current())) {
            sigil = this.propertysigil();
            // a property may only have a sigil, in which case that becomes its name.
            if (!parseIdentifier()) { // can't parse an identifier: sole property sigil
                identifier = [Parser.sigilToString(sigil)];
                sigil = PropertySigil.None;
            }
        } else { // lone identifier
            parseIdentifier();
        }

        if (identifier.length > 0) {
            this.ast.property(identifier, sigil, tags, type, startpos);
            return true;
        }

        return false;
    }

    /**
     * Must verify that Parser.isPropertyTagsStart(this.current(), this.peek())
     */
    private propertytags() {
        const startpos = this.pos;
        const tags = new ASTPropertyTags(startpos);

        // Skip "#["
        this.next();
        this.next();

        if (Parser.isPropertyTagsEnd(this.current())) {
            this.next();
            return tags;
        }

        while (this.spaces() || this.propertytag(tags)) {/**/}
        this.expect(Parser.isPropertyTagsEnd, startpos, "]");
        return tags;
    }

    private propertytag(tags: ASTPropertyTags) {
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

        name = this.parseGenericString(startpos, (c: string) => {
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
        tags.tag(value ? {name, value} : {name});
        return true;
    }

    /**
     * Must verify that Parser.isPropertySigil(this.current())
     */
    private propertysigil() {
        const chr = this.current();
        let sigil: PropertySigil;

        switch (chr) {
        case "#":
            sigil = PropertySigil.Function;
            break;
        case ".":
            if (this.peek() === "." && this.peek(2) === ".") {
                this.next();
                this.next();
                sigil = PropertySigil.Spread;
            } else {
                sigil = PropertySigil.Value;
            }
            break;
        case "&":
            sigil = PropertySigil.Reference;
            break;
        case ":":
            if (this.peek() === ":") {
                this.next();
                sigil = PropertySigil.TypeSymbol;
            } else {
                sigil = PropertySigil.Symbol;
            }
            break;
        case "'":
            sigil = PropertySigil.GenericType;
            break;
        case "\\":
            if (this.peek() === "\\") {
                this.next();
                sigil = PropertySigil.ThisStatic;
            } else {
                sigil = PropertySigil.This;
            }
            break;
        default: throw new Error("property sigil? " + chr);
        }

        this.next();
        return sigil;
    }

    /**
     * Must verify that Parser.isIdentifier(this.current(), this.peek())
     */
    private identifier() {
        if (this.eof()) return [""];

        const id: Identifier = [];
        let chr = this.current();
        let curid = "" + chr;
        let encountered = 1;

        // special case for [], ] is not legal otherwise
        if (chr === "[" && this.peek() === "]") {
            curid += this.next();
            encountered += 1;
        } else if (chr === "|") { // special case for leading |: ||||||||name
            while (this.peek() === "|") {
                curid += this.next();
                encountered += 1;
            }
        }

        while (Parser.isIdentifierCharacter(chr = this.next())) {
            if (encountered > 0) {
                const peek = this.peek();

                if (chr === ">" || chr === "<" && (peek !== ">" && peek !== ">")) {
                    break; // typespec
                } else if (Parser.isIdentifierBoundary(chr) && Parser.isIdentifierCharacter(peek)) {
                    id.push(curid);
                    curid = "";

                    id.push(Parser.stringToIdentifierBoundary(chr));
                    encountered = 0; // because /name can be defined, it should be accessible under a ns too: name//name
                } else if (chr === "[" && peek !== "]") {
                    this.next(); // [
                    id.push(curid);
                    curid = "";

                    const expr = new ASTExpression(this.pos);
                    if (!this.expression(expr)) {
                        this.expected("an expression", expr.pos);
                    } else {
                        this.expect("]", expr.pos);
                    }
                    id.push(IdentifierBoundary.BracketAccess, expr);
                } else {
                    curid += chr;
                    encountered += 1;
                }
            } else {
                curid += chr;
                encountered += 1;
            }
        }

        if (curid) id.push(curid);
        return id;
    }

    private identity() {
        if (Parser.isPropertySigil(this.current())) {
            return [Parser.sigilToString(this.propertysigil())];
        } else if (Parser.isIdentifier(this.current(), this.peek())) {
            return this.identifier();
        }

        return false;
    }

    /**
     * Must verify that Parser.isTypeSpecifier(this.current())
     */
    private typespecifier() {
        const type = new ASTPropertyTypespec(this.pos);
        if (Parser.isTypeShorthandStart(this.current())) { // type shorthand
            this.typeshorthand(type);
        }

        if (this.current() === ":") { // type specifier
            this.next(); // :
            this.spaces();
            const expr = new ASTExpression(this.pos);

            this.ast.trap(() => {
                if (this.atom()) {
                    const atom = expr.nodes[0];
                    if (AST.isProperty(atom) && Parser.isBlockStart(this.current())) {
                        this.next(); // {
                        this.expression(atom);
                        this.expect(Parser.isBlockEnd, expr.pos, "}");
                    }
                } else {
                    this.sexpr();
                }
            }, expr);

            if (expr.nodes.length) {
                type.expr(expr);
            } else {
                this.expected("an expression");
            }
        }

        return type;
    }

    private typeshorthand(type: ASTPropertyTypespec) {
        if (!Parser.isTypeShorthandStart(this.current())) {
            return false;
        }

        const startpos = this.pos;
        this.next(); // <
        this.spaces();

        if (!Parser.isIdentifier(this.current(), this.peek())) {
            this.expected("an identifier", startpos);
            return;
        }

        this.typeidentifier(type);
        while (this.spaces(), this.separator(), this.typeidentifier(type)) {/**/}

        this.spaces();
        this.expect(">", startpos);
        return true;
    }

    private typeidentifier(type: ASTPropertyTypespec) {
        if (!Parser.isIdentifier(this.current(), this.peek())) {
            return false;
        }

        type.id(this.identifier());
        this.typeshorthand(type);
        return true;
    }

    private comment() {
        const startpos = this.pos;
        let chr = this.current();
        if (Parser.isCommentStart(chr)) {
            chr = this.next();
            if (chr === "*") { // Multiline
                this.ast.comment(ASTCommentType.MultiLine, this.multilineComment(), startpos);
            } else { // Newline
                this.ast.comment(ASTCommentType.SingleLine, this.parseUntilMatch(Parser.isNewline), startpos);
            }
            return true;
        }
        return false;
    }

    private multilineComment(): string {
        const self = this;
        let chr = this.next();
        let contents = ""; // explicit new string

        (function swallow() {
            while (!self.eof() && chr !== "*") {
                contents += chr;
                chr = self.next();
            }

            if (self.eof()) {
                return;
            }
            if (self.peek() === ";") {
                self.next();
                return;
            }

            // This * does not close the comment, add it to the contents
            contents += chr;
            chr = self.next();
            // Must add this character as well, contents += is after .next() in the loop
            contents += chr;
            swallow(); // Try to find the end of the comment again
        }());
        return contents;
    }

    private space() {
        if (Parser.isSpaceOrTab(this.current())) {
            this.next();
            return true;
        }
        return false;
    }
    private spaces() {
        let matched = false;
        while (
            this.parseUntilNotMatch(Parser.isWhitespace).length || this.comment()
        ) {
            matched = true;
        }
        return matched;
    }
    private spacesUntilNewline() {
        let matched = false;
        while (
            this.parseUntilNotMatch(Parser.isSpaceOrTab).length || this.comment()
        ) {
            matched = true;
        }
        return matched;
    }
    private separator() {
        let matched = false;
        while (
            this.parseUntilNotMatch(Parser.isSeparator).length
        ) {
            matched = true;
        }
        return matched;
    }

    private finished() {
        return this.ast.errored() || this.eof();
    }
    private eof() { return this.pos >= this.code.length; }

    static isNewline(chr: string) {
        return chr === "\n" || chr === "\r";
    }
    static isSpace(chr: string) {
        return chr === " ";
    }
    static isTab(chr: string) {
        return chr === "\t";
    }
    static isSpaceOrTab(chr: string) {
        return Parser.isSpace(chr) || Parser.isTab(chr);
    }
    static isWhitespace(chr: string) {
        return Parser.isSpaceOrTab(chr) || Parser.isNewline(chr);
    }
    static isCommentStart(chr: string) {
        return chr === ";";
    }
    static isDigit(chr: string) {
        if (chr === undefined) return false;
        const code = chr.charCodeAt(0);
        return (code >= 48 && code <= 57); // 0-9
    }
    static isBinDigit(chr: string) {
        return chr === "0" || chr === "1";
    }
    static isHexDigit(chr: string) {
        if (chr === undefined) return false;
        const code = chr.charCodeAt(0);
        return (code >= 48 && code <= 57)
            || (code >= 65 && code <= 70)
            || (code >= 97 && code <= 102); // 0-9, a-f, A-F
    }
    static isOctDigit(chr: string) {
        if (chr === undefined) return false;
        const code = chr.charCodeAt(0);
        return code >= 48 && code <= 55; // 0-7
    }
    static isNumberSeparator(chr: string) {
        return chr === "_";
    }
    static isFloatSeparator(chr: string) {
        return chr === ".";
    }
    static isFraction(chr: string) {
        return chr === "/";
    }
    static isExponent(chr: string) {
        return chr === "e" || chr === "E";
    }
    static isBinPrefix(first: string, second: string) {
        return first === "0" && (second === "b" || second === "B");
    }
    static isHexPrefix(first: string, second: string) {
        return first === "0" && (second === "h" || second === "H");
    }
    static isOctPrefix(first: string, second: string) {
        return first === "0" && (second === "o" || second === "O");
    }
    static isNumberSuffix(chr: string) {
        return Parser.isIdentifierCharacter(chr) && !Parser.isFraction(chr) && !Parser.isFloatSeparator(chr);
    }
    static isStringMarker(chr: string) {
        return chr === '"';
    }
    static isQuasistringStart(chr: string) {
        return chr === "`";
    }
    static isQuasistringEnd(chr: string) {
        return Parser.isQuasistringStart(chr) || Parser.isWhitespace(chr);
    }
    static isEscapeCharacter(chr: string) {
        return chr === "\\";
    }
    static isArrayStart(chr: string) {
        return chr === "[";
    }
    static isArrayEnd(chr: string) {
        return chr === "]";
    }
    static isBlockStart(chr: string) {
        return chr === "{";
    }
    static isBlockEnd(chr: string) {
        return chr === "}";
    }
    static isSExprStart(chr: string) {
        return chr === "(";
    }
    static isSExprEnd(chr: string) {
        return chr === ")";
    }
    static isSeparator(chr: string) {
        return chr === ",";
    }
    // Remember to also check for ..., ::, and \\
    static isIdentifierCharacter(chr: string) {
        return chr !== undefined && !Parser.isWhitespace(chr)
            && (
                   chr !== "{" && chr !== "}" && chr !== "(" && chr !== ")" && chr !== "]"
                && chr !== "\\" && chr !== '"' && chr !== "`" && chr !== "," && chr !== ":"
            );
    }
    static isInitialIdentifierCharacter(chr: string) {
        return (chr !== "[" && chr !== "-" && chr !== ">"
            && !Parser.isDigit(chr) && Parser.isIdentifierCharacter(chr));
    }

    static isIdentifier(first: string, second: string) {
        // General case
        return Parser.isInitialIdentifierCharacter(first)
            || (first === "[" && (second === "]" || !Parser.isIdentifierCharacter(second)))
            || (first === "-" && second !== ">")
            || first === "|";
    }

    static isIdentifierBoundary(chr: string) {
        return (chr === "~" || chr === "/" || chr === "." || chr === "|");
    }

    static stringToIdentifierBoundary(chr: string) {
        switch (chr) {
            case "~": return IdentifierBoundary.RTLNamespaceAccess;
            case "/": return IdentifierBoundary.NamespaceAccess;
            case ".": return IdentifierBoundary.InstanceAccess;
            case "|": return IdentifierBoundary.Union;
            default : return "";
        }
    }

    static isPropertySigil(chr: string) {
        return chr === "#" || chr === "." || chr === "&" || chr === ":" || chr === "'" || chr === "\\";
    }
    static isTypeSpecifier(chr: string) {
        return chr === ":" || Parser.isTypeShorthandStart(chr);
    }
    static isTypeShorthandStart(chr: string) {
        return chr === "<";
    }
    static isPropertyTagsStart(first: string, second: string) {
        return first === "#" && second === "[";
    }
    static isPropertyTagsEnd(chr: string) {
        return chr === "]";
    }
    static isPragmaStart(first: string, second: string) {
        return first === "#" && second === "{";
    }
    static isPragmaEnd(chr: string) {
        return chr === "}";
    }
    static isBlockArrow(first: string, second: string) {
        return first === "-" && second === ">";
    }
    static isBlockInput(chr: string) {
        return chr === "|";
    }
    static isEquals(chr: string) {
        return chr === "=";
    }
    static isIndentedBlock(newline: string, space1: string, space2: string) {
        return Parser.isNewline(newline) &&
            (Parser.isTab(space1) || (Parser.isSpace(space1) && Parser.isSpaceOrTab(space2)));
    }

    static sigilToString(sigil: PropertySigil) {
        switch (sigil) {
            case PropertySigil.Function   : return "#";
            case PropertySigil.Value      : return ".";
            case PropertySigil.Reference  : return "&";
            case PropertySigil.Spread     : return "...";
            case PropertySigil.Symbol     : return ":";
            case PropertySigil.TypeSymbol : return "::";
            case PropertySigil.GenericType: return "'";
            case PropertySigil.This       : return "\\";
            case PropertySigil.ThisStatic : return "\\\\";
            default                       : return "";
        }
    }

    // Helpers
    private parseUntilMatch(test: ChrCheck) {
        if (this.eof()) return "";

        let chr = this.current();
        let content = "";
        while (chr !== undefined && !test(chr)) {
            content += chr;
            chr = this.next();
        }
        return content;
    }
    private parseUntilNotMatch(test: ChrCheck) {
        return this.parseUntilMatch((c: string) => !test(c));
    }
}

export {Parser};
