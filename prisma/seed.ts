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
        availabilityScore: 90,
        focusLevel: 80,
        energyLevel: 85,
      },
      {
        id: 'agent-beta',
        name: 'BetaAgent',
        version: '1.0.0',
        capabilities: { deep_work: true, creative: true, interrupt_handling: true, context_sharing: true, data_analysis: true },
        availabilityScore: 85,
        focusLevel: 75,
        energyLevel: 80,
      },
      {
        id: 'agent-gamma',
        name: 'GammaAgent',
        version: '1.0.0',
        capabilities: { deep_work: true, context_sharing: true, data_analysis: true },
        availabilityScore: 80,
        focusLevel: 70,
        energyLevel: 75,
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
        type: 'Daily',
        interval: 1,
        hourOfDay: 9,
        minuteOfHour: 0,
        description: 'Daily recurring task pattern',
        confidence: 0.9,
      },

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