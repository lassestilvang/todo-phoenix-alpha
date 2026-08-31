#!/usr/bin/env tsx
/**
 * Performance benchmark script for Todo Phoenix Alpha
 *
 * Measures key performance metrics:
 * - Task creation throughput
 * - Task query latency
 * - Pattern mining performance
 * - Conflict resolution performance
 * - Cache hit rates
 */

import db from '@/lib/db/schema';
import { PatternMiningService } from '@/lib/pattern-miner';
import { ConflictArbiter } from '@/lib/conflict-arbiter';
import { dataCache as cache } from '@/lib/cache';

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  opsPerSec: number;
}

function measure(name: string, fn: () => void, iterations: number): BenchmarkResult {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const totalMs = performance.now() - start;
  return {
    name,
    iterations,
    totalMs: Math.round(totalMs),
    avgMs: Math.round((totalMs / iterations) * 100) / 100,
    opsPerSec: Math.round(iterations / (totalMs / 1000)),
  };
}

function main() {
  console.log('🚀 Performance Benchmark Suite\n');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Node: ${process.version}\n`);

  const results: BenchmarkResult[] = [];

  // 1. Task creation throughput
  results.push(
    measure('Task creation', () => {
      db.prepare(`
        INSERT INTO tasks (name, description, deadline, estimate_minutes, priority, is_completed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `Benchmark task ${Math.random()}`,
        'Benchmark description',
        new Date(Date.now() + Math.random() * 86400000).toISOString(),
        Math.floor(Math.random() * 120),
        ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        0,
        new Date().toISOString(),
        new Date().toISOString()
      );
    }, 1000)
  );

  // 2. Task query latency
  results.push(
    measure('Task query (all)', () => {
      db.prepare('SELECT * FROM tasks LIMIT 100').all();
    }, 1000)
  );

  // 3. Task query with join
  results.push(
    measure('Task query (with list)', () => {
      db.prepare(`
        SELECT t.*, l.name as list_name, l.color as list_color
        FROM tasks t
        LEFT JOIN lists l ON t.list_id = l.id
        LIMIT 100
      `).all();
    }, 500)
  );

  // 4. Cache operations
  results.push(
    measure('Cache set', () => {
      cache.set(`benchmark_${Math.random()}`, { value: Math.random() }, 60000);
    }, 1000)
  );

  results.push(
    measure('Cache get', () => {
      cache.get('benchmark_0');
    }, 1000)
  );

  // 5. Pattern mining
  const patternMiner = new PatternMiningService();
  const allTasks = db.prepare('SELECT id, created_at FROM tasks LIMIT 500').all();
  const taskObjects = allTasks.map((t: any) => ({
    created_at: new Date(t.created_at).getTime(),
  }));

  results.push(
    measure('Pattern clustering', () => {
      patternMiner.clusterTasks(taskObjects);
    }, 100)
  );

  // 6. Conflict resolution
  const arbiter = new ConflictArbiter();
  arbiter.start();

  results.push(
    measure('Conflict creation', () => {
      arbiter.createConflict({
        participants: ['agent-a', 'agent-b'],
        description: 'Benchmark conflict',
        type: 'TASK_LOCK_CONTENTION' as any,
        priority: 5,
        severity: 'medium' as any,
        context: {
          taskId: '1',
          timestamp: Date.now(),
          metadata: { benchmark: true },
        },
      });
    }, 100)
  );

  arbiter.stop();

  // Print results
  console.log('='.repeat(80));
  console.log('Benchmark Results');
  console.log('='.repeat(80));
  console.log(
    `${'Name'.padEnd(30)} | ${'Iterations'.padEnd(10)} | ${'Avg (ms)'.padEnd(10)} | ${'Ops/sec'.padEnd(10)}`
  );
  console.log('-'.repeat(80));

  for (const r of results) {
    console.log(
      `${r.name.padEnd(30)} | ${r.iterations.toString().padEnd(10)} | ${r.avgMs.toFixed(2).padEnd(10)} | ${r.opsPerSec.toString().padEnd(10)}`
    );
  }

  console.log('='.repeat(80));

  // Cleanup benchmark data
  db.prepare('DELETE FROM tasks WHERE name LIKE ?').run('Benchmark task %');
  db.prepare('DELETE FROM tasks WHERE name LIKE ?').run('Benchmark%');

  console.log('\n✅ Benchmark complete!');
}

main();