#!/usr/bin/env tsx
/**
 * Seed data script for testing pattern mining and conflict resolution
 *
 * Creates sample data to demonstrate:
 * - Recurring task patterns (daily, weekly, monthly)
 * - Conflict resolution scenarios
 * - System warm-start with initial data
 */

import db from '@/lib/db/schema';
import { ConflictArbiter } from '@/lib/conflict-arbiter';
import { PatternMiningService } from '@/lib/pattern-miner';

// Mock faker data since we might not have it installed
const faker = {
  lorem: {
    sentence: () => 'Sample task description',
    words: (count: number) => Array(count).fill('task').join(' '),
  },
  name: {
    fullName: () => `User ${Math.floor(Math.random() * 100)}`,
  },
  date: {
    past: (days: number, refDate?: Date) => {
      const date = refDate || new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * days));
      return date;
    },
    future: (days: number, refDate?: Date) => {
      const date = refDate || new Date();
      date.setDate(date.getDate() + Math.floor(Math.random() * days));
      return date;
    },
  },
  random: {
    arrayElement: (arr: any[]) => arr[Math.floor(Math.random() * arr.length)],
    number: (options: { min: number; max: number }) =>
      Math.floor(Math.random() * (options.max - options.min + 1)) + options.min,
  },
};

async function main() {
  console.log('🌱 Seeding test data...\n');

  // Ensure we're in Node environment
  if (typeof window !== 'undefined') {
    console.error('❌ This script must run in Node.js environment');
    process.exit(1);
  }

  try {
    // Seed tasks for pattern mining
    const now = Date.now();
    const tasksCreated: number[] = [];

    // Daily tasks (every weekday at 9am)
    for (let i = 0; i < 15; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000); // i days ago
      date.setHours(9, 0, 0, 0); // 9:00 AM

      const taskId = db
        .prepare(
          `
          INSERT INTO tasks (name, description, deadline, estimate_minutes, priority, is_completed, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          `Daily task #${i + 1}`,
          faker.lorem.sentence(),
          date.toISOString(),
          30,
          faker.random.arrayElement(['high', 'medium', 'low']),
          i % 3 === 0, // Every 3rd task completed
          date.toISOString(),
          date.toISOString()
        ).lastInsertRowid;

      tasksCreated.push(taskId);
    }

    // Weekly tasks (every Monday at 2pm)
    for (let i = 0; i < 8; i++) {
      const date = new Date(now - i * 7 * 24 * 60 * 60 * 1000); // i weeks ago
      date.setHours(14, 0, 0, 0); // 2:00 PM
      // Adjust to Monday
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
      date.setDate(diff);

      const taskId = db
        .prepare(
          `
          INSERT INTO tasks (name, description, deadline, estimate_minutes, priority, is_completed, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          `Weekly report #${i + 1}`,
          faker.lorem.sentence(),
          date.toISOString(),
          60,
          'high',
          i % 4 === 0,
          date.toISOString(),
          date.toISOString()
        ).lastInsertRowid;

      tasksCreated.push(taskId);
    }

    // Monthly tasks (1st of each month at 10am)
    for (let i = 0; i < 6; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      date.setDate(1); // First of month
      date.setHours(10, 0, 0, 0); // 10:00 AM

      const taskId = db
        .prepare(
          `
          INSERT INTO tasks (name, description, deadline, estimate_minutes, priority, is_completed, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          `Monthly review #${i + 1}`,
          faker.lorem.sentence(),
          date.toISOString(),
          90,
          'medium',
          i % 2 === 0,
          date.toISOString(),
          date.toISOString()
        ).lastInsertRowid;

      tasksCreated.push(taskId);
    }

    // Some random tasks with conflicts
    for (let i = 0; i < 10; i++) {
      const date = faker.date.past(30);
      const taskId = db
        .prepare(
          `
          INSERT INTO tasks (name, description, deadline, estimate_minutes, priority, is_completed, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          faker.lorem.words(3),
          faker.lorem.sentence(),
          faker.date.future(7).toISOString(),
          faker.random.number({ min: 15, max: 120 }),
          faker.random.arrayElement(['high', 'medium', 'low']),
          false,
          date.toISOString(),
          date.toISOString()
        ).lastInsertRowid;

      tasksCreated.push(taskId);
    }

    console.log(`✅ Created ${tasksCreated.length} sample tasks`);

    // Seed conflict resolution examples
    const arbiter = new ConflictArbiter();
    arbiter.start(); // Start the arbiter

    // Create a few sample conflicts
    const conflictTypes = [
      'TASK_LOCK_CONTENTION',
      'CONTEXT_MERGE_CONFLICT',
      'PRIORITY_ESCALATION',
      'RESOURCE_CONTENTION',
      'PHASE_TRANSITION_CONFLICT',
    ];

    for (let i = 0; i < 5; i++) {
      const conflictId = await arbiter.createConflict({
        participants: [`agent-${i + 1}-A`, `agent-${i + 1}-B`],
        description: `Sample ${conflictTypes[i]} for demonstration`,
        type: conflictTypes[i] as any,
        priority: faker.random.number({ min: 1, max: 10 }),
        severity: faker.random.arrayElement(['low', 'medium', 'high', 'critical']) as any,
        context: {
          taskId: tasksCreated[faker.random.number({ min: 0, max: tasksCreated.length - 1 })].toString(),
          timestamp: Date.now() - faker.random.number({ min: 0, max: 3600000 }), // Within last hour
          metadata: { demo: true },
        },
      });

      // Resolve some conflicts immediately
      if (i % 2 === 0) {
        arbiter.resolveConflict(conflictId, 'LOCK_WINNER');
      }
    }

    console.log('✅ Created sample conflicts');

    // Run pattern mining to generate initial patterns
    const patternMiner = new PatternMiningService();
    const allTasks = db.prepare('SELECT id, created_at FROM tasks WHERE is_completed = 0').all();

    if (allTasks.length > 0) {
      const taskObjects = allTasks.map((t: any) => ({
        created_at: new Date(t.created_at).getTime(),
      }));

      const clusters = patternMiner.clusterTasks(taskObjects);
      const patterns = patternMiner.extractPatternsFromClusters(clusters);

      console.log(`✅ Generated ${patterns.length} initial patterns`);
      patterns.forEach((p) => {
        console.log(`   • ${p.description}`);
      });
    }

    // Stop the arbiter to clean up
    arbiter.stop();

    console.log('\n🎉 Seed data creation complete!');
    console.log(`   • Tasks: ${tasksCreated.length}`);
    console.log('   • Conflict examples created');
    console.log('   • Pattern mining initialized');
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

main();