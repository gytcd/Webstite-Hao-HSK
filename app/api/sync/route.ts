import {env} from 'cloudflare:workers';import {getChatGPTUser} from '../../chatgpt-auth';import {syncHandler} from '../../../lib/study-service.mjs';
export const dynamic='force-dynamic';export async function GET(r:Request){return syncHandler(r,env,await getChatGPTUser())}export async function POST(r:Request){return syncHandler(r,env,await getChatGPTUser())}
