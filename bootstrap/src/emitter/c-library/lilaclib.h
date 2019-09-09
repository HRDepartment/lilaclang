struct lilac_env {
    int argc;
    char** argv;
};

struct lilac_rt {
    struct lilac_env env;
};

struct lilac_rt lilac_runtime;

/*struct lilac_rt* lilac_construct_runtime(int argc, char** argv) {
    struct lilac_rt* runtime = (struct lilac_rt*)malloc(sizeof(struct lilac_rt));
    runtime->env = (struct lilac_env){argc, argv};

    return &runtime;
}*/
