import assert from 'node:assert/strict'
import {
  PULL_MAX_OFFSET,
  PULL_MAX_RADIUS,
  PULL_THRESHOLD,
  pullIntent,
  pullOffset,
  pullProgress,
  pullRadius,
  shouldRefresh,
} from '@/shared/utils/pull-to-refresh'

assert.equal(pullOffset(-30), 0)
assert.equal(pullOffset(0), 0)
assert.equal(pullOffset(100), 50)
assert.equal(pullOffset(128), PULL_THRESHOLD)
assert.equal(pullOffset(192), PULL_MAX_OFFSET)
assert.equal(pullOffset(2000), PULL_MAX_OFFSET)

assert.equal(pullProgress(-5), 0)
assert.equal(pullProgress(0), 0)
assert.equal(pullProgress(32), 0.5)
assert.equal(pullProgress(PULL_THRESHOLD), 1)
assert.equal(pullProgress(PULL_MAX_OFFSET), 1)

assert.equal(pullRadius(0), 0)
assert.equal(pullRadius(10), 10)
assert.equal(pullRadius(90), PULL_MAX_RADIUS)

assert.equal(shouldRefresh(PULL_THRESHOLD - 1), false)
assert.equal(shouldRefresh(PULL_THRESHOLD), true)
assert.equal(shouldRefresh(PULL_MAX_OFFSET), true)

assert.equal(pullIntent(0, 0), 'undecided')
assert.equal(pullIntent(3, 3), 'undecided')
assert.equal(pullIntent(0, 12), 'pull')
assert.equal(pullIntent(5, 12), 'pull')
assert.equal(pullIntent(-5, 12), 'pull')
assert.equal(pullIntent(12, 12), 'ignore')
assert.equal(pullIntent(20, 12), 'ignore')
assert.equal(pullIntent(0, -12), 'ignore')
assert.equal(pullIntent(-20, 3), 'ignore')

console.log('pull-to-refresh dry test passed')
