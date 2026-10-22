"""Run with TEST_BACKEND_URL, TEST_PUBLIC_KEY and TEST_ACCESS_TOKEN set."""
import os
from datetime import datetime, timedelta, timezone
import requests

url = os.environ['TEST_BACKEND_URL']
key = os.environ['TEST_PUBLIC_KEY']
admin = {'apikey': key, 'Authorization': 'Bearer ' + os.environ['TEST_ACCESS_TOKEN']}
public = {'apikey': key}
fixture = 'timeout-regression'

def request(method, path, **kwargs):
    response = requests.request(method, url + '/rest/v1/' + path, **kwargs)
    response.raise_for_status()
    return response

settings = request('GET', 'settings?id=eq.1&select=webhook_token,conversation_timeout_minutes', headers=admin).json()[0]
assert settings['conversation_timeout_minutes'] == 2

def ingest(body, suffix):
    return request('POST', 'rpc/webhook_ingest', headers=public, json={
        '_token': settings['webhook_token'], '_phone': fixture, '_name': 'Regression',
        '_body': body, '_external_id': fixture + suffix, '_payload': {'regression': fixture}
    }).json()

try:
    selected = ingest('2', '-select')
    assert selected['company'] == 'events'
    timestamp = (datetime.now(timezone.utc) - timedelta(seconds=90)).isoformat()
    request('PATCH', 'conversations?phone=eq.' + fixture, headers=admin, json={'last_client_message_at': timestamp})
    active = ingest('Ainda preciso de ajuda', '-active')
    assert active['company'] == 'events'
    timestamp = (datetime.now(timezone.utc) - timedelta(seconds=121)).isoformat()
    request('PATCH', 'conversations?phone=eq.' + fixture, headers=admin, json={'last_client_message_at': timestamp})
    expired = ingest('2', '-expired')
    assert expired['company'] is None
    assert '1 - Associação Pace 3' in expired['direct_reply']
    assert '2 - Pace 3 Eventos Esportivos' in expired['direct_reply']
    assert expired['history'] == [] and expired['knowledge'] == []
    print('PASS: active at 90 seconds; expired at 121 seconds with menu and isolated context')
finally:
    request('DELETE', 'messages?conversation_id=eq.' + selected['conversation_id'], headers=admin)
    request('DELETE', 'conversations?phone=eq.' + fixture, headers=admin)
    request('DELETE', 'webhook_events?payload->>regression=eq.' + fixture, headers=admin)