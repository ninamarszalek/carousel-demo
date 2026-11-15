import { existsSync } from 'node:fs';

export interface ServerConfig {
  readonly port: number;
  /** TMDB API Read Access Token. Server-only: never expose it to the client bundle. */
  readonly tmdbAccessToken: string;
  /** TMDB API v3 base URL. Overridden only in e2e tests, which point it at a local mock. */
  readonly tmdbApiBaseUrl: string;
}

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

const DEFAULT_PORT = 3000;
export const DEFAULT_TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
const MAX_PORT = 65_535;

/** Loads variables from a `.env` file into `process.env`, if the file exists. */
export function loadEnvFile(path = '.env'): void {
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
}

/**
 * Reads and validates the server configuration once at startup.
 * Collects every problem before failing, so the developer can fix them all in one go.
 */
export function readConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const problems: string[] = [];

  const tmdbAccessToken = env.TMDB_ACCESS_TOKEN?.trim() ?? '';
  if (tmdbAccessToken === '') {
    problems.push(
      'TMDB_ACCESS_TOKEN is missing. Copy .env.example to .env and set your TMDB API Read Access Token.',
    );
  }

  const port = parsePort(env.PORT, problems);
  const tmdbApiBaseUrl = parseBaseUrl(env.TMDB_API_BASE_URL, problems);

  if (problems.length > 0) {
    const details = problems.map((problem) => `  - ${problem}`).join('\n');
    throw new ConfigError(`Invalid server configuration:\n${details}`);
  }

  return { port, tmdbAccessToken, tmdbApiBaseUrl };
}

function parseBaseUrl(raw: string | undefined, problems: string[]): string {
  const value = raw?.trim() ?? '';
  if (value === '') {
    return DEFAULT_TMDB_API_BASE_URL;
  }

  if (!URL.canParse(value) || !/^https?:$/.test(new URL(value).protocol)) {
    problems.push(`TMDB_API_BASE_URL must be an http(s) URL (got "${value}").`);
    return DEFAULT_TMDB_API_BASE_URL;
  }

  return value;
}

function parsePort(raw: string | undefined, problems: string[]): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_PORT;
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    problems.push(`PORT must be an integer between 1 and ${String(MAX_PORT)} (got "${raw}").`);
    return DEFAULT_PORT;
  }

  return port;
}
