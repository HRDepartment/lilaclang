class AST {
    program = new ASTProgram();
    stack: ASTNode[] = [this.program];
    errors: string[] = [];
    accepts = [ASTType.Expression];

    error(msg: string) {
        this.errors.push(msg);
    }

    current() { return this.stack[this.stack.length - 1]; }
    errored() { return this.errors.length > 0; }

    accepting() { return this.accepts[this.accepts.length - 1]; }
    add(elem: ASTElement) {
        if (this.accepting() === ASTType.Atom
                && (!AST.isAtom(elem) && !AST.isComment(elem))) {
            this.error("Expected an atom, instead received an expression.");
        }

        this.current().node(elem);
    }

    comment(type: ASTCommentType, contents: string, pos: Position) {
        this.add(new ASTComment(type, contents, pos));
    }
    string(contents: string, pos: Position) {
        this.add(new ASTString(contents, pos));
    }

    number(num: ASTNumber, pos: Position) {
        num.pos = pos;
        this.add(num);
    }

    property(
        identifier: Identifier,
        sigil: PropertySigil,
        tags: ASTPropertyTags | undefined,
        type: ASTPropertyTypespec | undefined,
        pos: Position
    ) {
        this.add(new ASTProperty(identifier, sigil, tags, type, pos));
    }

    startArray(pos: Position) {
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

    pragma(pragma: string, pos: Position) {
        this.add(new ASTPragma(pragma, pos));
    }

    expression(node: ASTExpression) { this.add(node); }
    block(node: ASTBlock) { this.add(node); }

    trap(work: (node: ASTNode) => void, node = new ASTNode(), type?: ASTType) {
        const isNewNode = this.stack[this.stack.length - 1] !== node;

        if (isNewNode) {
            this.stack.push(node);
            if (type !== undefined) this.accepts.push(type);
        }

        work(node);

        if (isNewNode) {
            if (type !== undefined) this.accepts.pop();
            return this.stack.pop()!;
        }

        return node;
    }

    programHasNodes() { return this.program.nodes.length !== 0; }
    static isAtom(elem: ASTElement): elem is ASTAtom {
        return elem.type === "String" || elem.type === "Array" || elem.type === "Number" || elem.type === "Property";
    }

    static isComment(elem: ASTElement): elem is ASTElement {
        return elem.type === "Comment";
    }

    static isExpression(elem: ASTElement): elem is ASTExpression {
        return elem.type === "Expression";
    }

    static isProperty(elem: ASTElement): elem is ASTProperty {
        return elem.type === "Property";
    }
}

class ASTNode {
    type = "undefined";
    pos: Position = -1;
    nodes: ASTElement[] = [];
    node(node: ASTElement) {
        this.nodes.push(node);
        return this;
    }
    combine(other: ASTElement) {
        if ("nodes" in other) {
            this.nodes.concat(other.nodes);
        } else {
            this.nodes.push(other);
        }
        return this;
    }
}

interface ASTEdge {
    type: string;
    pos: Position;
}

class ASTProgram extends ASTNode {
    type = "Program";
    pos  = 0;
}

class ASTArray extends ASTNode {
    type = "Array";
    constructor(public pos: Position) {
        super();
    }
}

class ASTComment implements ASTEdge {
    type = "Comment";
    constructor(public comment: ASTCommentType, public contents: string, public pos: Position) {}
}

class ASTString implements ASTEdge {
    type = "String";
    constructor(public contents: string, public pos: Position) {}
}

class ASTNumber implements ASTEdge {
    type = "Number";
    repr: ASTNumberRepresentation = {
        int: "",
        float: "",
        exp: "",
        sign: 1,
        expSign: 1,
        suffix: "",
        unit: "",
        type: ASTNumberType.Decimal,
    };
    mode = ASTNumberMode.Integer;
    constructor(kind: ASTNumberType, public pos: Position) {
        this.repr.type = kind;
    }

    digit(digit: string) {
        switch (this.mode) {
            case ASTNumberMode.Integer:
                this.repr.int += digit;
                break;
            case ASTNumberMode.Float:
                this.repr.float += digit;
                break;
            case ASTNumberMode.Exponent:
                this.repr.exp += digit;
                break;
        }
    }

    fraction(fraction: ASTNumber) {
        this.repr.fraction = fraction;
        return this;
    }

    float() {
        this.mode = ASTNumberMode.Float;
        return this;
    }

    exponent(sign: number) {
        this.mode = ASTNumberMode.Exponent;
        this.repr.expSign = sign;
        return this;
    }

    sign(sign: number) {
        this.repr.sign = sign;
        return this;
    }

    suffix(suffix: string) {
        this.repr.suffix = suffix;
        return this;
    }

    unit(unit: string) {
        this.repr.unit = unit;
        return this;
    }
}

class ASTBlock extends ASTNode {
    type = "Block";
    identity: Identifier = [];
    input: ASTProperty[] = [];

    constructor(public pos: Position) {
        super();
    }
    isReference() { return this.identity.length && !this.nodes.length; }
    isScoped() { return this.identity.length && this.nodes.length; }
}

class ASTExpression extends ASTNode {
    type = "Expression";
    constructor(public pos: Position) {
        super();
    }
}

class ASTProperty extends ASTNode {
    type = "Property";

    constructor(
        public identifier: Identifier,
        public sigil: PropertySigil,
        public tags: ASTPropertyTags | undefined,
        public typespec: ASTPropertyTypespec | undefined,
        public pos: Position
    ) {
        super();
    }

    isCall() { return this.nodes.length !== 0; }
    expression() { return this.isCall() && this.nodes[0] as ASTExpression; }
}

class ASTPropertyTypespec implements ASTEdge {
    type = "PropertyTypeSpecification";
    value: ASTElement | undefined = undefined;
    typeId: Identifier[] = []; // a<b<c>> becomes ["a", "b", "c"]

    constructor(public pos: Position) {}
    expr(val: ASTElement) { this.value = val; }
    id(name: Identifier) { this.typeId.push(name); }
}

class ASTPragma implements ASTEdge {
    type = "Pragma";
    constructor(public contents: string, public pos: Position) {}
}

class ASTPropertyTags implements ASTEdge {
    type = "PropertyTags";
    tags: PropertyTags = {};
    constructor(public pos: Position) {}

    tag(tag: PropertyTag) {
        this.tags[tag.name] = tag;
        return this;
    }

    exists(name: string) { return name in this.tags; }
}

type ASTAtom = ASTNumber | ASTString | ASTArray | ASTProperty;
const enum ASTNumberMode {Integer, Float, Exponent}
const enum ASTNumberType {
    Decimal,
    Hex,
    Octal,
    Binary
}

const enum ASTCommentType {
    SingleLine,
    MultiLine
}

type Position = number;
interface PropertyTag {
    name: string;
    value?: string;
}

interface PropertyTags {
    [name: string]: PropertyTag;
}

interface ASTNumberRepresentation {
    int: string;
    float: string;
    exp: string;
    sign: number;
    expSign: number;
    suffix: string;
    unit: string;
    type: ASTNumberType;
    fraction?: ASTNumber;
}

enum ASTType {
    Atom,
    Expression
}

enum PropertySigil {
    None,           // ""
    Function,       // #
    Value,          // .
    Reference,      // &
    Spread,         // ...
    Symbol,         // :
    TypeSymbol,     // ::
    GenericType,    // '
    This,           // \
    ThisStatic      // \\
}

type Identifier = Array<string | ASTExpression | IdentifierBoundary>;
enum IdentifierBoundary {
    InstanceAccess,     // .
    NamespaceAccess,    // /
    RTLNamespaceAccess, // ~
    Union,              // |
    BracketAccess       // [{expression}]
}

type ASTElement = ASTNode | ASTEdge;

export {
    // class
    AST, ASTNode, ASTProgram, ASTComment, ASTExpression, ASTPragma, ASTBlock,
    ASTNumber, ASTString, ASTArray,
    ASTProperty, ASTPropertyTags, ASTPropertyTypespec,
    // enum
    ASTNumberType, ASTCommentType, ASTType, PropertySigil, IdentifierBoundary,
    // type
    ASTAtom, Position, Identifier, PropertyTag, ASTElement
};
