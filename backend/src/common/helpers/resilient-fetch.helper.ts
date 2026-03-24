/**
 * Resilient fetch wrapper with timeout and circuit breaker pattern.
 * Prevents cascading failures when external APIs (Moyasar, Zoom, OpenRouter) are slow or down.
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('ResilientFetch');

// --- Circuit Breaker State ---

interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  /** Prevents multiple concurrent probes in half-open state */
  halfOpenProbeActive: boolean;
}

const circuits = new Map<string, CircuitState>();

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 30_000; // 30 seconds before trying again

function getCircuit(name: string): CircuitState {
  if (!circuits.has(name)) {
    circuits.set(name, { failures: 0, lastFailure: 0, state: 'closed', halfOpenProbeActive: false });
  }
  return circuits.get(name)!;
}

function recordSuccess(name: string): void {
  const circuit = getCircuit(name);
  circuit.failures = 0;
  circuit.state = 'closed';
  circuit.halfOpenProbeActive = false;
}

function recordFailure(name: string): void {
  const circuit = getCircuit(name);
  circuit.failures++;
  circuit.lastFailure = Date.now();
  circuit.halfOpenProbeActive = false;
  if (circuit.failures >= FAILURE_THRESHOLD) {
    circuit.state = 'open';
    logger.warn(`Circuit breaker OPEN for "${name}" after ${circuit.failures} failures`);
  }
}

function canAttempt(name: string): boolean {
  const circuit = getCircuit(name);
  if (circuit.state === 'closed') return true;
  if (circuit.state === 'open') {
    if (Date.now() - circuit.lastFailure > RESET_TIMEOUT_MS) {
      // Atomically transition to half-open and allow exactly one probe
      if (!circuit.halfOpenProbeActive) {
        circuit.state = 'half-open';
        circuit.halfOpenProbeActive = true;
        logger.log(`Circuit breaker HALF-OPEN for "${name}" — allowing one probe`);
        return true;
      }
      // Another probe is already in-flight — block this one
      return false;
    }
    return false;
  }
  // half-open: only the single probe request is allowed through
  return false;
}

// --- Resilient Fetch ---

export interface ResilientFetchOptions {
  /** Circuit breaker name — all calls sharing the same name share one circuit */
  circuit: string;
  /** Request timeout in milliseconds (default: 15000) */
  timeoutMs?: number;
}

/**
 * Wraps native `fetch` with:
 * 1. Request timeout via AbortController
 * 2. Circuit breaker pattern to fail fast when an API is down
 *
 * Usage: drop-in replacement for `fetch` with an extra options object.
 */
export async function resilientFetch(
  url: string | URL,
  init: RequestInit & { signal?: AbortSignal } = {},
  options: ResilientFetchOptions,
): Promise<Response> {
  const { circuit: circuitName, timeoutMs = 15_000 } = options;

  // Circuit breaker check
  if (!canAttempt(circuitName)) {
    throw new Error(`Circuit breaker is OPEN for "${circuitName}" — request blocked`);
  }

  // Timeout via AbortController
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Use our timeout signal (ignore any existing signal to avoid AbortSignal.any Node 20.3+ requirement)
  const mergedSignal = controller.signal;

  try {
    const response = await fetch(url, { ...init, signal: mergedSignal });
    clearTimeout(timeout);

    if (response.ok || response.status < 500) {
      recordSuccess(circuitName);
    } else {
      // 5xx = server error → count as failure
      recordFailure(circuitName);
    }

    return response;
  } catch (err) {
    clearTimeout(timeout);
    recordFailure(circuitName);

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request to "${circuitName}" timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

/** Reset a circuit (useful for testing) */
export function resetCircuit(name: string): void {
  circuits.delete(name);
}
