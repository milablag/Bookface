import os
from flask import Flask
from config import DB_CONFIG, UPLOAD_FOLDER, SECRET_KEY

from controllers.index_controller import index_bp
from controllers.auth_controller import auth_bp
from controllers.user_controller import user_bp
from controllers.admin_controller import admin_bp
from controllers.profile_controller import profile_bp
from controllers.marathon_controller import marathon_bp

from models.database import create_tables

app = Flask(__name__)
app.secret_key = SECRET_KEY
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

app.register_blueprint(index_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(marathon_bp)

if __name__ == '__main__':
    create_tables()
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    app.run(debug=True)