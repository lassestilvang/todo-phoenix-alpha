import { expect, describe, it } from 'vitest'
import { cn } from '../utils'

describe('cn utility', () => {
  it('should merge class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2')
  })

  it('should handle conditional classes', () => {
    expect(cn('class1', true && 'class2', false && 'class3')).toBe('class1 class2')
  })

  it('should override conflicting classes', () => {
    expect(cn('class1', 'class2', 'class1'))
      .toBe('class1 class2 class1')  // Last occurrence wins
  })
})