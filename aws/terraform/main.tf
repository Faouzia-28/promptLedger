terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ============================================================================
# VPC & Networking
# ============================================================================

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_subnet" "main" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-subnet"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

resource "aws_route_table" "main" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-rt"
  }
}

resource "aws_route_table_association" "main" {
  subnet_id      = aws_subnet.main.id
  route_table_id = aws_route_table.main.id
}

# ============================================================================
# Security Groups
# ============================================================================

resource "aws_security_group" "frontend" {
  name        = "${var.project_name}-frontend-sg"
  description = "Security group for frontend instance"
  vpc_id      = aws_vpc.main.id

  # Allow SSH for debugging
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_cidr_blocks
  }

  # Allow HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow Next.js dev port
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-frontend-sg"
  }
}

resource "aws_security_group" "backend" {
  name        = "${var.project_name}-backend-sg"
  description = "Security group for backend instance"
  vpc_id      = aws_vpc.main.id

  # Allow SSH for debugging
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_cidr_blocks
  }

  # Allow FastAPI
  ingress {
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # In prod, restrict to frontend SG
  }

  # Allow Redis
  ingress {
    from_port = 6379
    to_port   = 6379
    protocol  = "tcp"
    self      = true
  }

  # Allow PostgreSQL (internal only)
  ingress {
    from_port = 5432
    to_port   = 5432
    protocol  = "tcp"
    self      = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-backend-sg"
  }
}

resource "aws_security_group" "logs" {
  name        = "${var.project_name}-logs-sg"
  description = "Security group for logs instance"
  vpc_id      = aws_vpc.main.id

  # Allow SSH for debugging
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_cidr_blocks
  }

  # Allow Kibana HTTP
  ingress {
    from_port   = 5601
    to_port     = 5601
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow Elasticsearch (from backend)
  ingress {
    from_port       = 9200
    to_port         = 9200
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  # Allow Logstash (from backend)
  ingress {
    from_port       = 5000
    to_port         = 5000
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-logs-sg"
  }
}

# ============================================================================
# IAM Role for EC2 instances (S3 access + CloudWatch logs)
# ============================================================================

resource "aws_iam_role" "ec2_role" {
  name = "${var.project_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "s3_access" {
  name = "${var.project_name}-s3-access"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2_role.name
}

# ============================================================================
# S3 Bucket for file uploads
# ============================================================================

resource "aws_s3_bucket" "uploads" {
  bucket = "${var.project_name}-uploads-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "${var.project_name}-uploads"
  }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ============================================================================
# EC2 Instances
# ============================================================================

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Frontend EC2
resource "aws_instance" "frontend" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  subnet_id     = aws_subnet.main.id
  key_name      = var.ec2_key_name

  vpc_security_group_ids      = [aws_security_group.frontend.id]
  associate_public_ip_address = true

  iam_instance_profile = aws_iam_instance_profile.ec2_profile.name

  user_data = base64encode(templatefile("${path.module}/user_data_frontend.sh", {
    backend_url    = "http://${aws_eip.backend.public_ip}:8000"
    repo_clone_url = var.repo_clone_url
  }))

  tags = {
    Name = "${var.project_name}-frontend"
  }

  depends_on = [aws_instance.backend]
}

# Backend EC2
resource "aws_instance" "backend" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  subnet_id     = aws_subnet.main.id
  key_name      = var.ec2_key_name

  vpc_security_group_ids      = [aws_security_group.backend.id]
  associate_public_ip_address = true

  iam_instance_profile = aws_iam_instance_profile.ec2_profile.name

  user_data = base64encode(templatefile("${path.module}/user_data_backend_docker.sh", {
    logs_host            = aws_eip.logs.public_ip
    s3_bucket_name       = aws_s3_bucket.uploads.id
    aws_region           = var.aws_region
    github_client_id     = var.github_client_id
    github_client_secret = var.github_client_secret
    repo_clone_url       = var.repo_clone_url
  }))

  tags = {
    Name = "${var.project_name}-backend"
  }

  depends_on = [aws_instance.logs]
}

# Logs EC2
resource "aws_instance" "logs" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  subnet_id     = aws_subnet.main.id
  key_name      = var.ec2_key_name

  vpc_security_group_ids      = [aws_security_group.logs.id]
  associate_public_ip_address = true

  iam_instance_profile = aws_iam_instance_profile.ec2_profile.name

  user_data = base64encode(templatefile("${path.module}/user_data_logs_docker.sh", {
    repo_clone_url = var.repo_clone_url
  }))

  tags = {
    Name = "${var.project_name}-logs"
  }
}

# Elastic IPs for stable public endpoints across stop/start
resource "aws_eip" "frontend" {
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-frontend-eip"
  }
}

resource "aws_eip_association" "frontend" {
  instance_id   = aws_instance.frontend.id
  allocation_id = aws_eip.frontend.id
}

resource "aws_eip" "backend" {
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-backend-eip"
  }
}

resource "aws_eip_association" "backend" {
  instance_id   = aws_instance.backend.id
  allocation_id = aws_eip.backend.id
}

resource "aws_eip" "logs" {
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-logs-eip"
  }
}

resource "aws_eip_association" "logs" {
  instance_id   = aws_instance.logs.id
  allocation_id = aws_eip.logs.id
}

output "frontend_ip" {
  value       = aws_eip.frontend.public_ip
  description = "Frontend EC2 public IP"
}

output "frontend_url" {
  value       = "http://${aws_eip.frontend.public_ip}:3000"
  description = "Frontend application URL"
}

output "backend_ip" {
  value       = aws_eip.backend.public_ip
  description = "Backend EC2 public IP"
}

output "backend_url" {
  value       = "http://${aws_eip.backend.public_ip}:8000"
  description = "Backend API URL"
}

output "logs_ip" {
  value       = aws_eip.logs.public_ip
  description = "Logs EC2 public IP"
}

output "kibana_url" {
  value       = "http://${aws_eip.logs.public_ip}:5601"
  description = "Kibana dashboard URL"
}

output "s3_bucket_name" {
  value       = aws_s3_bucket.uploads.id
  description = "S3 bucket name for uploads"
}
