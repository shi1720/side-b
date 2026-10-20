export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = 'AppError'; }
}
export function errorResponse(error: unknown) {
  if (error instanceof AppError) return Response.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  if (error instanceof Error && 'status' in error && typeof error.status === 'number' && error.status >= 400 && error.status <= 599) return Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});
  console.error('Side B request failed:', error instanceof Error ? error.name : 'Unknown error');
  return Response.json({ error: 'This request could not be completed. Please retry in a moment.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
}
