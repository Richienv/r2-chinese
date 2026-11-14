export interface ProgressGateway<T> {
  read: () => Promise<{ value: T; token: string } | null>
  backup: (value: T) => void
  update: (value: T, token: string) => Promise<boolean>
  insert: (value: T) => Promise<boolean>
}
/** A stale snapshot can only be committed after merging the latest server revision. */
export async function syncProgress<T>(
  local: T,
  gateway: ProgressGateway<T>,
  merge: (a: T, b: T) => T,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await gateway.read()
    if (row) {
      gateway.backup(row.value)
      local = merge(local, row.value)
      if (await gateway.update(local, row.token)) return local
    } else if (await gateway.insert(local)) return local
  }
  throw new Error('Progress changed on another device; retry pending')
}
