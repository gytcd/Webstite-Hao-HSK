import {env} from 'cloudflare:workers';import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from '../../chatgpt-auth';
export const dynamic='force-dynamic';
export async function GET(){const u=await getChatGPTUser();return Response.json({authenticated:!!u,user:u?{id:u.userId,name:u.displayName,email:u.email}:null,cloudReady:!!env.DB&&!!env.BUCKET,signIn:chatGPTSignInPath('/'),signOut:chatGPTSignOutPath('/')},{headers:{'cache-control':'no-store'}})}
