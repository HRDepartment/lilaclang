; for original code see this post https://codereview.stackexchange.com/questions/60484/stl-vector-implementation
; original code kept intact, minor DRY applied and added range checks

class Vector<'t>
    type Iterator: *<'t> ; * is an alias for ptr
    type Reference: &<'t> ; & is an alias for ref

    class/reader capacity: uint
    class/reader size: uint
    class/reader empty: bool
    private Log: uint
    private buffer: Iterator

    private fn calc-log -> |size: uint| math/ceil(math/log(f64(size)) / math/log(2.0))
    fn new ->) clear
    fn new (\size: uint)
        ;\size = size
        \Log = calc-log \size
        \capacity = 1 << \Log
        \buffer = malloc 't \capacity
    fn new (size: uint, initial: 't)
        new size
        fill \buffer with: initial .size
    fn new (copy: Vector<'t>)
        \size = copy.size
        \Log = copy.Log
        \capacity = copy.capacity
        \buffer = malloc 't \size
        copy from: copy.buffer to: \buffer .size
    fn empty: bool ->) zero? size
    fn delete ->) free[] \buffer
    fn begin: Iterator ->) * \buffer
    fn end: Iterator ->) (* \buffer) + \size
    fn front: Reference ->) \buffer[0]
    fn back: Reference ->) \buffer[max(\size - 1, 0)]
    fn push_back: void (value: Reference)
        if \size >= \capacity
            reserve 1 << \Log
            ++ \Log
        buffer[\size ++] =  value
    fn pop_back: void
        free back
        -- \size
    fn reserve: void (capacity: uint)
        guard capacity > \capacity
        \capacity = capacity

        new-buffer = malloc 't \capacity
        copy from: \buffer to: new-buffer \size

        delete
        \buffer = new-buffer
    fn resize: void (size: uint)
        guard size > \size
        \size = size

        \Log = calc-log size
        reserve 1 << \log
    fn []: Reference (index: uint)
        guard \size > index ->) fatal "vector index #{index} > its size #{\size}"
    fn =: *<Vector<'t>> (other: &<Vector<'t>>)
        clear
        new other
        * \this
    fn clear: void
        fill (\capacity \size \buffer \Log) with: 0
;