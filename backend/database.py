# backend/database.py

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# This is the "address" of your PostgreSQL database
# Format: postgresql://username:password@host:port/database_name
DATABASE_URL = "postgresql://kevjumba@localhost:5432/statstream_db"

# The engine is SQLAlchemy's way of talking to PostgreSQL
# Think of it like a phone line between Python and your database
engine = create_engine(DATABASE_URL)

# SessionLocal is a factory that creates database sessions
# A session = one conversation with the database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is the foundation that all your models will inherit from
Base = declarative_base()