import { ASTArray, ASTAtom } from "../parser/ast";

type Identity = string;
type Value = ASTAtom;
type Definition = Variable | FunctionDefinition | Namespace;
enum FunctionKind {
    Regular,
    Greedy,
    Ascetic,
    Noop,
    Binary,
    Postfix
}
type FunctionSignature = string[];
class FunctionDefinition {
    identity: Identity;
    type: FunctionKind;
    signature: FunctionSignature;
}

enum TypePrimitive {
    String,
    Boolean,
    Symbol,
    TypeSymbol,
    Int16,
    int32,
    Int64,
    Uint16,
    Uint32,
    Uint64,
    Float32,
    Float64,
    Fraction,
    Void
}

class TypeDefinition {
    identity: Identity;
    reference?: TypeDefinition | TypePrimitive;
    fields?: Map<Identity, TypeDefinition>;
}

class Variable {
    identity: Identity;
    tags: string[] = [];
    type?: TypeDefinition;
    value?: Value;
}

class ScopeBase {
    vars: Variable[] = [];
    fns: FunctionDefinition[] = []; // todo: bucket by name
    namespaces: Namespace[] = [];
    types: TypeDefinition[] = [];
    stack: Definition[]     = [];

    fn(fndef: FunctionDefinition) {
        this.fns.push(fndef);
        this.stack.push(fndef);
    }

    ns(nsdef: Namespace) {
        this.namespaces.push(nsdef);
        this.stack.push(nsdef);
    }

    var(vardef: Variable) {
        this.vars.push(vardef);
        this.stack.push(vardef);
    }
}

class Namespace extends ScopeBase {}

class Scope extends ScopeBase {
    constructor(public parent?: Scope) {super();}
}

export {Scope};
