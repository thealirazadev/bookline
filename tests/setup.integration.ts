// Integration tests hit the docker-compose Postgres; load .env for DATABASE_URL
// via Node's built-in env-file loader (no extra dependency).
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file present; rely on the ambient environment (e.g. CI).
}
