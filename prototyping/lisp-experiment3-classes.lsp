;; source: http://lisp-lang.org/learn/clos

fn description: string obj: int
	format null "The integer ~D" obj

fn description:string obj:float
	format null "The float ~3,3f" obj
	
description 10
description 3.14

class vehicle {
	"The base class of vehicles."
	public speed: real?"The vehicle's current speed."
	class@ vehicle-speed=speed
}

class bicycle extends vehicle
	"A bicycle."
	public mass: real?"The bike's mass." :readonly
	
class canoe extends vehicle
	"A canoe."
	public rowers: int=0?"The number of rowers." :readonly

const canoe (new~canoe speed=10 rowers=6)
class-of canoe ; variable inference
canoe.rowers
canoe.speed ; fn vehicle-speed (obj: vehicle) { return vehicle.speed } due to subclassing works
describe canoe/ ; namespace reference symbol, unlike ., &, and #, is a suffix so / can be a function as well as typical "command system dsls" e.g. /restart-server in a console (not very useful but interesting to allow)


;; http://lisp-lang.org/learn/macros
; no godawful confusing macro system, instead much more interesting function overloading system and general design decisions
; note that while this is a userspace implementation of #while (possible with builtin #forever), it's actually optimized in the vm
fn<> while: void {
	|args: tuple|
	scope = #yield ; each scope gets its own yield so we need to create a reference
				   ; might seem unergonomic but this usecase is quite rare, simply used here to illustrate
	forever {
		if (bool(eval(args))) { ; eval evaluates a tuple in its current state; bindings can change in the yield here
			res = !! scope ;; !! on a function calls it
			;; alternatively: scope() works as well
			; res = scope()
			if res == :break
				return :break
		} else { ; works just fine because of bracketing rules
			return :break
		}
		
	}
}

;; http://lisp-lang.org/learn/lists
; so much for list processor
[1 2 3] ; desugars to (list 1 2 3)
const list [1 2 3] ; variable/fn scope differ
&list[0] ; nth becomes syntetic sugar for .get, here (&list.get 0)
	     ; . would work as well here because it's CoW - it doesn't affect .get (which would require get& - &list.get& 0 or &list[0]&)
= my-list [1 2 3]
my-list[2]= 7 ; []= is a separate op, can't use whitespace, for lists it's sugar for what you see below
= my-list[2]& 7 ;[]& is as well, .get& references the list cell and not its value as a reference (values are always references unless copied or marked as #[[primitive]]
my-list

list/map [1 2 3 4 5 6] #int/even?
; list/map also supports lambdas (yield scope)
list/map [1 2 3 4 5 6] ->#int/even?
; same as
list/map [1 2 3 4 5 6] |num: int| num % 2 == 0 ; binary functions are such a pleasure
; equivalent to
[(int/even? 1) (int/even? 2)] ; ...etc
								  ; scopes are lazily evaluated when printed so this doesn't actually call anything yet, unless !! is used
list/map ["Hello" "world!"] #string/upper

fn mymap: list (in: list, f: function)
; alternatively
; fn mymap: list (in: list) (f: function)
; fn mymap: list (in: list f: function)
; fn mymap: list in: list f: function
; fn (mymap: list) (in: list, f: function)
; because commas are just syntetic sugar, a scope with a single value is just that value, and because fn accepts multiple forms
	out = []
	foreach in
		|value: any|
		out.push! f(value)
	return out

; reduce
list/reduce [1 2 3] #+
; custom function: see above
; psst, since lists are a class they also happen to have .reduce that operates on themselves. classy!
[1 2 3].reduce #+

; we use # explicit syntax here, but we can gather from the type signature that a function is expected so it's not even required
[1 2 3].reduce - ; completely legitimate code without having to use shift on the keyboard once. ergonomics!

[9 2 4 7 3 0 8].sort <
destructure [1 2 3 4 5 6] (first: int second: int ...rest: tuple) ; rest is always a tuple (tuples are a fixed-size list)
	print "First:" first
	print "Second:" second
	print "Rest" rest
	
	
; http://lisp-lang.org/learn/variables
; vars are always local due to scope unless exported, property declarations (on the stack) tend to be used by interested functions though
; e.g.
map {a: true} ; declaration
map {
	const a true
	b=.a
} ; map only contains b
class {
	; need to use public, private
}

; in modules:
export (...)

; custom scopes can be introduced with !! lambda

x = 2
!! (lambda {
	; x = 3 would reference
	const x 1 ; shadow
	; let also exists for this purpose
	let x 3
	; of course, const has a literal '=' in its overload so this works as well (doesn't use the = function)
	const x = 1
	; use #= to assign to the = function (technically "const x =" is legal syntax but it is forbidden in the compiler as it's likely a mistake)
	const x #=
})

;; no need for let*
; dynamic variables
global = "Hi"
fn a: void {print &global} ; Hi
rebind &global = "Bye"
; alternative overloads:
; rebind (&global "Bye") (&other-thing 3)
; rebind &global "Bye" ;; = is just sugar again :)
	a() ; Bye
a() ; Hi

;; Rebind temporarily changes the value of a reference for the duration of the scope and returns the value it had before to it after the scope ends
;; Rebind is just a userland function that does nothing special, similar concepts exist in other languages (other than well, typically variables can't be referenced)
;; in js (here it is hardcoded due to the primitive limitation mentioned above)
;; let glob = "hi"; const a = () => console.log(glob); a(); (() => {let tmp = glob; glob = "bye"; a(); glob = tmp; })();

; http://lisp-lang.org/learn/functions
fn fib: int (n: int)
	"Returns the nth Fibonacci number."
	if < n 2
		return n
	else
		return + fib(n - 1) fib(n - 2)
; with implicit returns:
fn fib: int n: int
	"Returns the nth Fibonacci number."
	if n < 2
		n
	else
		fib(n - 1) + fib (n - 2)

; if the last value in a function's stack (first value specified - don't worry, there's an explicit reference to the start of the stack like a queue) is a lonely string, the fn family of functions sets it to be the function's docstring as in python

fib 30
; fn refs can be called directly
#fib(30)
#fib([30].tuple) ; if the first arg is a tuple it becomes the arg list (implicit apply)
                 ; unless there is a specific overload with explicit tuple as first arg and things after it
; multiple return
;; tuple tuple tuple
fn many: tuple n:int
	return (n (n * 2) (n * 3)) ; lazily evaluated, btw
print many()
print many()[1]
destructure many() (.first: int .second: int .third: int) ; create copies
	print [first second third]
