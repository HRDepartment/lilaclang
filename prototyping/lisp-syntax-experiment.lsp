;; Numbers
42 ; int
42i ; int
42u ; unsigned int
42i16 42i32 42i64
42u16 42u32 42u64
42b ; byte
42bu ; unsigned byte

40 + 0b10 ; 42 
0b111
0xfaf
0o777
c(42 2) ; todo - complex numbers

;; Strings
"Unicode strings by default (UTF-8)"
`strings-that-last-until-a-new-line-or-space
%w(Words separated by spaces must be valid identifiers so no colons sorry) ; uses the core/%w library function
"Strings are
multiline by default"
map
	a: "Indent
		is ignored till the space of the definition"
	exception: "When
\		the line starts with a backslash followed by a whitespace. An additional whitespace is inserted to replace the backslash."
chr("C")
chr C
; character literals are created using either a string or an identifier + the core/chr library function

;; Booleans
true
false
; Null does not exist. '() returns false, 


;; Matching + Option)
;; TODO
A = 30
B = match A
	[1 2 3 4] => 20
	5 => 30
	5 => 30
	6 => 70
	; one of the defined type symbols
	:i32 => 100
	
	; => is a binary operator that creates a core/relation, match reads these from the yield stack
; how? in normal lisp this would be written as
(def B (match A
	(=> (list 1 2 3 4) 20)
	(=> :i32 100)
	; etc
))

fn= | (t: type, t2: type) {}

type None: void
class Some<'t>
	value: 't
class Option<'t>
	value: 't | None

name = Option/new<string>

match name
	typeof Some => println("Result: {}", name.value)
	typeof None => println("no value")

fn each (values<tuple>) "as"
	cur = 0
	len = values.length
	while (cur < len)
		yield values[cur]
		cur += 1

;; TODO: spec for yield
fn import (...props<bindable~property>) "from" (file<string>)
	module = module/load-file file
	each props -> |prop|
		prop.bind(module.resolve(prop.name))

import (names other-names) from './file'
;; different from
import(names other-names) from './file'

sort! (combine a b) using-fn
sort (fold! a b) using-fn
sort! a #using

class list
	fn new (size: int{1})

;; Specifiers
; string till next space or newline (any other character is legal except `)
print `long-string
print `long "ok"
; create a reference binding and pass ref
print scope-ref
print &scope-ref ; explici
; tuples can introduce scope references
import (scope-ref, scope-ref2) from `scope.txt
; pass copy value from variable scope (must exist in scope)
print .value
; pass value from function scope (explicit, can be useful for epistles)
; functions are always immutable so they're passed by ref
print #print
; pass value from instance scope (reference)
print \value
print \&value
; (value)
print \.value
; access property
;; ref
print value.ok
print &value.ok
;; value (of value.ok)
print .value.ok
; access ns property (class is ns with new method)
print value/ok
print Audio/ok
; rtl ns access
print ok~Audio ; Audio/ok
print new~Audio ; Audio/new
; symbols
print :ok
;; type symbols (type scope)
print ::Audio
print ::core/Exception
print (typeof(audio-inst) == ::Audio) ; true
;; print is actually an ascetic function (opposite of greedy), so it doesn't require brackets
print typeof(audio-inst) == ::Audio
; classes create both a type and namespace of the same name
;; ascetic functions can only receive a single argument and cannot have a greedy overload,
;; however they may have a multi-argument overload (requiring a tuple call)
; tuple calls
;; if the sole argument to a function is a tuple, it is used as the entire argument list
;; use a real list ([]) to pass multiple arguments or use multiple tuples
print ("a", "b") ;; called as (print "a" "b") producing a b
print ("a", "b"), "c" ;; called as (print ("a", "b") "c") producing ab c

;; #[[]] creates tags (must preceed ref)
;; tags are defined by the language (non-extendable), but a custom(data=any) exists
;*
multiline comment
*;

;; 3 types of tags
;; [optional]
;; [type=::TypeName]
;; [deprecated(msg="A", since="B")]
#[[optional] [deprecated(msg="Don't use!")]]\long = 'ok' ;; also adds auto-induced #[[type=::string]]

;; pragmas
#{path+=my-dsl} ; adds the namespace my-dsl to the implicit resolver (defaults to just 'core')

; introduce value into variable scope
; lone properties can only be inspected by yield and do not define a lexical reference
; properties referenced inside a function call without a block become lexically bound to this scope (like: import, const, =)
; properties referenced inside a function call with a block become lexically bound to that block's scope (like: fn)
a = 2
def a 2
import x from `scope.txt

