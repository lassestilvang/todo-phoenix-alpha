/**
 * AI Module Exports
 * Central export point for all AI-powered features
 */

export {
  TaskDecompositionEngine,
  taskDecompositionEngine,
} from './task-decomposition-engine';

export type {
  DecompositionConfig,
  TaskDecomposition,
  SubtaskDecomposition,
  NaturalLanguageParseResult,
  ParsedTask,
  TaskContext,
} from './task-decomposition-engine';

export {
  NaturalLanguageTaskParser,
  nlpTaskParser,
} from './nlp-task-parser';

export type {
  NLPParserConfig,
  ParsedDateTime,
} from './nlp-task-parser';

// Re-export types from task-decomposition-engine for convenience
export type {
  RecurringPattern,
} from './task-decomposition-engine';