; src: https://learnxinyminutes.com/docs/ruby/
; This is a comment

;*
This is a multiline comment
No-one uses them
You shouldn't either
*;

; First and foremost: Everything is an object.

; Numbers are objects
; no

; 3.class ; errors, number is not an object

3->string ; type conversion, passes block with {}


; Some basic arithmetic
1 + 1 ; 2
8 - 1 ; 7
10 * 2 ; 20
35 / 5 ; 7
2 ** 5 ; 32 - note: spaces required
5 % 3 ; 2

; Bitwise operators
3 & 5 ; 1
3 | 5 ; 7
3 ^ 5 ; 6

; Arithmetic is just syntactic sugar
; for calling a method on an object
;1.+(3) ;=> 4
;10.* 5 ;=> 50
; no, but that would be valid syntax for a complex type

; Special values are objects
null ; null is preferred
nil ; equivalent to false, not null
true ; truth
false ; falsehood
t ; lisp classic supported too

; primitives are not objects
;nil.class ;=> NilClass
;true.class ;=> TrueClass
;false.class ;=> FalseClass

; Equality
1 == 1 ; true
2 == 1 ; false
; supports a block as well as a shortcut for if (only executed if true),  pushes false to stack otherwise so else can be used
1 == 1 {
	print "true"
}

; Inequality
1 != 1 ; false
2 != 1 ; true

; apart from false itself, nil is the only other 'falsey' value

; space required
! nil   ; true
! false ; true
! true ; false
! null ; true
! 0     ; false

; More comparisons
1 < 10 ; true
1 > 10 ; false
2 <= 2 ; true
2 >= 2 ; true

; Combined comparison operator
1 <=> 10 ; -1
10 <=> 1 ; 1
1 <=> 1 ; 0

; Logical operators
true && false ; false
true || false ; true
! true ; false

; There are alternate versions of the logical operators with much lower
; precedence. These are meant to be used as flow-control constructs to chain
; statements together until one of them returns true or false.

;; redundant section, this is normal short-circuit behavior with && and ||
;; `do_something_else` only called if `do_something` succeeds.
;do_something() and do_something_else()
;; `log_error` only called if `do_something` fails.
;do_something() or log_error()


; Strings are objects
;; strings and characters are separate types
class-of "I am a string" ; ::core/string
class-of "I am a string too" ; ::core/string

;; note: no single quotes
placeholder = "use string interpolation"
;; #{} string interp supported, use \ as escape
"I can #{placeholder} when using double quoted strings"
;; "I can use string interpolation when using double quoted strings"

; Prefer single quoted strings to double quoted ones where possible
;; does not apply
; Double quoted strings perform additional inner calculations
;; pre-processed

; Combine strings, but not with numbers
;; + actually has a string and number overload so this is not an issue
;; but it is true that there is no implicit conversion; use ->type
"hello" + "world" ; "hello world"
;'hello ' + 'world'  ;=> "hello world"
;'hello ' + 3 ;=> TypeError: can't convert Fixnum into String
;'hello ' + 3.to_s ;=> "hello 3"
"hello" + 3 ; "hello 3"
"hello" + 3->string ; "hello 3"

; Combine strings and operators
"hello " * 3 ; "hello hello hello "

; Append to string
;; note: one of the only mutating functions without ! suffix, omitted due to historic compatibility with other languages
"hello" << " world" ; "hello world"

; print to the output with a newline at the end
; puts "I'm printing!"
; ;=> I'm printing!
; ;=> nil

; ; print to the output without a newline
; print "I'm printing!"
; ;=> I'm printing! => nil

; see println and print (equiv to puts and print)

; Variables
x = 25 ; 25
x ; 25

; Note that assignment returns the value assigned
; This means you can do multiple assignment:
;x = y = 10 ;=> 10
;x ;=> 10
;y ;=> 10
;; requires parens
x = (y = 10) ; 10
x ; 10
y ; 10

; By convention, use snake_case for variable names
;snake_case = true
;; no, use-this-case

; Use descriptive variable names
;path_to_project_root = '/good/name/'
;path = '/bad/name/'

; Symbols (are objects)
; Symbols are immutable, reusable constants represented internally by an
; integer value. They're often used instead of strings to efficiently convey
; specific, meaningful values
;; yes, but being a primitive it doesn't support .'s again
;:pending.class ;=> Symbol

status = :pending

status == :pending ; true

status == "pending" ; false

status == :approved ; false

; Arrays

; This is an array
array = [1, 2, 3, 4, 5] ; [1, 2, 3, 4, 5]

; Arrays can contain different types of items