;; Property declarations
; Properties are a first class value; they are present in scopes and may be passed to functions. Properties may have tags, along with its accompanying syntactic sugar, such as types.
; Properties can be read out of a yield scope or when passed into a function.

;; Type declarations
; Properties may have a default value, using :, and an explicit type, using <>. If there is only a default value and that can be
; resolved to the type scope (sigil ::), it becomes the property's type instead of it's
; default value. Types are defined using the 'type' function.
; If a property exists in the type scope and it is referred to ambiguously (without sigils), it is used:
a: int ; int exists in type scope, a becomes type 'int'

; There are two ways to explicitly reference a type:
a<int>
a: ::int
a:::int ;; the space after : is optional

; The <> shorthand form can be combined with :, in which case the default value part cannot be a type as well.
int = true ; defines a variable
a<bool>: int ; Here, a would be of type bool, with value Property(int), which gets resolved to be a variable scope reference (&int)

b: true ; #[[default=true][type=:bool]]b ; type inference with a value
; Strings, lists, and numbers are always a value
c: "Hello world!"
d: [1 2 3] ; list with a default value of [1, 2, 3]
e: [ ] ; empty list requires a space because of the [] function
f: 123
; Classes can be (lazily) instantiated using the {} syntax after a property. This is different from a block.
; The name of a namespace with a new fn (so, a class) must be specified, with args inside the {}.
; A block can be specified inside this as well.
g: Audio{"./beep.mp3" volume: 90} ; #[[default=(Audio/new "./beep.mp3" volume:90)][type=::Audio]]
h: Thread{} ; Thread/new()
i: map{{b: true}} ; map/new(->{b: true})

; Default values are used in e.g. maps (map is a function which transforms its yield scope into a map)
map
	b: true
; const has two forms:
const x = map {b: true} ; with '=' as property literal
const x map {b: true}

; using a property declaration with default value
const y: 3i64
const y: "String"
const y: map{{b: true a: int}} ; requires a second {} to pass the block required by map
								; #[[default=(map/new ->{(b: true) (a: int)})][type=::map]]
								; map as a function is just an alias of map/new (which is in the namespace map/ -- namespaces can be referenced as obj with the / suffix, similar to & and . prefixes)

;; Functions
; Functions are defined with the 'fn' function:
fn fn-name (arg: any)
	print arg
; After the function symbol, input args and preconditions may be supplied as one or more tuples.
fn name1 (arg1: any) (arg2: any) {}
fn name1 (arg1: any, arg2: any) {} ; equivalent

; Preconditions can be supplied by passing a function (that must be matched to reach this overload -- > is the [binary] function here).
; This is possible because tuples are lazily evaluated but may be
; observed before being executed (quite the twist on quantum mechanics)
; In the presence of a precondition, the specific overload becomes a dispatcher (e.g. if there is another overload with arg < 3, then preload(int) would
; basically become an if/else for precond1 and precond2). This may of course be inlined.
fn precond (arg: int) (arg > 3) {}

; Literals (macro-like syntax)
; Functions may be matched by literals. Strings match properties, numbers and symbols match themselves.
type TableType {
	name: int
	type: TYPE/ok
}

fn INSERT "INTO TABLE" (table: string, map: map<TableType>)
	db.insert table map

