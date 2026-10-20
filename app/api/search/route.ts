import { errorResponse } from '@/lib/errors';
import { quota, requestIdentity, searchEntities } from '@/lib/qloo';
import type { EntityKind } from '@/lib/types';
export async function GET(request:Request){
 try{
  const url=new URL(request.url);
  await quota('search-hour:'+await requestIdentity(request),80,3600);
  const result=await searchEntities(url.searchParams.get('q')??'',(url.searchParams.get('kind')??'artist') as EntityKind);
  return Response.json({entities:result.entities},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return errorResponse(error);}
}
