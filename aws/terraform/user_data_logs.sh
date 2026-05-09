#!/bin/bash
set -e

echo "=== Logs EC2 Init ===" >> /var/log/user-data.log
exec >> /var/log/user-data.log 2>&1

# Update system
apt-get update
apt-get upgrade -y
apt-get install -y curl wget docker.io docker-compose

# Start Docker
systemctl enable docker
systemctl start docker

# Add docker compose (v2)
curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create ELK stack directory
mkdir -p /opt/elk
cd /opt/elk

# Create docker-compose.yml for ELK stack
cat > docker-compose.yml << 'COMPOSE_EOF'
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false  # For free-tier simplicity; enable in production
      - ES_JAVA_OPTS=-Xms512m -Xmx512m
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    networks:
      - elk

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
      - logstash_data:/usr/share/logstash/data
    ports:
      - "5000:5000"
    environment:
      - "LS_JAVA_OPTS=-Xmx256m -Xms256m"
    networks:
      - elk
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    networks:
      - elk
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
  logstash_data:

networks:
  elk:
    driver: bridge
COMPOSE_EOF

# Create Logstash config
cat > logstash.conf << 'LOGSTASH_EOF'
input {
  tcp {
    port => 5000
    codec => json
  }
}

filter {
  mutate {
    add_field => { "[@metadata][index_name]" => "logs-%{+YYYY.MM.dd}" }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "%{[@metadata][index_name]}"
  }
  stdout { codec => json }
}
LOGSTASH_EOF

# Start ELK stack
docker-compose up -d

# Wait for Elasticsearch to be ready
sleep 30

echo "ELK stack started successfully" >> /var/log/user-data.log
echo "Logs init completed at $(date)" >> /var/log/user-data.log
