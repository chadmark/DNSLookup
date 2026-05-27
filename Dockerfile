FROM python:3.12-slim

LABEL maintainer="Markley Technologies"
LABEL description="Self-hosted DNS Lookup Interface"

# Install dnsutils (provides dig) and clean up apt cache
RUN apt-get update && \
    apt-get install -y --no-install-recommends dnsutils && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Flask
RUN pip install --no-cache-dir flask==3.0.3

# Copy application files
COPY app.py .
COPY static/ ./static/

EXPOSE 5000

CMD ["python", "app.py"]
