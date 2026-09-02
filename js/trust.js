export async function loadTrustContent() {
  const response = await fetch('./data/nereon-trust.json', { cache:'no-cache' });
  if (!response.ok) throw new Error('Trust content unavailable.');
  return response.json();
}
