export async function executeAuthenticatedAIAction<TInput, TOutput>(
  authorize: () => Promise<unknown>,
  input: TInput,
  execute: (input: TInput) => Promise<TOutput>,
): Promise<TOutput> {
  await authorize();
  return execute(input);
}
