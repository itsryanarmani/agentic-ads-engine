# HTTP API failure cases

Write these cases before the server code. Verify them through child processes and HTTP requests.

- A route differs from the CLI result, including blocked copy and dry-run plans.
- A missing format or rule crashes the server or exposes an error stack.
- An apply field, including false or a nested field, reaches planning.
- Oversized bodies exceed 64 KiB, including streamed bodies and multibyte text.
- Invalid JSON, input types, or media types reach library functions.
- Unknown routes or wrong methods return success.
- A configured token is optional on health, errors, or any other route.
- Wrong tokens pass, or token values appear in output, errors, or reflected inputs.
- A public bind starts without a token, or startup errors expose supplied input.
- CORS allows an unconfigured origin or lets an unauthenticated browser preflight bypass authentication.
- Slow requests remain open beyond ten seconds.
- Concurrent requests interfere, or SIGTERM leaves the process running.
- Invalid port and host options are accepted or repeated options overwrite values.

Mutation proof must skip authentication, raise the body limit, and allow apply.
Each mutation must fail its matching E2E assertion. Restore the exact source after each run.
Save the checks and mutation results as repeatable JSON artifacts under test/artifacts.
