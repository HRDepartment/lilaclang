import {Parser} from './parser/parser';

function ast(code: string, file: string) {
    return new Parser().parse(code, file);
}

export {ast};
