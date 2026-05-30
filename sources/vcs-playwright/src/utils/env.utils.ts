export function isTrue(envName: string): boolean {
  const actualValue = process.env[envName];
  return !!actualValue && actualValue.toLowerCase() === 'true';
}
