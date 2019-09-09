import {AST} from '../parser/ast';
import {Scope} from './scope';
import {createRootScope} from './root-scope';

class Program {
    ast: AST;
    root: Scope;

    analyze(ast: AST) {
        this.ast = ast;
        this.root = createRootScope();
    }
}

export {Program};