[1, 'hello', false] ; [1, "hello", false]

; Arrays can be indexed
; From the front
array[0] ;=> 1
array.first ;=> 1
array[12] ;=> nil

; Like arithmetic, [var] access
; is just syntactic sugar
; for calling a method [] on an object
array.[] 0 ;=> 1
array.[] 12 ;=> nil

; From the end
array[-1] ;=> 5
array.last ;=> 5

; With a start index and length
array[2, 3] ;=> [3, 4, 5]

; Reverse an Array
a=[1,2,3]
a.reverse! ;=> [3,2,1]

; Or with a range
;; requires spaces as .. is an operator returning a range
array[1 .. 3] ;=> [2, 3, 4]

; Add to an array like this
array << 6 ;=> [1, 2, 3, 4, 5, 6]
; Or like this
;; requires !
array.push!(6) ;=> [1, 2, 3, 4, 5, 6]

; Check if an item exists in an array
array.include?(1) ;=> true

; Hashes are Ruby's primary dictionary with key/value pairs.
; Hashes are denoted with curly braces:
;; map syntax differs
hash = map { color="green" number=5 }
hash.keys ;=> ['color', 'number']

; Hashes can be quickly looked up by key:
hash[`color] ;=> 'green'
hash[`number] ;=> 5

; Asking a hash for a key that doesn't exist returns nil:
;; null
hash["nothing here"] ;=> null

; Since Ruby 1.9, there's a special syntax when using symbols as keys:

;new_hash = { defcon: 3, action: true }

;new_hash.keys ;=> [:defcon, :action]

;;; TODO
new_hash = map { :defcon=3 :action=true }

; Check existence of keys and values in hash
new_hash.key?(:defcon) ;=> true
new_hash.value?(3) ;=> true

; Tip: Both Arrays and Hashes are Enumerable
; They share a lot of useful methods such as each, map, count, and more

; Control structures

if true
  'if statement'
elseif false
  ;'else if, optional'
else
  ;'else, also optional'
;end

for counter in 1 .. 5
  puts "iteration ;{counter}"
end
;=> iteration 1
;=> iteration 2
;=> iteration 3
;=> iteration 4
;=> iteration 5

; HOWEVER, No-one uses for loops.
; Instead you should use the "each" method and pass it a block.
; A block is a bunch of code that you can pass to a method like "each".
; It is analogous to lambdas, anonymous functions or closures in other
; programming languages.
;
; The "each" method of a range runs the block once for each element of the range.
; The block is passed a counter as a parameter.
; Calling the "each" method with a block looks like this:

;;; |names| creates an implicit yield block even if it isn't indented
(1 .. 5).each |counter: int|
  puts "iteration #{counter}"
; (1 .. 5).each(|counter: int| puts "iteration") works as well; the | | syntax accepts 1 statement
; end
;=> iteration 1
;=> iteration 2
;=> iteration 3
;=> iteration 4
;=> iteration 5

; You can also surround blocks in curly brackets:
(1 .. 5).each { |counter| puts "iteration #{counter}" }
;; alternative syntax

; The contents of data structures can also be iterated using each.
array.each |element|
  puts "#{element} is part of the array"
;end
hash.each |key, value|
  puts "#{key} is #{value}"
;end

; If you still need an index you can use "each_with_index" and define an index
; variable
array.each_with_index |element, index|
  puts "#{element} is number #{index} in the array"
;end

counter = 1
while counter <= 5
  puts "iteration #{counter}"
  counter += 1
;end
;=> iteration 1
;=> iteration 2
;=> iteration 3
;=> iteration 4
;=> iteration 5

; There are a bunch of other helpful looping functions in Ruby,
; for example "map", "reduce", "inject", the list goes on. Map,
; for instance, takes the array it's looping over, does something
; to it as defined in your block, and returns an entirely new array.
array = [1,2,3,4,5]
doubled = array.map |element|
  element * 2
;end
puts doubled
;=> [2,4,6,8,10]
puts array
;=> [1,2,3,4,5]

grade = 'B'

;; Note: this is technically possible syntax but it is implemented differently, with a function called match
;; perfectly capable of doing this yourself though!
;; TODO: ""
case grade
	when 'A'
		puts 'Way to go kiddo'
	when 'B'
		puts 'Better luck next time'
	when 'C'
		puts 'You can do better'
	when 'D'
		puts 'Scraping through'
	when 'F'
		puts 'You failed!'
	else
		puts 'Alternative grading system, eh?'
;end
;=> "Better luck next time"

