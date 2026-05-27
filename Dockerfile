FROM python:3.12-slim

LABEL maintainer="Markley Technologies"
LABEL description="Self-hosted DNS Lookup Interface"

RUN apt-get update && \
    apt-get install -y --no-install-recommends dnsutils whois && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir flask==3.0.3 python-whois==0.9.4 requests==2.32.3

COPY app.py .
COPY static/ ./static/

EXPOSE 5000

CMD ["python", "app.py"]
