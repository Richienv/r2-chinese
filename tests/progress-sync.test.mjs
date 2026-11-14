import test from 'node:test'
import assert from 'node:assert/strict'
import { syncProgress } from '../src/lib/progressSyncCore.ts'
const merge = (a, b) => [...new Set([...a, ...b])].sort()
test('a concurrent write retries with the new server evidence before committing', async () => {
  let token = 1,
    server = ['old'],
    writes = 0,
    backups = 0
  const result = await syncProgress(
    ['local'],
    {
      read: async () => ({ value: [...server], token: String(token) }),
      backup: () => backups++,
      update: async (value, expected) => {
        writes++
        if (writes === 1) {
          server.push('other-device')
          token++
          return false
        }
        assert.equal(expected, String(token))
        server = value
        return true
      },
      insert: async () => {
        throw Error('unexpected insert')
      },
    },
    merge,
  )
  assert.deepEqual(result, ['local', 'old', 'other-device'])
  assert.equal(writes, 2)
  assert.equal(backups, 2)
})
test('a failed server read or backup never writes an empty replacement', async () => {
  let writes = 0
  const gateway = {
    read: async () => {
      throw Error('offline')
    },
    backup: () => {},
    update: async () => {
      writes++
      return true
    },
    insert: async () => {
      writes++
      return true
    },
  }
  await assert.rejects(syncProgress(['local'], gateway, merge), /offline/)
  await assert.rejects(
    syncProgress(
      ['local'],
      {
        ...gateway,
        read: async () => ({ value: ['server'], token: '1' }),
        backup: () => {
          throw Error('quota')
        },
      },
      merge,
    ),
    /quota/,
  )
  assert.equal(writes, 0)
})
test('an insert race refetches and combines the other device row', async () => {
  let server = null
  const result = await syncProgress(
    ['local'],
    {
      read: async () => server,
      backup: () => {},
      insert: async () => {
        server = { value: ['remote'], token: '1' }
        return false
      },
      update: async () => true,
    },
    merge,
  )
  assert.deepEqual(result, ['local', 'remote'])
})
