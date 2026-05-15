import os
import uuid
import random
import string
import json
from datetime import datetime

from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv
import gspread
from google.oauth2.service_account import Credentials

from api import UploaderAPI

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__, static_folder='static')

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff',
    '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.m4v', '.webm',
}

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
]


def get_api() -> UploaderAPI:
    token      = os.getenv('META_ACCESS_TOKEN', '')
    account_id = os.getenv('META_AD_ACCOUNT_ID', '')
    if not token or not account_id:
        raise RuntimeError('META_ACCESS_TOKEN and META_AD_ACCOUNT_ID must be set in .env')
    return UploaderAPI(
        access_token=token,
        ad_account_id=account_id,
        app_id=os.getenv('META_APP_ID'),
        app_secret=os.getenv('META_APP_SECRET'),
    )


def get_sheet():
    """Return the target Google Sheet worksheet."""
    creds_json = os.getenv('GOOGLE_CREDENTIALS_JSON', '')
    sheet_id   = os.getenv('GOOGLE_SHEET_ID', '')
    sheet_tab  = os.getenv('GOOGLE_SHEET_TAB', 'Sheet1')

    if not creds_json or not sheet_id:
        raise RuntimeError('GOOGLE_CREDENTIALS_JSON and GOOGLE_SHEET_ID must be set in .env')

    creds_dict = json.loads(creds_json)
    creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
    gc    = gspread.authorize(creds)
    return gc.open_by_key(sheet_id).worksheet(sheet_tab)


def append_to_sheet(data: dict):
    sheet = get_sheet()
    row = [
        data.get('title', ''),
        data.get('meta_name', ''),
        data.get('hash') or data.get('id', ''),
        data.get('type', ''),
        datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC'),
    ]
    sheet.append_row(row, value_input_option='USER_ENTERED')


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/api/config')
def config():
    return jsonify({'sheet_id': os.getenv('GOOGLE_SHEET_ID', '')})


@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)


@app.route('/api/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file  = request.files['file']
    title = request.form.get('title', '').strip() or file.filename

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({'error': f'Unsupported file type: {ext}'}), 400

    suffix = ''.join(random.choices(string.ascii_letters + string.digits, k=5))
    title  = f'{title}_{suffix}'

    tmp_path = os.path.join(UPLOAD_DIR, f'{uuid.uuid4()}{ext}')
    file.save(tmp_path)

    try:
        result = get_api().upload(file_path=tmp_path, title=title)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    # Append to Google Sheet (non-fatal if it fails)
    sheet_error = None
    try:
        append_to_sheet(result)
    except Exception as e:
        sheet_error = str(e)

    if sheet_error:
        result['sheet_warning'] = f'Upload succeeded but could not write to sheet: {sheet_error}'

    return jsonify(result)


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5002))
    app.run(debug=False, host='0.0.0.0', port=port)
