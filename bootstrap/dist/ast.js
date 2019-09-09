"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AST {
    constructor() {
        this.program = new ASTProgram();
        this.stack = [this.program];
        this.errors = [];
        this.accepts = [ASTType.Expression];
    }
    error(msg) {
        this.errors.push(msg);
    }
    current() { return this.stack[this.stack.length - 1]; }
    errored() { return this.errors.length > 0; }
    accepting() { return this.accepts[this.accepts.length - 1]; }
    add(elem) {
        if (this.accepting() === ASTType.Atom
            && (!AST.isAtom(elem) && !AST.isComment(elem))) {
            this.error("Expected an atom, instead received an expression.");
        }
        this.current().node(elem);
    }
    comment(type, contents, pos) {
        this.add(new ASTComment(type, contents, pos));
    }
    string(contents, pos) {
        this.add(new ASTString(contents, pos));
    }
    number(num, pos) {
        num.pos = pos;
        this.add(num);
    }
    property(identifier, sigil, tags, type, pos) {
        this.add(new ASTProperty(identifier, sigil, tags, type, pos));
    }
    startArray(pos) {
        this.stack.push(new ASTArray(pos));
        this.accepts.push(ASTType.Atom);
    }
    endArray() {
        const arr = this.stack.pop();
        if (!arr) {
            throw new Error("AST::endArray: stack underflow");
        }
        this.add(arr);
        this.accepts.pop();
    }
    pragma(pragma, pos) {
        this.add(new ASTPragma(pragma, pos));
    }
    expression(node) { this.add(node); }
    block(node) { this.add(node); }
    trap(work, node = new ASTNode(), type) {
        const isNewNode = this.stack[this.stack.length - 1] !== node;
        if (isNewNode) {
            this.stack.push(node);
            if (type !== undefined)
                this.accepts.push(type);
        }
        work(node);
        if (isNewNode) {
            if (type !== undefined)
                this.accepts.pop();
            return this.stack.pop();
        }
        return node;
    }
    programHasNodes() { return this.program.nodes.length !== 0; }
    static isAtom(elem) {
        return elem.type === "String" || elem.type === "Array" || elem.type === "Number" || elem.type === "Property";
    }
    static isComment(elem) {
        return elem.type === "Comment";
    }
    static isExpression(elem) {
        return elem.type === "Expression";
    }
}
exports.AST = AST;
class ASTNode {
    constructor() {
        this.type = "undefined";
        this.pos = -1;
        this.nodes = [];
    }
    node(node) {
        this.nodes.push(node);
        return this;
    }
    combine(other) {
        if ("nodes" in other) {
            this.nodes.concat(other.nodes);
        }
        else {
            this.nodes.push(other);
        }
        return this;
    }
}
exports.ASTNode = ASTNode;
class ASTProgram extends ASTNode {
    constructor() {
        super(...arguments);
        this.type = "Program";
        this.pos = 0;
    }
}
exports.ASTProgram = ASTProgram;
class ASTArray extends ASTNode {
    constructor(pos) {
        super();
        this.pos = pos;
        this.type = "Array";
    }
}
exports.ASTArray = ASTArray;
class ASTComment {
    constructor(comment, contents, pos) {
        this.comment = comment;
        this.contents = contents;
        this.pos = pos;
        this.type = "Comment";
    }
}
exports.ASTComment = ASTComment;
class ASTString {
    constructor(contents, pos) {
        this.contents = contents;
        this.pos = pos;
        this.type = "String";
    }
}
exports.ASTString = ASTString;
class ASTNumber {
    constructor(kind, pos) {
        this.pos = pos;
        this.type = "Number";
        this.repr = {
            int: "",
            float: "",
            exp: "",
            sign: 1,
            expSign: 1,
            suffix: "",
            unit: "",
            type: 0,
        };
        this.mode = 0;
        this.repr.type = kind;
    }
    digit(digit) {
        switch (this.mode) {
            case 0:
                this.repr.int += digit;
                break;
            case 1:
                this.repr.float += digit;
                break;
            case 2:
                this.repr.exp += digit;
                break;
        }
    }
    fraction(fraction) {
        this.repr.fraction = fraction;
        return this;
    }
    float() {
        this.mode = 1;
        return this;
    }
    exponent(sign) {
        this.mode = 2;
        this.repr.expSign = sign;
        return this;
    }
    sign(sign) {
        this.repr.sign = sign;
        return this;
    }
    suffix(suffix) {
        this.repr.suffix = suffix;
        return this;
    }
    unit(unit) {
        this.repr.unit = unit;
        return this;
    }
}
exports.ASTNumber = ASTNumber;
class ASTBlock extends ASTNode {
    constructor(pos) {
        super();
        this.pos = pos;
        this.type = "Block";
        this.identity = [];
        this.input = [];
    }
    isReference() { return this.identity.length && !this.nodes.length; }
    isScoped() { return this.identity.length && this.nodes.length; }
}
exports.ASTBlock = ASTBlock;
class ASTExpression extends ASTNode {
    constructor(pos) {
        super();
        this.pos = pos;
        this.type = "Expression";
    }
}
exports.ASTExpression = ASTExpression;
class ASTProperty extends ASTNode {
    constructor(identifier, sigil, tags, typespec, pos) {
        super();
        this.identifier = identifier;
        this.sigil = sigil;
        this.tags = tags;
        this.typespec = typespec;
        this.pos = pos;
        this.type = "Property";
    }
    isCall() { return this.nodes.length !== 0; }
    expression() { return this.isCall() && this.nodes[0]; }
}
exports.ASTProperty = ASTProperty;
class ASTPropertyTypespec {
    constructor(pos) {
        this.pos = pos;
        this.type = "PropertyTypeSpecification";
        this.typeExpr = undefined;
        this.typeId = [];
    }
    expr(val) { this.typeExpr = val; }
    id(name) { this.typeId.push(name); }
    value() {
        return this.typeExpr ? this.typeExpr : this.typeId;
    }
}
exports.ASTPropertyTypespec = ASTPropertyTypespec;
class ASTPragma {
    constructor(contents, pos) {
        this.contents = contents;
        this.pos = pos;
        this.type = "Pragma";
    }
}
exports.ASTPragma = ASTPragma;
class ASTPropertyTags {
    constructor(pos) {
        this.pos = pos;
        this.type = "PropertyTags";
        this.tags = {};
    }
    tag(tag) {
        this.tags[tag.name] = tag;
        return this;
    }
    exists(name) { return name in this.tags; }
}
exports.ASTPropertyTags = ASTPropertyTags;
var ASTType;
(function (ASTType) {
    ASTType[ASTType["Atom"] = 0] = "Atom";
    ASTType[ASTType["Expression"] = 1] = "Expression";
})(ASTType || (ASTType = {}));
exports.ASTType = ASTType;
var PropertySigil;
(function (PropertySigil) {
    PropertySigil[PropertySigil["None"] = 0] = "None";
    PropertySigil[PropertySigil["Function"] = 1] = "Function";
    PropertySigil[PropertySigil["Value"] = 2] = "Value";
    PropertySigil[PropertySigil["Reference"] = 3] = "Reference";
    PropertySigil[PropertySigil["Spread"] = 4] = "Spread";
    PropertySigil[PropertySigil["Symbol"] = 5] = "Symbol";
    PropertySigil[PropertySigil["TypeSymbol"] = 6] = "TypeSymbol";
    PropertySigil[PropertySigil["GenericType"] = 7] = "GenericType";
    PropertySigil[PropertySigil["This"] = 8] = "This";
    PropertySigil[PropertySigil["ThisStatic"] = 9] = "ThisStatic";
})(PropertySigil || (PropertySigil = {}));
exports.PropertySigil = PropertySigil;
var IdentifierBoundary;
(function (IdentifierBoundary) {
    IdentifierBoundary[IdentifierBoundary["InstanceAccess"] = 0] = "InstanceAccess";
    IdentifierBoundary[IdentifierBoundary["NamespaceAccess"] = 1] = "NamespaceAccess";
    IdentifierBoundary[IdentifierBoundary["RTLNamespaceAccess"] = 2] = "RTLNamespaceAccess";
    IdentifierBoundary[IdentifierBoundary["BracketAccess"] = 3] = "BracketAccess";
})(IdentifierBoundary || (IdentifierBoundary = {}));
exports.IdentifierBoundary = IdentifierBoundary;
