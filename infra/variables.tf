variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name, used for resource names and tags."
  type        = string
  default     = "slotly"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string
  default     = "dev"
}

variable "container_image" {
  description = "API container image to run (built and pushed by CI)."
  type        = string
  default     = "ghcr.io/erick-6/slotly:latest"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "allowed_http_cidrs" {
  description = "CIDR blocks allowed to reach the API on port 80."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "instance_type" {
  description = "EC2 instance type for the API host (x86_64, to match the CI-built image)."
  type        = string
  default     = "t3.micro"
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "PostgreSQL major version for RDS."
  type        = string
  default     = "17"
}

variable "db_allocated_storage" {
  description = "RDS storage in GiB."
  type        = number
  default     = 20
}

variable "db_backup_retention_days" {
  description = "Days to keep automated RDS backups."
  type        = number
  default     = 1
}

variable "db_deletion_protection" {
  description = "Protect the database from accidental deletion. Enable for anything beyond a demo."
  type        = bool
  default     = false
}

variable "seed_demo_data" {
  description = "Load the demo lab-equipment data on first boot."
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention for API container logs."
  type        = number
  default     = 14
}
