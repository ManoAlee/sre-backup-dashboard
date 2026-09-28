from flask import Blueprint, render_template, request, redirect, url_for, session, jsonify
from core.auth import check_ad_credentials

views_bp = Blueprint('views', __name__)

@views_bp.route('/')
def index():
    return render_template('index.html')

@views_bp.route('/professional')
def professional_view():
    return render_template('index.html')

@views_bp.route('/validation')
def validation_view():
    return render_template('index.html')

@views_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        if request.is_json:
            data = request.get_json() or {}
            user = data.get('username')
            pwd = data.get('password')
        else:
            user = request.form.get('username')
            pwd = request.form.get('password')
            
        success, msg = check_ad_credentials(user, pwd)
        if success:
            session['logged_in'] = True
            session['user'] = user
            if request.is_json:
                return jsonify({'success': True, 'redirect': url_for('views.index')})
            return redirect(url_for('views.index'))
            
        if request.is_json:
            return jsonify({'success': False, 'error': msg}), 401
        return redirect(url_for('views.login', error=msg))
        
    return render_template('index.html')

@views_bp.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() if request.is_json else request.form
    user = data.get('username')
    pwd = data.get('password')
    success, msg = check_ad_credentials(user, pwd)
    if success:
        session['logged_in'] = True
        session['user'] = user
        return jsonify({'success': True, 'redirect': url_for('views.index')})
    return jsonify({'success': False, 'error': msg}), 401

@views_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('views.login'))
