#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  // Seed Users
  const users = await prisma.user.createMany({
    data: [
      { id: 'user-admin', email: 'admin@example.com', name: 'Admin' },
      { id: 'user-alice', email: 'alice@example.com', name: 'Alice' },
      { id: 'user-bob', email: 'bob@example.com', name: 'Bob' },
    ]),
  });

  // Seed Agents
  const agents = await prisma.agent.createMany({
    data: [
      {
        id: 'agent-alpha',
        name: 'AlphaAgent',
        version: '1.0.0',
        capabilities: { deep_work: true, creative: true, interrupt_handling: true, context_sharing: true, data_analysis: true },
        resourceAllocation: { cpu_power: 10, memory_gb: 4 },
      },
      {
        data: {
          id: 'agent-beta',
          name: 'BetaAgent',
          version: '1.0.0',
          capabilities: { deep_work: true, creative: true, interrupt_handling: true, context_sharing: true, data_analysis: true },
          resourceAllocation: { cpu_power: 8, memory_gb: 8 },
        },
      }),
      {
        data: {
          id: 'agent-gamma',
          name: 'GammaAgent',
          version: '1.0.0',
          capabilities: { deep_work: true, context_sharing: true, data_analysis: true },
          resourceAllocation: { cpu_power: 6, memory_gb: 4 },
        },
      },
    ]);

  console.log('✅ Created users and agents');

  // Seed Tasks
  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        id: uuidv4(),
        description: 'Set up initial project structure',
        required_capabilities: ['deep_work'],
        priority: 5,
        dependencies: [],
        userId: 'user-admin',
        status: 'pending',
      }),
    ]);

    // Seed Recurring Patterns
    const recurringPatterns = await prisma.recurringPattern.create({
      data: {
        id: uuidv4(),
        type: 'daily',
        interval: 1,
        scope: 'task',
        resourceProfile: { cpu: 0.1, memory_gb: 0.5 },
        validity: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    console.log('✅ Seeded recurring patterns');

    // Create initial scheduled tasks
    const tasks = await Promise.all([
      prisma.task.create({
        data: {
          description: 'Daily status report',
          priority: 4,
          required_capabilities: ['data_analysis'],
          deadline: new Date(Date.now() + 86400000),
          createdBy: { connect: { id: 'user-admin' } },
          tags: ['daily', 'report'],
        },
      }),
    ]);

    console.log('✅ Created initial tasks');
  } catch (e) {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  }