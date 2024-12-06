export type CodeSafe<T extends string> = T extends `${infer P} ${infer R}` ? `${P}_${CodeSafe<R>}` : T;

export function codeSafe<T extends string>(value: T): CodeSafe<T> {
  return value.replaceAll(` `, `_`) as CodeSafe<T>;
}
