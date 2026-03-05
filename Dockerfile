# backend/Dockerfile

# Start from official Python 3.12 image
FROM python:3.12-slim

# Set working directory inside the container
WORKDIR /app

# Copy requirements first (better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your backend code
COPY . .

# Start FastAPI with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]


# Also create backend/requirements.txt:
fastapi
uvicorn
sqlalchemy
psycopg2-binary
python-dotenv
pandas
nba_api
