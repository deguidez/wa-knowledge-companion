"""Run with TEST_BACKEND_URL, TEST_PUBLIC_KEY and TEST_ACCESS_TOKEN set."""
import os, requests
from datetime import datetime, timedelta, timezone

url = os.environ['TEST_BACKEND_URL'] + '/rest/v1/'
key = os.environ['TEST_PUBLIC_KEY']
admin = {'apikey': key, 'Authorization': 'Bearer ' + os.environ['TEST_ACCESS_TOKEN']}
public = {'apikey': key}
fixture = 'followup-regression'
def req(method, path, headers=admin, **kwargs):
    r = requests.request(method, url + path, headers=headers, **kwargs)
    r.raise_for_status()
    return r
token = req('GET', 'settings?id=eq.1&select=webhook_token').json()[0]['webhook_token']
cid = req('POST', 'rpc/webhook_ingest', headers=public, json={'_token':token,'_phone':fixture,'_name':'Regression','_body':'2','_external_id':fixture,'_payload':{'regression':fixture}}).json()['conversation_id']
def claim():
    return req('POST','rpc/webhook_claim_followups',headers=public,json={'_token':token}).json()['jobs']
try:
    now = datetime.now(timezone.utc)
    req('PATCH', 'conversations?id=eq.'+cid, json={'last_client_message_at':(now-timedelta(seconds=50)).isoformat()})
    req('POST','messages',json={'conversation_id':cid,'direction':'out','body':'Fixture','status':'ok','company':'events','created_at':(now-timedelta(seconds=29)).isoformat()})
    assert not any(j['id']==cid for j in claim())
    req('PATCH','messages?conversation_id=eq.'+cid+'&direction=eq.out',json={'created_at':(now-timedelta(seconds=31)).isoformat()})
    assert any(j['id']==cid for j in claim())
    assert not any(j['id']==cid for j in claim())
    req('PATCH','conversations?id=eq.'+cid,json={'last_client_message_at':(now-timedelta(seconds=121)).isoformat()})
    claim()
    assert req('GET','conversations?id=eq.'+cid+'&select=company').json()[0]['company'] is None
    print('PASS: no reminder at 29s; one at 31s; no duplicates; selection cleared after 2 minutes')
finally:
    req('DELETE','messages?conversation_id=eq.'+cid)
    req('DELETE','conversations?id=eq.'+cid)
    req('DELETE','webhook_events?payload->>regression=eq.'+fixture)