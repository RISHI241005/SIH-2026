import sys
sys.path.insert(0, '.')

from backend.models.database import db, init_db
from backend.utils.session import init_db as init_session_db

if __name__ == '__main__':
    init_db()
    print("✅ Database initialized successfully!")
    print("✅ Default admin account: admin / admin123")
    print("✅ Default uploader: uploader1 / upload123")
