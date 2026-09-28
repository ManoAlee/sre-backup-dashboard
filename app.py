import os
import logging
from flask import Flask, jsonify, request, session, redirect, url_for, send_from_directory, abort

# Load Environment Variables first
from core.dotenv_loader import load_dotenv
load_dotenv()

# Background Collectors
from core.telemetry import start_collector
from core.system import start_system_collector

# Blueprints
from blueprints.views import views_bp
from blueprints.telemetry import telemetry_bp
from blueprints.backups import backups_bp
from blueprints.samba import samba_bp
from blueprints.cpanel import cpanel_bp
from blueprints.domain import domain_bp
from blueprints.docs_logs import docs_logs_bp
from blueprints.kinghost import kinghost_bp
from blueprints.printers import printers_bp
from blueprints.bitdefender import bitdefender_bp
from blueprints.applications import applications_bp

def create_app():
    """Application Factory for SRE Dashboard 2026."""
    app = Flask(__name__, static_folder='static', template_folder='templates')
    app.secret_key = os.environ.get('DASHBOARD_SECRET', 'sre_secure_dynamic_key_2026')
    
    # Global Config
    app.config['APP_LOG_ROOT'] = '/scripts/logs'
    app.config['REPORTS_DIR'] = '/scripts/monitoring/reports'

    
    # Bulletproof Vite Static Assets Handler with Hash Fallback
    @app.route('/static/dist/assets/<path:filename>')
    def serve_dist_assets(filename):
        assets_dir = os.path.join(app.root_path, 'static', 'dist', 'assets')
        filepath = os.path.join(assets_dir, filename)
        if os.path.isfile(filepath):
            if filename.endswith('.js') or filename.endswith('.mjs'):
                return send_from_directory(assets_dir, filename, mimetype='text/javascript')
            elif filename.endswith('.css'):
                return send_from_directory(assets_dir, filename, mimetype='text/css')
            return send_from_directory(assets_dir, filename)

        # Stale bundle hash fallback - guarantees browser never gets 404 or text/html MIME error
        if filename.endswith('.css'):
            css_files = [f for f in os.listdir(assets_dir) if f.startswith('index-') and f.endswith('.css')]
            if css_files:
                css_files.sort(key=lambda x: os.path.getmtime(os.path.join(assets_dir, x)), reverse=True)
                return send_from_directory(assets_dir, css_files[0], mimetype='text/css')
        elif filename.endswith('.js') or filename.endswith('.mjs'):
            js_files = [f for f in os.listdir(assets_dir) if f.startswith('index-') and f.endswith('.js')]
            if js_files:
                js_files.sort(key=lambda x: os.path.getmtime(os.path.join(assets_dir, x)), reverse=True)
                return send_from_directory(assets_dir, js_files[0], mimetype='text/javascript')

        return abort(404)

    @app.route('/favicon.ico')
    def favicon_ico():
        return app.send_static_file('favicon.png')

    # Security Headers
    @app.after_request
    def add_security_headers(response):
        if request.path.startswith('/api/printers/proxy'):
            response.headers['Content-Security-Policy'] = (
                "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https:; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https:; "
                "style-src 'self' 'unsafe-inline' http: https:; "
                "img-src 'self' data: blob: http: https:; "
                "font-src 'self' data: http: https:; "
                "frame-ancestors 'self';"
            )
        else:
            response.headers['Content-Security-Policy'] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https: https://unpkg.com https://cdn.tailwindcss.com; "
                "style-src 'self' 'unsafe-inline' http: https: https://fonts.googleapis.com; "
                "font-src 'self' data: http: https: https://fonts.gstatic.com; "
                "connect-src 'self' http: https: https://unpkg.com https://cdn.tailwindcss.com; "
                "img-src 'self' data: http: https: https://unpkg.com; "
                "frame-src 'self' data: blob: http: https:; "
                "frame-ancestors 'self';"
            )
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response

    # Authentication Guard
    @app.before_request
    def require_login():
        if request.remote_addr == '127.0.0.1':
            session['logged_in'] = True
            session['user'] = 'local_tester'
            return
        
        # 1. Public static assets must ALWAYS be accessible without login
        if request.path.startswith('/static/') or request.path in ['/favicon.ico', '/favicon.png']:
            return

        # 2. Public endpoints
        allowed_endpoints = ['views.login', 'views.api_login', 'static', 'serve_dist_assets', 'favicon', 'views.logout', 'favicon_ico']
        if request.endpoint in allowed_endpoints:
            return
        
        # 3. Public API endpoints
        allowed_prefix_paths = ['/api/login', '/api/validation_status', '/api/domain/health', '/api/kinghost', '/api/printers', '/api/docs', '/api/view-log', '/api/logs', '/api/job_log', '/api/revalidate', '/api/samba', '/api/schedules', '/api/network', '/api/system/realtime', '/api/bitdefender', '/api/applications']
        if any(request.path.startswith(prefix) for prefix in allowed_prefix_paths):
            return

        if not session.get('logged_in'):
            if request.path.startswith('/api/'):
                return jsonify({'error': 'unauthorized'}), 401
            return redirect(url_for('views.login'))

    # Register Blueprints
    app.register_blueprint(views_bp)
    app.register_blueprint(telemetry_bp)
    app.register_blueprint(backups_bp)
    app.register_blueprint(samba_bp)
    app.register_blueprint(cpanel_bp)
    app.register_blueprint(domain_bp)
    app.register_blueprint(docs_logs_bp)
    app.register_blueprint(kinghost_bp)
    app.register_blueprint(printers_bp)
    app.register_blueprint(bitdefender_bp)
    app.register_blueprint(applications_bp)

    # Catch-all Lexmark Printer CGI Fallback for relative requests escaping from iframes
    @app.route('/cgi-bin/<path:subpath>')
    @app.route('/images/<path:subpath>')
    @app.route('/left_bar.html')
    @app.route('/topbar.html')
    @app.route('/PrinterStatus.html')
    @app.route('/langbar.html')
    @app.route('/configStyle.css')
    @app.route('/printer.image2.gif')
    @app.route('/printer.gif')
    def lexmark_root_fallback(subpath=''):
        ref = request.referrer or ''
        target_ip = '192.168.10.172'
        for ip in ['192.168.10.172', '192.168.10.171', '192.168.10.170', '192.168.10.173', '192.168.10.169']:
            if ip in ref:
                target_ip = ip
                break
        path = request.path.lstrip('/')
        return redirect(f"/api/printers/proxy/{target_ip}/{path}")

    # Initialize Telemetry Background Threads
    start_collector(app.config['APP_LOG_ROOT'])
    start_system_collector()

    return app

# Expose app for WSGI / Gunicorn compatibility (`app:app`)
app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7001, debug=False)