INSERT INTO TABLE `name (map {
	name: 1
	type: TYPE/ok
})

; Here, "INTO TABLE" means this overload of "INSERT" expects a property called INTO followed by a property called TABLE. Types are ignored.

; Matching by literal number:
fn fib 0 {0} ; here, equivalent to fn fib (n: 0) {0} because functions match on default values as well
		     ; which is equivalent to fn fib (n: int) (n == 0) {0}
			 ; note that fib n: 0 wouldn't work
fn fib 1 {1}
fn fib (n: int) (n >= 2) {fib(n - 1) + fib(n - 2)}

fn create (type: "sandwich", tomatoes: int) ->) ; implementation
fn create (type: "pancake", strawberries: int) ->) ; implementation
create "sandwich" 3 ; or create type: "sandwich" tomatoes: 3
create "pancake" 4
; this wouldn't work:
create type: "pancake" tomatoes: 3
; because there is no overload that accepts a 'tomatoes' property for type: "pancake"
; All args are actually both positional and keyword arguments, see the 'named args' section below.

;; Any of the valid block syntaxes are supported. The above may also be written as:
fn fn-name (arg: any) {
	print arg
}
fn fn-name arg: any {print arg}
fn fn-name arg:any ->) print arg
; |vars| specifies the block inputs. An empty space creates a block that receives no arguments.
; Note that because the -> syntax yields both variables defined in the body and in order (making them available in ordered | | format too, see:)
fn fn-name (arg: any) -> |a: any| print a ; same as above
; the following is acceptable as well:
fn fn-name arg: any ->print
; fn receives a block that is equivalent to print and any block inputs are used as its positional args;
; this code is equivalent to a function alias (covered later), except the fact that it only receives one argument instead of an arbitary amount
fn@ fn-name: #print
; An indented block, in any context, even s-exprs:
fn fn-name arg:any ->
	print arg
(fn fn-name arg: any ->
	print arg)
; This is the only way to have whitespace-significance behavior inside an s-expr.

; The -> syntax is what powers blocks and yield. -> is typically implicit but it supports several forms that allow it to have great explicit utility as well.
; The same arity as the original function overload is maintained of course, with defaults filled in as expected.

; Blocks may be 'yield'ed values. Any bound names in its calling syntax are available in the block (here, 'arg' would be a property in the block),
; as well as additional values. fn doesn't actually do this, but other functions can, for example:
fn each (list: list) {
	at = 0
	; normally need to explicitly reference a variable here unless it is unambiguously a variable in an overload
	; but the function 'list' does not have the .[] or .length properties, so we are certain it refers to the variable here.
	len = list.length
	forever {
		if at >= len
			return ; return only affects the block it is called in
		yield list[len]
		at += 1
	}
} ; implicitly returns void
; Simply said, yield passes something to the block passed to the function, and return exits (and potentially returns from) a block.
; This allows yield to work in other blocks as well because it's something unique to the fn. Of course, functions may define nested fns as well,
; for which a specific yield ancestor syntax exists (yield.[] where yield[-1] returns the parent's yield)

;; Psst, this works too (for function + exclusive ranges using the ..  binary operator)
;; Here, an example of the block syntax is presented as well.
fn each list:list {for 0 .. list.length -> |at: int| yield list[at]}

each [1 2 3] -> |val: int| print val ; prints 1\n2\n3
; equivalent to
(#each [1 2 3] ->|val:int|{ ; (-> is the special "block pass" syntax; even lambda is passed a block which it yields with the vars in scope)
	(#print &val) ; # refers to a function, & to a reference - this is of course implicit in the above code
	; normally # creates a reference, however an explicit # as the first value results in a function call unless the succeeding value is either an implicit postfix or binary function
	; therefore this fn # rewriting isn't as simple as it looks
})

; The function may also have a return type. By default type inference is attempted.
fn fn-name:void arg:any ->) print arg ; same as above
; The return type must match the returned type, unless it is "void". Functions that have void as a return type always return nothing.

;; Named args
; Named args are properties with a default value, used to pass a variable by name. Normally all functions have ordered params but
; they may be called by their name in the signature as well, in any order. This makes function signatures name-sensitive. This behavior only applies to regular functions.
fn add (a: int, b: int, c: int) {a + b + c}
add 1 2 3 ; 6
add a:1 c:4 b:2 ; 1 + 2 + 4 = 7

; To require an argument to be named, typed spread args may be used:
fn list (...values: any, length: int(0)) { ;* ... *; }
; Args after a spread must be named and will not be included in the spread, even if its type is (indirectly) "any".
; Multiple spread args are allowed as well and may even capture the same type:
fn add (...strings: string, ...nums: int, ...both: string|int) {} ; Using a union type here. Note that the rest arg automatically becomes a tuple, you merely specify the individual element type.
; Spread args cannot be passed by name.

; The '...' sigil can be used to signify that all further args are positionals and cannot be passed by name:
fn positional (... one: int two: int) {}
fn pos ... (one: int two: int) {}

;; Multiple function names can be specified by making the first passed argument to fn a tuple of properties instead of just a single property
fn (*, multiply) (first:int, second: int) {}
;; (* multiply mult ) etc. would work as well
;; Defines both fn * and fn multiply with equivalent functionality.


;; Named args are passed as simple properties to non-regular functions (yield, greedy, ascentic, and swallow functions) in the position they are present.

;; A regular function tries to group its arguments if it encounters a potential binary function.
; Binary functions must be referenced directly using # if necessary.
fn assert-two: void (a: bool) (b: bool)
assert-two a && b c && d ; same as (assert-two (&& a b) (&& c d)) or assert-two (a && b), (c && d) or assert-two(a && b, c && d)
; This overload is ok because && returns a bool.


; Greedy function
;; Absorbs all arguments passed into it into separate variables
;; A greedy function cannot have an ascetic overload (and vice-versa), but can
;; have multiple greedy overloads depending on params passed
;;; 
fn-greedy greedy: void (var: any) (op: function) (var2: any) {}
; aka fn*
greedy a == b ; becomes (greedy &a #== &b)
;; Calls can still be forced using tuple syntax
greedy(a == b, #==, d) ; (becomes (greedy (== a b) #== d))
greedy (a == b) #== d ; same

;; Note how function calls are whitespace-sensitive:
;; greedy (a == b) #== d desugars to a tuple
;; whereas greedy(...) literally passes a tuple


; Ascetic function
;;; Absorbs all arguments passed into it into a single property
fn-ascetic ascetic: void (all: bool)
; aka fn?
ascetic a == b ; becomes (ascetic (== a b))
ascetic a #== b ; error, (a, #==, b) does not condense down to 'bool'
ascetic true ; (true) is bool

;;; Ascetic functions can only receive a yield block by explicit arrow in a tuple
ascetic lambda {
	print "hi"
} ; passes the lambda plus its block to 'ascetic'
; becomes (ascetic (lambda ->{(print "hi")}))
; for other function types it would become (fn #lambda ->{(print "hi"))
; Therefore yield in ascetic functions is discouraged. This would work, however:
ascetic true, ->{
	print "hi"
} ; using explicit comma

; Binary function
;;; A binary function pushes a future to the stack awaiting one more argument and then consumes the last two arguments
fn-binary plus: int (a: int) (b: int)
	return (add a b)
; aka fn=
a plus b ; a + b

; Postfix functions
;; A postfix function is like a binary function but does not push a future, instead it simply consumes x arguments on the stack.
;; The first argument of a postfix function is the number of args it consumes. If it is omitted, it is assumed to be 1.
;; The stack must not already be executing a function (such as a leading function). Postfix functions are only used if they are preceded by the required number of values.
;; This property also means that postfix can be overloaded, prioritized by the highest amount of arguments possible.
;;; Assuming there are 4 overloads: 4, 3, 2, 1
;; Values on stack | Overload used | Values on stack after
;;         5       |       4       |           2
;;         4       |       4       |           1
;;         2       |       2       |           4
;;         0       |  Regular fn   |         0 or 1
fn-postfix 2 add (first: int, second: int) {first + second}
; aka fn>
1 2 add ; 3
; This would be the same as (see later)
fn@ add:#+ :postfix

fn-decorator static {
	static: true
}
; aka fn#

;; !! function
; Because arguments are all lazily evaluated (evaluated when they are first accessed in the function), having a way to force execution can be useful for certain paradigms.
; The !! function is an identity function defined with #[[eager_eval]] (so fn? #[[eager_eval]]!!:any) so its operands are eagerly executed (enforced in vm)
true || !!(print-and-ret "a")
; Normally || (or) has short-circuit behavior due to lazy evaluation, however here it is forced. !! merely returns what it is given but it is executed eagerly, unlike a normal identity function.
fn #[[eager_eval]]print-eager: void (value: any) {}
;; full definition:
fn? #[[eager_eval]] !!: any (in: any)
	return in
fn? #[[eager_eval]] !!: any (in: callable~tuple) ; core/tuple/callable is a specialization of tuple where its execution results in a different tuple
	return in()

;; Function aliasing
fn-alias name: #original-name ; property: #of
; aka fn@

;; fn@ also supports casting:
fn@ name: #origin :postfix ; becomes a postfix function with x arguments and must accept more than 0 args
fn@ name: #origin :binary  ; becomes a binary function and must accept at least 2 args, further ones are ignored
;; For binary and postfix functions, spread args are ignored if the arg requirement is met (postfix: args other than the spread one, binary: after 2 named/positionals)
;; As expected, name args become positionals (same as ... args using the '...' placeholder)
fn@ name: #origin :regular
fn@ name: #origin :greedy
fn@ name: #origin :ascetic
;; Remember that ascetic and greedy functions cannot co-exist
;; There is no casting to a no-op fn.
;; Casting also allows you to create a copy of a function so it can be used in multiple contexts:
fn@ origin :postfix ; creates a postfix #origin out of #origin
; whitespace sensitive! fn@ origin:postfix would create a function called 'origin' linked to the function 'postfix'

;; No-op function
;; No-op functions do nothing when called and can accept an arbitrary number of arguments, but nothing is done with them.
fn-noop end "Docstring."
; aka fn--

; Enables the following syntax:
lambda
	print 1
end


;; Function call priority:
; 0. Check if the name is also available in the variable scope (e.g. map yield function and map variable) - if so, try to ignore errors and use the variable instead.
; 1. Greedy functions with a matching signature (fn!)
; 2. Regular functions with a matching signature (fn)
; 3. Ascetic functions with a matching signature (fn?)
; 4. No-op function (fn--)
; X. Binary/postfix functions (fn=, fn>) are a special case; they error if the preceding value on the stack is not a value (functions can be made into values with # syntax)
; Y. Last: scope variable

;;; Neither yield nor binary functions error if the name is available in variable scope too.
;; Important note with nested yield functions: the first encountered function will be passed the block. to pass a block to yield fns after that you will need to create a scope
;; e.g do-work-with (map{name=1}) { |name: int| print(name) print(2) }

; Functions that (can possibly) accept no arguments are called when they are encountered, effectively treated as values.
; To pass a zero-arg function like this an explicit # must be used.
fn print-false {print false}
print print-false ; "void" - (print (print-false))
print #print-false ; "function print-false" (print (#print-false))

;; The following symbols are forbidden in property declarations (and therefore variables and functions):
; (){}, [ followed by [
;; ~ rewrite rules:
; ~: forbidden after the first character (as a~b refers to b/a e.g. new~Exception is desugared to Exception/new)
;; ok: ~ function (binary not) - only legal if it is the only symbol in the name
;; ok: first character ~: ~private-name (~private-name~Class becomes Class/~private-name)
;; ~~Math would desugar to Math/~
;; Indirectly (through other syntax):
; /: forbidden after the first character (/ok is fine, becomes Class//ok)
; always forbidden: {}:,\#
; < (lone ok) not directly following at least one of < or > , << and <> are ok, a < b is ok
; [ (lone ok) not directly following at least one ]: [] is ok, [ is ok, [[ forbidden, [a forbidden
; . (lone ok) not directly following at least one .: .. is ok, a . b is ok, ..= is ok, .fnname is not ok fn.name something else
; (indirectly) ... following any other character (name... is ok, ...name is not, because it's considered a spread variable)
;; ... following  another ".": ....name is invalid
; & (lone ok) not directly following at least one &
;; Note: .&= are ok if they are the last character in the declaration as well

;; Note: [tuple, value] desugars to .[](tuple, value) or [tuple] -> .[](tuple) e.g. class.names[1] becomes class.names.[](1)
;; Therefore [] is ok (brackets[] is a valid function name, but brackets[1] would desugar to brackets.[](1)
;; Note: [name]= value becomes .[]=(name, value)
;; (class.names["Tutorial"]= "completed") becomes (class.names.[]=("Tutorial", "completed"))


; Global variables don't exist. Variables are scoped and can be imported and exported.
; Namespaces and classes are forward-declared,
; but classes that implement [] can return additional properties at runtime (think maps).
; If something cannot be resolved, the immutable environment-provided namespace 'core' is searched instead.
; Further namespaces can be searched by the compiler with the pragma #{path+=namespace-name} in a scope. This pragma does not leak.
namespace example
	fn print-true {print true}

fn test 
	print-true ; not found
	#{path+=example}
	print-true ; example/print-true
test
print-true ; not found


; |> chaining
fn= |> (left: any, right: function) { right left }
"Hello world!" |> print ; print "Hello world!"
("Hello" "world!") |> print ; print("Hello" "world!")

;; Code as data
; Typical of lisp is for code to also be treated like data. The special ' or quote function can be used for this purpose (note: it is a function, not special syntax)
; The returned value is an object, not a string representation (although that may be requested)
' (1 2 3) ; core/tuple(1, 2, 3)
' 123i ; core/int(123)
' list 1 2 3 ; core/tuple(core/#list, 1, 2, 3)
' name = (1 2 3) ; core/tuple(name: tuple, core/#=, core/tuple(1, 2, 3))
quote "foo" ; core/string("foo")
quote 1
quote [1 2 3] ; core/list(length: 3, 1, 2, 3)

;; Classes
; Defined with the class function, taking a property which will become a namespace.
; Classes are created with class-name/new, which can be overwritten by defining a function which may be overloaded called 'new'.
class Point
	; Property definitions are public by default:
	x: int
	y: int
	
	; Private properties are only visible to this class
	private x: int
	private y: int
	; Or in a batch:
	private
		x: int
		y: int
	
	;; These two forms are accessible as \name, e.g. \x
	
	; 'let' is available as well which creates a #[[local]] binding, essentially a private static property that is
	; accessible in all the closures here, and is global throughout all class instances.
	let x: int
	let y: 4
	;; Note that because lone property declarations are something completely different, 
	
	; Static fields are available on the namespace as a property, lazily executed as everything else and can therefore be self-referencing.
	static p: Point{2 3}
	; Eager execution is available using the !! function
	static m: (!! map{x: int y: int})
	
	; Initializer
	;; new becomes a static function which creates an instance
	;; other functions have an implied 'this' (\) too, and become a part of the instance
	fn new (name: string, age: int{0})
		; Access the class instance using \
		\name = name
		\age = age
	; This works because Point/new refers to a wrapper that calls this 'new' with a contextual block call:
	(new ->(instance){ block }) ; and \name will reference instance.name
	; This works with all functions declared here:
	Point/
	;; This shorter form does the same:
	fn new (\name: string, \age: int(0)) {} ; the {} is required to signal an empty block
	
	; Setter
	;; Manually:
	fn x= (x: int) {\x = x}
	; or just
	fn x= (\x: int) {}
	fn x {\x}
	
	;; Automatically:
	class/accessor x ; x and x= pair
	; or
	class/reader x ; just x
	class/writer x ; just x=
	
	; 'class methods' are static methods
	static
		fn say (msg: string) {puts msg}
		
	; Static also has an ascetic overload so you can just do static fn say (msg: string) {puts msg} for a single function
	
	;; \\ refers to this class's namespace (static) (Point/ here).
	fn singleton {\\p} ; The first time this method would be called, the static property is evaluated.
;; Functions like private/static blocks and class/accessor just 'work' because
; they push their return value to the stack, which is then read to create the class. This allows class to be fully implementable in userspace.




; Control flow structures
;; Primitives: return, yield, break
; return yields its value to the top-most visible block lexically and returns the control flow to it,
; with the block considered done, akin to break.
;; considered a primitive block
map {
	return prop: 3
} ; map receives prop: 3 and exits
;; considered a dynamic block
map {
	if stats/random < 0.5 {
		return p: 3
	}
	c: 4
} ;; 50% of the time, contains p: 3, the other time it contains c: 4
map {
	if true
		if true
			return a: 1
		return b: 2
	return c: 3
} ;; will always contain just a: 1

;; Primitive blocks contain only primitive values (properties, numbers, strings, arrays of the previous), no function calls are permitted.
;; A primitive block can be constructed at compile-time, a dynamic block is constructed at runtime.

; Because return has lexical semantics, it can freely be used in functions without affecting any other environments
fn this-returns {
	if stats/random > 0.3 ->) return
}

map {
	this-returns
	a: 1
	b: 2
} ; Considered a dynamic block, but will always contain a: 1 and b: 2. The return does not affect anything in the map block.

; return makes use of the value, result feature. There are in essence 2 stacks. The value stack determines the current value,
; for implicit return as well as just generally being readable. The result stack contains the result of previous operations.
; if/else can be modeled with if failing if the case didn't match, and else acting upon it. This paradigm easily enables exceptions as well.
; if/else push the last value to the value scope (enabling implicit returns), and their success to the result scope.
; A database could do the same, such that if a connection fails, it can be investigated using else, or catch (which accepts an exception arg, optionally typed to match)
; Allowing Optionals, nulls, and exceptions to co-exist is a typical goal of this language, being a jack-of-all-trades, using the language however you choose it.
;; TODO

; yield yields a value to the parent scope. The parent scope may optionally resume this scope, as if it were a generator.
let hex: (for<array<string>> n:int in 0 .. 10
	yield int/to-hex-string n
) ;; returning an array of strings, resuming the scope on each iteration
if 0xC
	yield 1
	yield 2
	yield 3
; only returns 1, because if does not resume the generator. it is effectively the same as break here.

; break is like yield but also ceases the execution of the block. Any code after break is always considered dead code.
for n:int in 0 .. 10
	if n == 5
		break
	print n
; prints 01234