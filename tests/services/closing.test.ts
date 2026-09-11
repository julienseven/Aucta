import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({settleDue:vi.fn(),localRequestEnabled:vi.fn(),serviceRoleConfigured:vi.fn(),headers:vi.fn(),localServiceRpc:vi.fn(),createServiceClient:vi.fn(),createClient:vi.fn()}));
vi.mock('@/lib/server/mutations',()=>({settleDue:mocks.settleDue}));
vi.mock('@/lib/server/runtime',()=>({localRequestEnabled:mocks.localRequestEnabled,serviceRoleConfigured:mocks.serviceRoleConfigured,supabaseConfigured:()=>true}));
vi.mock('next/headers',()=>({headers:mocks.headers}));
vi.mock('@/lib/server/database',()=>({localServiceRpc:mocks.localServiceRpc}));
vi.mock('@/lib/supabase/service',()=>({createServiceClient:mocks.createServiceClient}));
vi.mock('@/lib/supabase/server',()=>({createClient:mocks.createClient}));
import { POST } from '@/app/api/cron/close/route';
import { callServiceRpc } from '@/lib/server/repository';
const secret='local-scheduler-test-secret-at-least-32-characters';
function request(token=secret){return new Request('http://localhost:3100/api/cron/close',{method:'POST',headers:{authorization:'Bearer '+token,host:'localhost:3100'}});}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('CRON_SECRET',secret);mocks.localRequestEnabled.mockReturnValue(true);mocks.settleDue.mockResolvedValue({processed:1});mocks.headers.mockResolvedValue(new Headers({host:'localhost:3100'}));});
afterEach(()=>vi.unstubAllEnvs());
describe('closing route authorization',()=>{
 it('rejects missing configuration and invalid bearer tokens before settlement',async()=>{
   vi.stubEnv('CRON_SECRET','');expect((await POST(request())).status).toBe(503);
   vi.stubEnv('CRON_SECRET',secret);expect((await POST(request('wrong'))).status).toBe(401);
   expect(mocks.settleDue).not.toHaveBeenCalled();
 });
 it('allows a correctly authenticated local scheduler with a bounded batch',async()=>{
   const response=await POST(request());expect(response.status).toBe(200);expect(mocks.settleDue).toHaveBeenCalledWith(50);
 });
 it('fails closed outside local mode without service credentials',async()=>{
   mocks.localRequestEnabled.mockReturnValue(false);mocks.serviceRoleConfigured.mockReturnValue(false);
   expect((await POST(request())).status).toBe(503);expect(mocks.settleDue).not.toHaveBeenCalled();
 });
});
describe('scheduler identity isolation',()=>{
 it('uses only the dedicated local service transaction',async()=>{
   mocks.localServiceRpc.mockResolvedValue({processed:2});
   expect(await callServiceRpc('settle_due',{p_limit:50})).toEqual({processed:2});
   expect(mocks.localServiceRpc).toHaveBeenCalledWith('settle_due',{p_limit:50});
   expect(mocks.createClient).not.toHaveBeenCalled();expect(mocks.createServiceClient).not.toHaveBeenCalled();
 });
 it('uses a cookie-free service client on Supabase instead of the user client',async()=>{
   mocks.localRequestEnabled.mockReturnValue(false);
   const rpc=vi.fn().mockResolvedValue({data:{processed:3},error:null});mocks.createServiceClient.mockReturnValue({rpc});
   expect(await callServiceRpc('settle_due',{p_limit:50})).toEqual({processed:3});
   expect(rpc).toHaveBeenCalledWith('settle_due',{p_limit:50});expect(mocks.createClient).not.toHaveBeenCalled();
 });
});
