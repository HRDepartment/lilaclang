#include "lilaclib.h"
// %library_includes%
// %user_includes%

int main(int argc, char** argv) {
    lilac_runtime.env = (struct lilac_env){argc, argv};
    return lilac_main();
}

