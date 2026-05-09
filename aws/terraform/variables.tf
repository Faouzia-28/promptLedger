variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1" # Singapore
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "promptledger"
}

variable "instance_type" {
  description = "EC2 instance type (free-tier: t2.micro or t3.micro)"
  type        = string
  default     = "t3.micro"
}

variable "ssh_cidr_blocks" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Change to your IP for security
}

variable "ec2_key_name" {
  description = "Existing AWS EC2 key pair name to attach to instances"
  type        = string
  default     = "promptledger_deploy"
}

variable "repo_clone_url" {
  description = "Git repository URL the EC2 user-data scripts should clone"
  type        = string
  default     = ""
}

variable "github_client_id" {
  description = "GitHub OAuth app client ID"
  type        = string
  sensitive   = true
}

variable "github_client_secret" {
  description = "GitHub OAuth app client secret"
  type        = string
  sensitive   = true
}
