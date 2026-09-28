import pytest
import sys
import os

# Add SRE_Dashboard_2026 directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_index_route(client):
    rv = client.get('/')
    assert rv.status_code in [200, 302]

def test_validation_route(client):
    rv = client.get('/validation')
    assert rv.status_code in [200, 302]

def test_professional_route(client):
    rv = client.get('/professional')
    assert rv.status_code in [200, 302]

def test_login_get(client):
    rv = client.get('/login')
    assert rv.status_code == 200

def test_api_validation_status_public(client):
    """validation_status is a public telemetry endpoint."""
    rv = client.get('/api/validation_status')
    assert rv.status_code == 200
    json_data = rv.get_json()
    assert 'cloud' in json_data
    assert 'disk' in json_data
    assert 'vm' in json_data
    assert json_data['status'] == 'online'

def test_api_domain_health_public(client):
    """domain health is a public monitoring endpoint."""
    rv = client.get('/api/domain/health')
    assert rv.status_code == 200

def test_api_unauthorized_protection(client):
    """Protected endpoints should return 401 for unauthorized remote API calls."""
    # Simulate non-localhost IP
    rv = client.get('/api/kpis', environ_base={'REMOTE_ADDR': '192.168.1.100'})
    assert rv.status_code == 401
    assert rv.get_json() == {'error': 'unauthorized'}

def test_api_kpis_authorized(client):
    """Localhost or authenticated session allows endpoint access."""
    rv = client.get('/api/kpis', environ_base={'REMOTE_ADDR': '127.0.0.1'})
    assert rv.status_code == 200

def test_graph_sentinel_endpoint(client):
    rv = client.get('/api/graph_sentinel', environ_base={'REMOTE_ADDR': '127.0.0.1'})
    assert rv.status_code == 200
    data = rv.get_json()
    assert data['status'] == 'NOMINAL'
    assert data['health_score'] == 100