; cases can also use ranges
grade = 82
case grade
	when 90 .. 100
	  puts 'Hooray!'
	when 80 ... 90
	  puts 'OK job'
	else
	  puts 'You failed!'
;end
;=> "OK job"

; exception handling:
;*begin
  ; code here that might raise an exception
  raise NoMemoryError, 'You ran out of memory.'
rescue NoMemoryError => exception_variable
  puts 'NoMemoryError was raised', exception_variable
rescue RuntimeError => other_exception_variable
  puts 'RuntimeError was raised now'
else
  puts 'This runs if no exceptions were thrown at all'
ensure
  puts 'This code always runs no matter what'
end*;

; No exceptions (see Some/None)

; Methods

;def double(x)
;  x * 2
;end

fn double: int (x: int) {x * 2}
; Methods (and all blocks) implicitly return the value of the last statement
double(2) ;=> 4

; Parentheses are optional where the result is unambiguous
double 3 ;=> 6

;double double 3 ;=> 12
; requires ascetic function
fn? double (x: int) {x * 2}
double double 3

;def sum(x, y)
;  x + y
;end
fn sum: int (x: int, y: int) {x + y}
; Method arguments are separated by a comma
sum 3, 4 ;=> 7

sum sum(3, 4), 5 ;=> 12
; sum sum(3 4) 5

; yield
; All methods have an implicit, optional block parameter
; it can be called with the 'yield' keyword

fn-> surround: void
  puts '{'
  yield
  puts '}'


surround { puts 'hello world' }

; {
; hello world
; }


; You can pass a block to a method
; "&" marks a reference to a passed block
fn guests 
  yield "some argument"
;end

; You can pass a list of arguments, which will be converted into an array
; That's what splat operator ("*") is for
fn guests: void (...array)
; or
; fn<> guests: void |array: tuple| array.each |guest| puts guest
;def guests(*array)
  array.each { |guest| puts guest }
;end

; If a method returns an array, you can use destructuring assignment
;def foods
fn foods: tuple
    ['pancake', 'sandwich', 'quesadilla']
;end
destructure foods into (breakfast: string, lunch: string, dinner: string)
;breakfast, lunch, dinner = foods
breakfast ;=> 'pancake'
dinner ;=> 'quesadilla'

; By convention, all methods that return booleans end with a question mark
;5.even? ; false
;5.odd? ; true
int/even? 5
int/odd? 5
; aka even?~int 5

; And if a method ends with an exclamation mark, it does something destructive
; like mutate the receiver. Many methods have a ! version to make a change, and
; a non-! version to just return a new changed version
company_name = "Dunder Mifflin"
company_name.upper ;=> "DUNDER MIFFLIN"
company_name ;=> "Dunder Mifflin"
company_name.upper! ; we're mutating company_name this time!
company_name ;=> "DUNDER MIFFLIN"

; Define a class with the class keyword
class Human
	
	; Fields on an object need to be initialized
	private
		static species: "H. sapiens" ; An instance variable with default value (can be changed)
		name: string
		age: int
	
	; Initializer
	;; new becomes a static function which creates an instance
	;; other functions have an implied 'this' (\) too, and become a part of the instance
	fn new (name: string, age: int=0)
		\name = name
		\age = age
	; Setter
	;; Manually:
	fn name= (name: string) {\name = name}
	fn name {\name}
	
	class/accessor name
	class/reader name
	class/writer name
	
	; 'class methods' are static methods
	static
		fn say (msg: string) {puts msg}
	; Static also has an ascentic overload so you can just do static fn say (msg: string) {puts msg} for a single function
	
	;; \\ refers to this class's namespace (static) (Human/species here), however it supports private statics as well.
	fn species {\\species}


; Instantiate a class
jim = Human/new "Jim Halpert"
dwight = Human/new "Dwight K. Schrute"
jim = Human.new('Jim Halpert')

dwight = Human.new('Dwight K. Schrute')

jim.species
jim.name
jim.name = "Jim Halpert II"
dwight.species
; Let's call a couple of methods
jim.species ;=> "H. sapiens"
jim.name ;=> "Jim Halpert"
jim.name = "Jim Halpert II" ;=> "Jim Halpert II"
jim.name ;=> "Jim Halpert II"
dwight.species ;=> "H. sapiens"
dwight.name ;=> "Dwight K. Schrute"

; Call the class method
Human/say "Hi" ;=> "Hi"

; Variables that start with \ have instance scope
\var = "I'm an instance var"
defined? \var

; No class scope

; Variables can be defined as constant with 'const'
const Var="I'm a constant"

; derived class
class Worker extends Human
class Worker < Human
; both valid syntax due to overloading
